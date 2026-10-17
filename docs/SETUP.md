# AEL Operations Portal: step-by-step setup

**Time needed:** about 45 minutes, done once.
**What you will have at the end:**
- the dashboard at its own web address, for example `https://ael-ops-portal.pages.dev`
- your admin login
- 12 team logins with their own permissions
- data refreshed automatically from Atlas through the day

**Cost: zero.** Everything below uses free plans:
- **GitHub:** a private copy of the code and data
- **Supabase:** logins, permissions and the protected data
- **Cloudflare Pages:** hosts the website

**Two keys you will see. Treat them differently:**
- **Publishable key** (`sb_publishable_…`): public by design. You may send it to Claude.
- **Secret key** (`sb_secret_…`) and the **database password**: private. Never send them to Claude or anyone else. They go only into GitHub "Secrets" (step 8) or your password manager.

---

## Step 1: GitHub repository (5 min)

1. Go to **github.com** and sign in, or create a free account.
2. Click **+** (top right) → **New repository**.
   - **Repository name:** `ael-ops-portal`
   - **Visibility:** **Private**
   - Leave "Add a README" unticked → **Create repository**.
3. Get the code into the repository. Use either option:
   - **Option A (easiest):** send Claude the name, for example `umairhasnain/ael-ops-portal`. Claude will upload everything for you.
   - **Option B:** unzip `ael-ops-portal.zip`. On the empty repository page, click **uploading an existing file**, drag in **all files and folders**, then **Commit changes**.
     - The `.github` folder is hidden on some computers. If it doesn't upload, use Option A.

## Step 2: Supabase project (5 min)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. Click **New project**.
   - **Name:** `ael-portal`
   - **Database password:** click **Generate a password** and save it in your password manager. You will rarely need it.
   - **Region:** the nearest one, for example **Mumbai** or **Singapore**.
   - **Create new project**. Wait about 2 minutes.

## Step 3: Create the database (2 min)

1. In Supabase, open **SQL Editor** (left menu) → **New query**.
2. Open `supabase/schema.sql` from the code, copy **everything**, paste it in, then press **Run**.
3. You should see "Success. No rows returned". The notices about "does not exist, skipping" are normal.

## Step 4: Login settings (3 min)

1. Go to **Authentication** → **Sign In / Providers**.
   - Turn **OFF** "Allow new users to sign up". **This matters:** only you should create accounts.
   - Make sure **Email** is enabled. Open it and set:
     - **Minimum password length:** `10`
     - **Password requirements:** letters and digits
   - **Save**.
2. Leave the other settings as they are.

## Step 5: Your admin login (2 min)

1. Go to **Authentication** → **Users** → **Add user** → **Create new user**.
   - Enter **your company email** and a strong password.
   - Tick **Auto Confirm User** → **Create user**.
2. Go to **SQL Editor** → **New query**. Paste the line below, with your own email, then **Run**:

   ```sql
   update public.profiles set role = 'admin', must_change_password = false
   where email = 'your.email@company.com';
   ```

   It should say "Success… 1 row".

## Step 6: The user-management function (3 min)

1. Go to **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. **Function name:** `admin-users`. Type it exactly like that.
3. Delete the sample code. Paste **everything** from `supabase/functions/admin-users/index.ts`.
4. Click **Deploy function**. It should show as active after a few seconds.

## Step 7: Copy the two connection values (2 min)

1. Go to **Project Settings** (gear icon) → **API Keys**.
   - Copy the **Publishable key** (`sb_publishable_…`).
     - On older screens it is the **anon public** key under "Legacy API keys". Either works.
2. Go to **Project Settings** → **Data API**, or open the **Connect** button at the top.
   - Copy the **Project URL**, for example `https://abcdwxyz.supabase.co`.
3. **Send Claude these two values.** Claude will put them into `site/assets/config.js`.
   - Or edit that file yourself on GitHub: open the file → pencil icon → paste → **Commit changes**.
4. Still in **API Keys**, find the **Secret key** (`sb_secret_…`). Click **Reveal** and copy it.
   - If there is none, use **Create new secret key**.
   - Keep it on your clipboard for step 8 only.

## Step 8: Let GitHub send data to Supabase (5 min)

1. On GitHub, open your repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** twice:
   - **Name:** `SUPABASE_URL`, **Secret:** the Project URL from step 7
   - **Name:** `SUPABASE_SERVICE_KEY`, **Secret:** the Secret key from step 7
3. Open the **Actions** tab. If asked, click "I understand… enable workflows".
4. Choose **Sync dashboard data to Supabase** → **Run workflow** → **Run workflow**.
   - After about 30 seconds you should see a green tick.
5. **Check:** in Supabase → **Table Editor** → `datasets`, there should be about 27 rows.

## Step 9: Put the website online with Cloudflare Pages (7 min)

1. Go to **dash.cloudflare.com** and sign up for free. No domain is needed.
2. Go to **Workers & Pages** → **Create**. Choose the **Pages** tab, or the "Looking to deploy Pages? **Get started**" link → **Connect to Git** → **GitHub**.
   - When GitHub asks, allow access to **only the `ael-ops-portal` repository**.
3. Select the repository → **Begin setup** and fill in:
   - **Project name:** `ael-ops-portal`. This becomes `ael-ops-portal.pages.dev`; if it's taken, Cloudflare adds letters.
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `python3 tools/build.py`
   - **Build output directory:** `site`
   - **Save and Deploy**. Wait about a minute.
4. Open the project → **Settings** → **Build** → **Build watch paths** → **Include paths**: `site/*`, `src/*`, `tools/*` → **Save**.
   - This stops data updates from using up website builds.
5. Copy the site address, for example `https://ael-ops-portal.pages.dev`.

## Step 10: Tell Supabase the site address (1 min)

1. In Supabase, go to **Authentication** → **URL Configuration**.
   - **Site URL:** `https://ael-ops-portal.pages.dev`, or your address from step 9
   - **Redirect URLs** → **Add URL:** `https://ael-ops-portal.pages.dev/**`
   - **Save**.

## Step 11: First sign-in and team logins (10 min)

1. Open the site and sign in with your admin email. You should see the dashboard with all 16 tabs.
2. Click **Users** (top bar) → **Add several users**.
3. Paste your team list, one per line, in this format. The template is in `docs/roster-template.csv`:

   ```
   Full name, email, designation, role
   ```

   - Untick any tabs the viewers should not see. Cost, Savings and Workforce are unticked already.
   - **Create users**.
4. A box shows each person's **email and temporary password**. Click **Download CSV** before closing.
5. Send each person **only their own** email and temporary password, privately (in person or a direct message). Include the site address.
   - When they sign in, they must set their own password before the dashboard opens.
6. To change someone's access later: **Users** → **Edit**. Tick or untick tabs, or change Viewer, Manager or Admin.
   - **Reset password** gives them a new temporary password.
   - **Disable** blocks the login immediately.

## Step 12: Optional "Forgot password?" emails

Supabase's built-in email only delivers to members of your Supabase team, so team members won't receive reset emails yet. Until you set this up, use **Users → Reset password**. It always works.

To turn on emails, use a free email-sending service:
- **Brevo:** free, 300 emails a day, and only needs your email address verified.
- **Your company mail server:** ask IT for its SMTP details.

Then enter the details in Supabase → **Authentication** → **Emails** → **SMTP Settings** → **Enable custom SMTP**:
- host, port 587, username, password
- sender email, sender name "AEL Operations Portal"

## Step 13: Live data from Atlas

Tell Claude "**portal repo is ready**". Claude will set up one scheduled task. After each dashboard refresh (07:25, 09:25, 11:25, 13:25, 15:25, 17:25 and 23:25 PKT, Monday to Saturday), it copies the latest data into the repository. GitHub then moves it into Supabase within about a minute, and open dashboards pick it up within 5 minutes.

---

## Good to know

- **Staying free:** Supabase pauses a free project after 7 days with no activity. The automatic data syncs count as activity, so it stays awake.
  - If it ever pauses, open Supabase and click **Restore**. Nothing is lost.
- **Your own web address:** in Cloudflare Pages → **Custom domains**, add something like `ops.yourcompany.com`. IT adds one DNS record.
  - Then repeat step 10 with the new address.
- **Failed sign-in attempts** are in Supabase → **Authentication** → **Logs**.

## Troubleshooting

| You see | Do this |
|---|---|
| "Portal not connected yet" | `site/assets/config.js` still has placeholders. Do step 7.3. |
| "Email or password is incorrect" for a user who was just created | Check the email spelling on the Users page. Otherwise reset their password. |
| Users page: "Could not load users" | Step 3 was not run, or not run completely. Run `schema.sql` again. |
| Add user fails with "Failed to send a request" or a 401 error | Check the function is named exactly `admin-users` (step 6). If it still fails: Edge Functions → admin-users → **Details** → turn off **Verify JWT** → Save. The function checks the admin itself. |
| Dashboard charts are empty | Check the GitHub **Actions** tab shows a green tick, and the `datasets` table has rows (step 8). |
| Cloudflare build failed with "BUILD STOPPED" | The dashboard page changed shape. Tell Claude; the previous version stays online meanwhile. |
| Someone is locked out | Users → **Reset password**, or **Enable** if they were disabled. |
