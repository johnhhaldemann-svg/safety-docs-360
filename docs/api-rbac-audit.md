# API auth and scope audit

This document inventories how [`app/api`](../app/api) routes enforce authentication and company/admin scope. Use it when adding routes or reviewing security.

## Inventory (regenerate before release)

Re-run the commands in [Maintenance](#maintenance) and compare counts. Current snapshot (2026-04-25): **154** `route.ts` modules under `app/api`, with **123** using `authorizeRequest` and **10** using `authorizeSafetyIntelligenceRequest`. The remainder are expected proxy/public/cron/webhook surfaces.

**`SUPABASE_SERVICE_ROLE_KEY`** is only for server-side admin clients ([`lib/supabaseAdmin.ts`](../lib/supabaseAdmin.ts)); never expose it to the browser. Routes under `/api/superadmin/*` must keep **superadmin** checks after `authorizeRequest` (see [`app/api/superadmin/injury-weather/route.ts`](../app/api/superadmin/injury-weather/route.ts) for the `normalizeAppRole` / `super_admin` pattern).

## Standard pattern

- **Authenticated app API**: call `authorizeRequest` from [`lib/rbac.ts`](../lib/rbac.ts) (or equivalent role checks) early in the handler; enforce **company** or **jobsite** scope from path/query/body as appropriate.
- **RLS**: Supabase Row Level Security is the second line of defense; API checks must still prevent cross-tenant mistakes and confusing errors.

## Parity modules (inductions, toolbox, prequal, SDS, forms, integrations)

These routes use `authorizeRequest`, `getCompanyScope`, and (where applicable) `getJobsiteAccessScope` / `isJobsiteAllowed` plus `blockIfCsepOnlyCompany` for full-product workspaces:

- [`GET/POST /api/company/inductions/programs`](../app/api/company/inductions/programs/route.ts) — list / create induction programs (mutations: admin-like roles).
- [`PATCH /api/company/inductions/programs/[id]`](../app/api/company/inductions/programs/[id]/route.ts) — update program.
- [`GET/POST /api/company/inductions/requirements`](../app/api/company/inductions/requirements/route.ts) — list / create per-jobsite or company-wide requirements.
- [`PATCH /api/company/inductions/requirements/[id]`](../app/api/company/inductions/requirements/[id]/route.ts) — update requirement.
- [`GET/POST /api/company/inductions/completions`](../app/api/company/inductions/completions/route.ts) — list / record completions (jobsite-scoped reads; role-gated writes).
- [`GET /api/company/inductions/evaluate`](../app/api/company/inductions/evaluate/route.ts) — site access evaluation for a jobsite + subject (`userId` or default self, optional `visitorDisplayName`).

Additional parity routes:

- [`GET/POST /api/company/safety-forms/definitions`](../app/api/company/safety-forms/definitions/route.ts), [`PATCH /api/company/safety-forms/definitions/[id]`](../app/api/company/safety-forms/definitions/[id]/route.ts), [`GET/POST /api/company/safety-forms/definitions/[id]/versions`](../app/api/company/safety-forms/definitions/[id]/versions/route.ts)
- [`GET/POST /api/company/safety-forms/submissions`](../app/api/company/safety-forms/submissions/route.ts), [`PATCH /api/company/safety-forms/submissions/[id]`](../app/api/company/safety-forms/submissions/[id]/route.ts)
- [`GET/POST /api/company/integrations/webhooks`](../app/api/company/integrations/webhooks/route.ts), [`PATCH /api/company/integrations/webhooks/[id]`](../app/api/company/integrations/webhooks/[id]/route.ts), [`GET/POST /api/company/integrations/webhooks/[id]/deliveries`](../app/api/company/integrations/webhooks/[id]/deliveries/route.ts)
- [`POST /api/company/integrations/hris/roster`](../app/api/company/integrations/hris/roster/route.ts) — `can_manage_company_users` only; logs import metadata
- [`POST /api/company/field-sync/batch`](../app/api/company/field-sync/batch/route.ts) — toolbox session create / conditional upsert (server-wins on `updated_at`)

## Routes using `authorizeRequest` (direct)

These files import and use `authorizeRequest` (search `authorizeRequest` in `app/api/**/route.ts`). Treat new company/admin features the same way.

## Routes using `authorizeSafetyIntelligenceRequest` (direct)

Safety Intelligence route handlers use [`lib/safety-intelligence/http.ts`](../lib/safety-intelligence/http.ts) and `authorizeSafetyIntelligenceRequest` as their auth gate. Treat this as equivalent to `authorizeRequest` for those surfaces.

## Intentional exceptions

| Area | Behavior | Rationale |
|------|----------|-----------|
| `GET /api/legal/config` | No session required | Public agreement text for signup / login UX |
| `POST /api/legal/accept` | Uses session / payload per implementation | User accepts terms |
| `POST /api/auth/register`, `POST /api/auth/company-register` | Public signup flows | Creates accounts; validate input server-side |
| `GET /api/auth/me` | Session | Uses `authorizeRequest` or equivalent |
| `GET /api/cron/injury-weather-refresh` | `CRON_SECRET` only | Vercel cron; not user session |
| `GET /api/cron/company-billing-invoices` | `CRON_SECRET` only | Vercel cron; recurring company billing |
| `GET /api/cron/risk-memory-rollup` | `CRON_SECRET` only | Vercel cron; service-role snapshot upserts (`SUPABASE_SERVICE_ROLE_KEY`) |
| `PATCH /api/company/risk-memory/recommendations/[id]` | `authorizeRequest` + manager/admin | Dismiss stored recommendation (`dismissed: true`) |
| `GET /api/uploads` | Lists upload hints | No sensitive data; `POST` returns 400 |

## Legacy proxy routes

These forward to `/api/company/*` with the **same request headers** (cookie / `Authorization`). Authorization is enforced by the target handler.

- `app/api/incidents/route.ts` → `/api/company/incidents`
- `app/api/observations/route.ts` → mixed company targets
- `app/api/companies/route.ts` → `/api/company/users`
- `app/api/dap/route.ts`, `app/api/permits/route.ts`, `app/api/reports/route.ts`, `app/api/jobsites/route.ts`, `app/api/jobsites/[jobsiteId]/[surface]/route.ts` — verify each file’s target path; all should hit `authorizeRequest`-protected company routes.

## Re-audit checklist

When adding or changing an API route:

1. [ ] Is the route public on purpose? Document it here.
2. [ ] For user data: `authorizeRequest` (or admin/superadmin equivalent) before any DB read/write.
3. [ ] Company ID / jobsite ID taken from trusted membership, not only from client input.
4. [ ] Mutations use the same checks as reads.
5. [ ] Cron/admin routes use secrets or role checks, not guessable URLs alone.

## Maintenance

Re-run inventory:

```bash
node -e "const fs=require('fs');const path=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):e.name==='route.ts'?[p]:[]});const routes=walk('app/api');let a=0,b=0;for(const f of routes){const s=fs.readFileSync(f,'utf8');if(s.includes('authorizeRequest'))a++;if(s.includes('authorizeSafetyIntelligenceRequest'))b++;}console.log({total:routes.length,authorizeRequest:a,authorizeSafetyIntelligenceRequest:b,other:routes.length-a-b});"
```

Any new non-proxy/non-public route without either authorization helper should be reviewed.
