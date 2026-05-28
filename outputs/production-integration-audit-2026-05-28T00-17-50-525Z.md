# Production Integration Audit Map

Generated: 2026-05-28T00:17:50.525Z

## Project

- Supabase ref: mdqkfbnwxrasdmbsjcqv
- Supabase URL: present
- Database URL: postgresql://postgres...:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres
- Vercel project: safety-docs-360
- Vercel project id: prj_QSfFSeA2PPI5wDZZNo3754Q9xHQD
- Vercel org id: team_aokvdgYK1ovY1nIDeeBsoWKN

## Findings

- **healthy:** package.json engines.node is 20.x.
- **warning:** .vercel project nodeVersion is 24.x.
- **unknown:** latest local migration is 20260527161114; latest remote migration is unknown.
- **warning:** duplicate cron path(s): /api/cron/jobsite-daily-todos (0 10 * * *, 0 11 * * *)
- **healthy:** SUPABASE_SERVICE_ROLE_KEY is present.
- **healthy:** OPENAI_API_KEY is present.
- **warning:** Known Supabase advisor findings need triage: SECURITY DEFINER exposure, vector in public, missing FK indexes, and duplicate permissive policies.
- **warning:** Live Vercel connector access was previously observed as 403 Forbidden; repair connector/CLI access before relying on live deployment evidence.

## Next Actions

- Align Vercel project Node.js runtime with package.json Node 20.x.
- Confirm whether duplicate cron paths are intentional.
- Re-run Supabase security and performance advisors and prioritize SECURITY DEFINER/RLS findings.
- Repair Vercel connector/CLI access and capture latest deployment/log/env parity evidence.
- Use the in-app Superadmin System Health Integration Map for route/table/storage/Auth checks.
