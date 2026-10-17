# AEL Operations Portal

A private, login-protected website for the AEL Operations Dashboard.

| Folder | What it is |
|---|---|
| `site/` | The website: sign-in, change password, reset password, dashboard, and Users (admin) pages |
| `src/dashboard.html` | The dashboard page as built in Claude. `tools/build.py` turns it into `site/app.html`. |
| `data/` | Latest dashboard data (JSON). It is copied here automatically after each Atlas refresh. |
| `data/_access.json` | Which tabs each dataset belongs to. This controls who may read it. |
| `supabase/schema.sql` | Database tables, roles and security rules. Run once. |
| `supabase/functions/admin-users/` | Secure function behind the Users page |
| `scripts/sync.mjs` + `.github/workflows/sync-data.yml` | Copies `data/` into Supabase whenever it changes |
| `docs/SETUP.md` | **Step-by-step setup guide. Start here.** |
| `docs/ROLES.md` | Access rules and the suggested 12-person set-up |

No passwords or secret keys are stored in this repository.
