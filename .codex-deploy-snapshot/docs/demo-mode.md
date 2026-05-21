# Sales demo mode

Use a `sales_demo` role account when you need a fast, safe product walkthrough without seeding customer data.

## What demo mode does

- Resolves the user to the company-admin dashboard experience.
- Shows realistic company, jobsites, documents, users, permits, incidents, reports, analytics, and onboarding progress from in-app demo data.
- Keeps the demo read-oriented: it is meant for walkthroughs and screenshots, not production customer records.

## Provision a demo account

1. Create a normal Supabase Auth user for the demo email.
2. Insert or update `public.user_roles` for that user:

```sql
insert into public.user_roles (user_id, role, team, account_status)
values ('<auth-user-id>', 'sales_demo', 'Demo Workspace', 'active')
on conflict (user_id)
do update set role = 'sales_demo', team = 'Demo Workspace', account_status = 'active';
```

3. Sign in as that user and open `/dashboard`.
4. Use the dashboard and Command Center to show the adoption path, risk signals, and operating workflow.

## Demo script

1. Open `/marketing` and show the three choices: Book Demo, Request Company Workspace, Open Workspace.
2. Sign in as the `sales_demo` user.
3. Open Dashboard and show the workspace launch checklist.
4. Open Command Center and explain how risk, open work, recommendations, and company memory live in one hub.
5. Open Jobsites, Field Issue Log, Library, and Safety Intelligence as supporting proof points.

## Notes

- The migration `20260422160000_sales_demo_role.sql` must be applied before assigning the role.
- Demo data is generated in the app, so it does not create customer rows or require cleanup.
- For full E2E coverage, configure `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` with a real workspace user.
