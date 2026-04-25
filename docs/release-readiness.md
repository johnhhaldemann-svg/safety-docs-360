# Release readiness checklist

Use this before cutting a preview or production release.

## Local verification

Run:

```bash
npm run verify:release
node ./node_modules/typescript/bin/tsc --noEmit
```

Expected result:

- TypeScript passes.
- Vitest passes.
- Navigation integrity passes.
- Lint exits successfully.
- Public adoption Playwright tests pass.
- Authenticated adoption Playwright coverage may skip locally unless `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are set.

## Database

- Apply new migrations before deploying the app.
- For this release, `user_onboarding_state` must exist before relying on persisted onboarding state.
- If migrations changed, deploy order is Supabase first, Vercel second.

## Demo

- Provision a `sales_demo` user when a polished walkthrough is needed.
- Follow [demo-mode.md](./demo-mode.md) for the setup SQL and script.

## Production smoke

- Open `/`, `/marketing`, `/company-signup`, `/login`, `/privacy`, and `/terms`.
- Sign in as a company-admin test user and open Dashboard.
- Confirm the workspace launch checklist renders.
- Open Command Center and confirm the checklist marks the Command Center step as viewed.
- Open Library, Jobsites, Field Issue Log, and Safety Intelligence from the sidebar.

## Environment

- Confirm Supabase URL/anon/service-role env vars are present in Vercel.
- Confirm `CRON_SECRET` is configured for scheduled jobs.
- Confirm `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` matches the release URL.
- Confirm Stripe and email provider vars only point at live systems when intentionally releasing paid flows.
