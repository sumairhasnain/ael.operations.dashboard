# Access rules and the 12 team logins

## Login ID and passwords

- **Login ID** is each person's **company email address**.
- **Passwords:** when you add a person, the Users page creates a random temporary password such as `2G8N-xgkv-7FGF`. It is shown once, so copy it or download the CSV.
  - At their first sign-in, the person must replace it with their own password before they see any data.
- **Password rules:**
  - at least 10 characters
  - at least one letter and one number
  - must not contain their email name
- **Forgot password:** use **Reset password** on the Users page. This always works.
  - The "Forgot password?" email link also works once email sending is set up (guide, step 12).
- **Auto sign-out** happens after 60 minutes with no activity. A warning appears 2 minutes before.
- Every sign-in, sign-out, password change and admin action is recorded in **Users → Activity log**.

## The three roles

| Permission | Admin (you) | Manager | Viewer |
|---|---|---|---|
| Open the dashboard: all shops and models | Yes | Yes | Yes |
| Standard tabs: Overview, Production, Products, Dispatch, In-house, Quality, Maintenance, OEE, Capacity, Efficiency, Inventory, Issues, Projects | Yes | Yes | Only the tabs you tick (all 13 by default) |
| Restricted tabs: **Cost, Savings, Workforce** | Yes | Yes | Only if you tick them for that person |
| Change own password | Yes | Yes | Yes |
| Add, edit, disable or delete users | Yes | No | No |
| Reset other people's passwords | Yes | No | No |
| See the activity log | Yes | No | No |
| Change dashboard data | No one. Data comes only from the Atlas sync. | | |

The database enforces these rules; the screen is not just hiding things. A viewer's browser never receives Cost, Savings or Workforce data unless you have given that viewer those tabs. On the Overview tab, the Cost and Savings lines are left out for people who can't see those tabs.

## Suggested set-up for 12 IDs

Replace the names and emails with real ones. You can change anyone's role or tabs later from the Users page.

| # | Function | Role | Extra tabs |
|---|---|---|---|
| 0 | **You: Umair** | Admin | (all) |
| 1 | Plant / Production Manager | Manager | (all) |
| 2 | PPC Manager | Manager | (all) |
| 3 | Quality Manager | Viewer | none |
| 4 | Maintenance Manager | Viewer | none |
| 5 | Shop in-charge: Clutch | Viewer | none |
| 6 | Shop in-charge: Ignition Coil / Drum Gear | Viewer | none |
| 7 | Shop in-charge: Carburetor / Carb Child Parts | Viewer | none |
| 8 | Shop in-charge: Piston / Bridge Fork Top / HPDC | Viewer | none |
| 9 | Shop in-charge: CIF Machining / Hubs | Viewer | none |
| 10 | Shop in-charge: Polymer / Fuel Cock / Cushion | Viewer | none |
| 11 | Stores / Inventory & Vendor follow-up | Viewer | none |
| 12 | HR / Admin (attendance) | Viewer | **Workforce** |

Finance or Costing can be added as a Viewer with **Cost** and **Savings** ticked.

`roster-template.csv` in this folder has the same list in the format the **Add several users** box accepts:

```
Full name, email, designation, role
```

Fill it in Excel, then copy the rows (without the header) and paste them into that box.
