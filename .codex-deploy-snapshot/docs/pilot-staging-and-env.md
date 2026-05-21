# Staging parity (revenue pilot)

Use a **dedicated Supabase project** and a **Vercel environment** (Preview deployment tied to a long-lived branch, or a separate Vercel “Staging” project) so pilots never hit production data. Staging must run the **same migration history** as production.

## 1. Create the Supabase staging project

1. Create a new project in the Supabase dashboard (do not reuse production).
2. Note **Project URL**, **anon key**, and **service role** (server only).
3. **Auth → URL configuration**
   - **Site URL:** your staging app origin (e.g. `https://safety360docs-staging.vercel.app`).
   - **Redirect URLs:** that origin plus any preview URLs you use for PRs (or restrict PR previews to a throwaway project).
4. Enable **backups** appropriate to pilot data (still PII).

## 2. Apply migrations (evidence)

From the repo root, with the Supabase CLI logged in:

```bash
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db push
```

**Evidence to attach** to your pilot ticket or [parity-modules-release-validation.md](./parity-modules-release-validation.md):

- Redacted output of `supabase db push` showing success (or `Already up to date`).
- Screenshot of **Database → Migrations** (or equivalent) showing latest migration name matching `supabase/migrations/`.

Optional dry run (if your CLI supports it against linked project):

```bash
npm run db:push -- --dry-run
```

If the CLI reports **Access token not provided**, complete `supabase login` or use a CI job with `SUPABASE_ACCESS_TOKEN` and staging `SUPABASE_PROJECT_REF` per [.github/workflows/supabase-db-push.yml](../.github/workflows/supabase-db-push.yml).

## 3. Vercel staging

1. Create or reuse a Vercel project; set **Root Directory** to the repo root (folder containing `package.json`).
2. **Environment variables:** duplicate the matrix from [production-deployment.md](./production-deployment.md) §2, but every `NEXT_PUBLIC_*` and `SUPABASE_*` value must point at the **staging** Supabase project—not production.
3. **Branch strategy (pick one):**
   - **Option A:** Long-lived `staging` branch → Vercel **Production** for that Vercel project only (isolated from prod Vercel project).
   - **Option B:** `main` **Preview** deployments with Preview env vars all pointing at staging Supabase (never point Preview at prod DB).
4. Set **`CRON_SECRET`** for Preview/Staging if scheduled crons should run there; otherwise document that crons are production-only for the pilot.

Canonical variable list and semantics: [.env.example](../.env.example).

## 4. Staging vs production env matrix

| Variable | Staging | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL | Prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon | Prod anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service role | Prod service role |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | Staging app URL | Prod app URL |
| `CRON_SECRET` | Staging-only secret (or omit) | Prod secret |
| Stripe keys | **Test** (`sk_test_…`, test webhook) | **Live** only when contract requires |
| `RESEND_API_KEY` / from-address vars | Test domain or staging sender | Production sender |

## 5. Definition of done (staging-parity todo)

- [ ] Staging Supabase exists and migrations applied (evidence saved).
- [ ] Staging Vercel deploy succeeds; smoke URLs use staging origin.
- [ ] No staging env var points at production Supabase (spot-check all three Supabase keys).
- [ ] GitHub E2E secrets (if used) target staging project for non-prod test users.

See also: [pilot-production-cutover.md](./pilot-production-cutover.md) for production-only steps.
