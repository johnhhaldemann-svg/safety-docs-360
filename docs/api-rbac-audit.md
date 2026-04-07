# API auth and scope audit

This document inventories how [`app/api`](../app/api) routes enforce authentication and company/admin scope. Use it when adding routes or reviewing security.

## Inventory (regenerate before release)

Re-run the commands in [Maintenance](#maintenance) and compare counts. Roughly **70+** route modules import `authorizeRequest`; the remainder use **proxies** (forwarding to `/api/company/*`), **`CRON_SECRET`**, **Stripe webhook signature**, or are **intentionally public** (signup, legal config).

**`SUPABASE_SERVICE_ROLE_KEY`** is only for server-side admin clients ([`lib/supabaseAdmin.ts`](../lib/supabaseAdmin.ts)); never expose it to the browser. Routes under `/api/superadmin/*` must keep **superadmin** checks after `authorizeRequest` (see [`app/api/superadmin/injury-weather/route.ts`](../app/api/superadmin/injury-weather/route.ts) for the `normalizeAppRole` / `super_admin` pattern).

## Standard pattern

- **Authenticated app API**: call `authorizeRequest` from [`lib/rbac.ts`](../lib/rbac.ts) (or equivalent role checks) early in the handler; enforce **company** or **jobsite** scope from path/query/body as appropriate.
- **RLS**: Supabase Row Level Security is the second line of defense; API checks must still prevent cross-tenant mistakes and confusing errors.

## Routes using `authorizeRequest` (direct)

These files import and use `authorizeRequest` (grep `authorizeRequest` in `app/api/**/route.ts`). Treat new company/admin features the same way.

## Intentional exceptions

| Area | Behavior | Rationale |
|------|----------|-----------|
| `GET /api/legal/config` | No session required | Public agreement text for signup / login UX |
| `POST /api/legal/accept` | Uses session / payload per implementation | User accepts terms |
| `POST /api/auth/register`, `POST /api/auth/company-register` | Public signup flows | Creates accounts; validate input server-side |
| `GET /api/auth/me` | Session | Uses `authorizeRequest` or equivalent |
| `GET /api/cron/injury-weather-refresh` | `CRON_SECRET` only | Vercel cron; not user session |
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
rg -l "authorizeRequest" app/api --glob "*.ts"
rg "route\\.ts" app/api -g "*.ts" --files-with-matches
```

Compare counts; any new non-proxy route without `authorizeRequest` should be reviewed.
