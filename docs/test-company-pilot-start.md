# Test Company Pilot Start

Use this when you are ready to create real test-company workspaces on a staging or production pilot Supabase project.

## 1. Confirm the target

Make sure `.env.local` points at the intended staging or production pilot Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` if you are applying migrations from this machine

If migrations changed, apply them to the target project before seeding:

```powershell
npm run db:push:env
```

## 2. Verify the app gate

```powershell
npm run lint
npm test
npm run build
```

Lint warnings are currently non-blocking, but build and tests should pass before inviting companies.

## 3. Seed a test company

```powershell
npm run seed:pilot-company -- --yes --name "Summit Ridge Constructors" --email "admin+summit@example.com" --password "ChangeMe123!" --field-email "field+summit@example.com" --field-password "ChangeMe123!" --jobsite "Summit Ridge Pilot Jobsite"
```

The script creates or updates live records in the configured Supabase project:

- approved company workspace
- active company subscription on the `Pilot` plan
- company admin auth user and membership
- optional field user and membership
- starter jobsite

Useful flags:

- `--plan "Pilot"`
- `--trial-days 45`
- `--team-key "summit-ridge"`
- `--role company_admin`
- `--field-role field_user`

## 4. Smoke test

Start the app and sign in as the seeded admin. For production pilots, use the deployed production URL instead of localhost and use unique credentials for each company:

```powershell
npm run dev
```

Open `http://localhost:3000/login`, then confirm:

- dashboard and Command Center load
- company profile opens
- starter jobsite appears
- JSA, permits, field audits, incidents, training matrix, library, reports, and Safety Intelligence open from navigation
- optional field user cannot access another company's workspace

Record final pass/fail in [pilot-qa-signoff.md](./pilot-qa-signoff.md).
