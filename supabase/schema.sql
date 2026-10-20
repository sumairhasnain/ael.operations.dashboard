-- =====================================================================
-- AEL Operations Portal — database setup
-- Run ONCE in Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run again (it only creates what is missing / replaces functions).
-- =====================================================================

-- ---------- 1. Tables ----------------------------------------------------

-- One row per portal user (linked to Supabase Auth user).
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null unique,
  full_name            text not null default '',
  designation          text not null default '',
  role                 text not null default 'viewer'
                       check (role in ('admin', 'manager', 'viewer')),
  -- Tabs a VIEWER may open. Admin and Manager always see every tab.
  -- Default = everything except Cost, Savings and Workforce.
  tabs                 text[] not null default array[
                         'overview','production','product','vendor','inhouse','quality',
                         'maintenance','oee','capacity','efficiency','inventory','issues','projects','bom'],
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  last_login_at        timestamptz,
  password_changed_at  timestamptz
);

-- Dashboard data. One row per dataset (e.g. atlas_parts_daily).
-- "tabs" = which dashboard tabs need this dataset; a viewer can read the
-- dataset only if they have at least one of these tabs.
create table if not exists public.datasets (
  name       text primary key,
  tabs       text[] not null default array['overview'],
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Login / activity log (who signed in, signed out, changed password, admin actions).
create table if not exists public.login_log (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  email      text,
  event      text not null,
  detail     text,
  user_agent text,
  at         timestamptz not null default now()
);
create index if not exists login_log_at_idx on public.login_log (at desc);

-- ---------- 2. Helper functions -----------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- Can the signed-in user read a dataset used by these tabs?
-- Users who still have to change their first password see no data.
create or replace function public.can_read(ds_tabs text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.active and not p.must_change_password
      and (p.role in ('admin', 'manager') or p.tabs && ds_tabs));
$$;

-- Called by the portal pages to record events. Only a fixed list of events is accepted.
create or replace function public.log_event(p_event text, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then return; end if;
  if p_event not in ('login', 'logout', 'auto_logout', 'password_changed', 'open_dashboard') then
    raise exception 'unknown event';
  end if;
  select email into v_email from profiles where id = auth.uid();
  insert into login_log (user_id, email, event, user_agent)
  values (auth.uid(), v_email, p_event, left(coalesce(p_ua, ''), 300));
  if p_event = 'login' then
    update profiles set last_login_at = now() where id = auth.uid();
  end if;
end $$;

-- ---------- 3. Triggers on Supabase Auth users --------------------------

-- New Auth user → create their profile automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Password changed → clear the "must change password" flag.
-- (When the admin resets a password, the admin function sets the flag back on afterwards.)
create or replace function public.handle_password_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update profiles set must_change_password = false, password_changed_at = now() where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.handle_password_change();

-- ---------- 4. Row Level Security ---------------------------------------

alter table public.profiles  enable row level security;
alter table public.datasets  enable row level security;
alter table public.login_log enable row level security;

drop policy if exists "read own profile or admin reads all" on public.profiles;
create policy "read own profile or admin reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
-- No insert/update/delete policies: profile changes go only through the
-- admin-users Edge Function (which checks the caller is an active admin).

drop policy if exists "read permitted datasets" on public.datasets;
create policy "read permitted datasets" on public.datasets
  for select to authenticated using (public.can_read(tabs));
-- Data is written only by the GitHub sync (service key), never by users.

drop policy if exists "admin reads log" on public.login_log;
create policy "admin reads log" on public.login_log
  for select to authenticated using (public.is_admin());

-- ---------- 5. Permissions ----------------------------------------------

revoke all on public.profiles, public.datasets, public.login_log from anon, authenticated;
grant select on public.profiles, public.datasets, public.login_log to authenticated;
grant all on public.profiles, public.datasets, public.login_log to service_role;

revoke execute on function public.is_admin(), public.can_read(text[]), public.log_event(text, text),
  public.handle_new_user(), public.handle_password_change() from public, anon;
grant execute on function public.is_admin(), public.can_read(text[]), public.log_event(text, text)
  to authenticated;

-- ---------- 6. Make yourself the admin ----------------------------------
-- After creating your own user in Authentication → Users (Add user → Create new user,
-- tick "Auto Confirm User"), run this ONE line with your email:
--
--   update public.profiles set role = 'admin', must_change_password = false
--   where email = 'your.email@company.com';


-- ---------- Capacity: machine shifts edited on the Capacity tab ----------
-- One row per machine whose shifts differ from the time study. Any active user
-- with the Capacity tab can change them; every change is logged.
create table if not exists public.cap_shifts (
  machine    text primary key,
  shifts     smallint not null check (shifts between 1 and 3),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.cap_shifts enable row level security;
drop policy if exists "capacity users read shifts" on public.cap_shifts;
create policy "capacity users read shifts" on public.cap_shifts
  for select to authenticated using (public.can_read(array['capacity']));

-- p_shifts null = back to the time-study value (row removed).
create or replace function public.set_machine_shifts(p_machine text, p_shifts int)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.can_read(array['capacity']) then raise exception 'no access to the Capacity tab'; end if;
  if p_machine is null or length(p_machine) > 60 then raise exception 'bad machine'; end if;
  select email into v_email from profiles where id = auth.uid();
  if p_shifts is null then
    delete from cap_shifts where machine = p_machine;
  elsif p_shifts between 1 and 3 then
    insert into cap_shifts (machine, shifts, updated_by, updated_at) values (p_machine, p_shifts, v_email, now())
    on conflict (machine) do update set shifts = excluded.shifts, updated_by = excluded.updated_by, updated_at = now();
  else raise exception 'shifts must be 1, 2 or 3'; end if;
  insert into login_log (user_id, email, event, detail) values (auth.uid(), v_email, 'cap_shifts', p_machine || ' -> ' || coalesce(p_shifts::text, 'study'));
end $$;
revoke all on function public.set_machine_shifts(text, int) from public, anon;
grant execute on function public.set_machine_shifts(text, int) to authenticated;
grant select on public.cap_shifts to authenticated;
