// AEL Operations Portal — admin-users Edge Function
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor
//         name it exactly:  admin-users   → paste this whole file → Deploy.
// Only an ACTIVE ADMIN can call it. The service key never leaves Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const TABS = ["overview", "production", "product", "dispatch", "inhouse", "quality", "maintenance", "oee",
  "capacity", "efficiency", "workforce", "inventory", "cost", "savings", "issues", "projects"];
const ROLES = ["admin", "manager", "viewer"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const serviceKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); return k.default || Object.values(k)[0]; }
  catch { return undefined; }
};
const okPassword = (p: unknown) => typeof p === "string" && p.length >= 10 && /[A-Za-z]/.test(p) && /\d/.test(p);
const cleanTabs = (t: unknown) => Array.isArray(t) ? TABS.filter((x) => t.includes(x)) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey()!, { auth: { persistSession: false } });

  // 1. Who is calling?
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await db.auth.getUser(jwt);
  if (!who?.user) return out({ error: "Not signed in" }, 401);
  const { data: me } = await db.from("profiles").select("id,email,role,active").eq("id", who.user.id).single();
  if (!me || me.role !== "admin" || !me.active) return out({ error: "Admins only" }, 403);

  let b: Record<string, any>;
  try { b = await req.json(); } catch { return out({ error: "Bad request" }, 400); }
  const log = (event: string, detail: string) =>
    db.from("login_log").insert({ user_id: me.id, email: me.email, event, detail: detail.slice(0, 300) });
  const target = async (id: string) => (await db.from("profiles").select("*").eq("id", id).single()).data;
  const adminsLeft = async (exceptId: string) =>
    ((await db.from("profiles").select("id").eq("role", "admin").eq("active", true).neq("id", exceptId)).data || []).length;

  try {
    switch (b.action) {
      // ---- Create a user with a temporary password ----
      case "create": {
        const email = String(b.email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out({ error: `Invalid email: ${email}` }, 400);
        if (!okPassword(b.password)) return out({ error: "Password must be 10+ characters with letters and numbers" }, 400);
        const role = ROLES.includes(b.role) ? b.role : "viewer";
        const { data, error } = await db.auth.admin.createUser({
          email, password: b.password, email_confirm: true,
          user_metadata: { full_name: String(b.full_name || "") },
        });
        if (error) return out({ error: `${email}: ${error.message}` }, 400);
        const row: Record<string, unknown> = {
          id: data.user.id, email, full_name: String(b.full_name || "").slice(0, 80),
          designation: String(b.designation || "").slice(0, 80), role, active: true, must_change_password: true,
        };
        const tabs = cleanTabs(b.tabs); if (tabs) row.tabs = tabs;
        const { error: e2 } = await db.from("profiles").upsert(row);
        if (e2) return out({ error: e2.message }, 400);
        await log("admin_create_user", `${email} as ${role}`);
        return out({ ok: true, id: data.user.id });
      }
      // ---- Change name / designation / role / tabs ----
      case "update": {
        const t = await target(b.id); if (!t) return out({ error: "User not found" }, 404);
        const patch: Record<string, unknown> = {};
        if (typeof b.full_name === "string") patch.full_name = b.full_name.slice(0, 80);
        if (typeof b.designation === "string") patch.designation = b.designation.slice(0, 80);
        if (ROLES.includes(b.role)) {
          if (t.role === "admin" && b.role !== "admin" && (await adminsLeft(t.id)) === 0)
            return out({ error: "At least one active admin must remain" }, 400);
          patch.role = b.role;
        }
        const tabs = cleanTabs(b.tabs); if (tabs) patch.tabs = tabs;
        const { error } = await db.from("profiles").update(patch).eq("id", t.id);
        if (error) return out({ error: error.message }, 400);
        await log("admin_update_user", `${t.email}: ${Object.keys(patch).join(", ")}`);
        return out({ ok: true });
      }
      // ---- Disable / enable a login ----
      case "set_active": {
        const t = await target(b.id); if (!t) return out({ error: "User not found" }, 404);
        const active = !!b.active;
        if (!active && t.id === me.id) return out({ error: "You cannot disable yourself" }, 400);
        const { error } = await db.auth.admin.updateUserById(t.id, { ban_duration: active ? "none" : "876000h" });
        if (error) return out({ error: error.message }, 400);
        await db.from("profiles").update({ active }).eq("id", t.id);
        await log(active ? "admin_enable_user" : "admin_disable_user", t.email);
        return out({ ok: true });
      }
      // ---- Give a new temporary password ----
      case "reset_password": {
        const t = await target(b.id); if (!t) return out({ error: "User not found" }, 404);
        if (!okPassword(b.password)) return out({ error: "Password must be 10+ characters with letters and numbers" }, 400);
        const { error } = await db.auth.admin.updateUserById(t.id, { password: b.password });
        if (error) return out({ error: error.message }, 400);
        // the password trigger just cleared the flag — set it again so they must change it
        await db.from("profiles").update({ must_change_password: t.id !== me.id }).eq("id", t.id);
        await log("admin_reset_password", t.email);
        return out({ ok: true });
      }
      // ---- Delete a user permanently ----
      case "delete": {
        const t = await target(b.id); if (!t) return out({ error: "User not found" }, 404);
        if (t.id === me.id) return out({ error: "You cannot delete yourself" }, 400);
        const { error } = await db.auth.admin.deleteUser(t.id);
        if (error) return out({ error: error.message }, 400);
        await log("admin_delete_user", t.email);
        return out({ ok: true });
      }
      default:
        return out({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return out({ error: String((e as Error)?.message || e) }, 500);
  }
});
