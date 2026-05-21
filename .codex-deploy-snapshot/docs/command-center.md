# Command center — how to use it

The **Command center** is a single page that combines **Risk Memory**, **open work** (issues, incidents, permits, JSAs, reports), **AI recommendations** for your company, and the **company memory bank**. Everything shown is limited to **your company**; other tenants’ data never appears here.

## Who can open it

Company users with access to **Insights** (typically **Company admin**, **Operations manager**, **Safety manager**, and roles with **view dashboards** where that route is enabled) will see **Command center** in the sidebar under **Insights**. **Read-only** users who can open Analytics can also open Command center.

If the menu item is missing, your role may not include analytics or dashboard access—ask a company admin.

## How to open it

1. Sign in to the app.
2. In the left sidebar, open **Insights**.
3. Click **Command center** (`/command-center`).

## Recommended workflow (daily or weekly)

1. **Load fresh data**  
   Click **Refresh**. Optionally switch **30d** vs **90d risk window**—Risk Memory rollups and the analytics line at the bottom use that window. Open-work counts use the latest workspace snapshot (recent rows per list).

2. **Scan Risk Memory**  
   Review the **band**, **score**, and **top scopes / hazards**. This reflects structured risk facets accumulated from your workflows (for example incidents and corrective actions with Risk Memory fields).  
   - Use **Full analytics** for charts, heatmaps, and deeper trends.  
   - Use **Risk Memory setup** to align taxonomy and company settings.

3. **Triage open work**  
   Use the **Open work** tiles. Each number links to the right area of the app:
   - **Open issues** / **Overdue** → **Issues** (corrective actions not verified closed).
   - **Open incidents** → **Incidents**.
   - **Active permits** / **Stop work** → **Permits**.
   - **JSAs in flight** → **JSA**.
   - **Reports (draft)** → **Reports**.

   Work through the highest-risk or overdue items first; reopen Command center after updates to see counts change.

4. **Read recommendations**  
   The **Recommendations** list shows stored suggestions for **your company** only (for example from Risk Memory or related automation). They are not shared across companies.

5. **Maintain the memory bank**  
   In **Company memory bank**, add short, factual entries your team wants assistants and workflows to remember (procedures, site rules, preferences). Saved entries are company-scoped.

## If something looks empty

| What you see | What it usually means |
|--------------|------------------------|
| Risk Memory shows no facets or “No rollup yet” | Little or no Risk Memory data in the selected window, or migrations not applied on your Supabase project. |
| Open work is all zeros | No matching open rows in the recent workspace snapshot, or you have no access to those modules. |
| Recommendations empty | None generated or stored yet for your company. |
| Error banners | Permission, network, or server issue; try **Refresh**. If it persists, confirm your account is linked to a company workspace. |

## Operators: database and jobs

The Command center **does not** run database migrations. For production, apply migrations in **Supabase** before or with the app deploy, and ensure Vercel env vars and crons are set. See [`production-deployment.md`](./production-deployment.md).
