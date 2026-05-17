# API Auth And Scope Audit

This document inventories how [`app/api`](../app/api) routes enforce authentication and company/admin scope. Regenerate before release or customer IT review.

## Snapshot

Current snapshot: 2026-05-17.

| Metric | Count | Notes |
| --- | ---: | --- |
| `route.ts` modules under `app/api` | 253 | Generated with the maintenance command below. |
| Routes containing `authorizeRequest` directly | 193 | Includes normal app/admin/company/mobile route handlers. |
| Routes containing `authorizeSafetyIntelligenceRequest` directly | 12 | Safety Intelligence shared wrapper. |
| Non-direct-auth route files | 48 | Classified below as shared-auth, proxy/re-export, public/session, cron, webhook, or review-required. |

`SUPABASE_SERVICE_ROLE_KEY` is server-only evidence. It is consumed through [lib/supabaseAdmin.ts](../lib/supabaseAdmin.ts) and must never be exposed to browser code.

## Standard Pattern

- Authenticated app APIs call `authorizeRequest` from [lib/rbac.ts](../lib/rbac.ts) early in the handler.
- Company routes resolve server-side company scope through [lib/companyScope.ts](../lib/companyScope.ts).
- Jobsite-scoped routes use jobsite access helpers where applicable.
- Supabase RLS remains a second line of defense; API checks still need to prevent cross-tenant reads/writes.
- New IT/Cyber validation APIs follow this pattern: [security events](../app/api/company/security/events/route.ts), [data requests](../app/api/company/data-requests/route.ts), and [data request updates](../app/api/company/data-requests/[id]/route.ts).

## Shared-Auth Exceptions

These route files do not always contain the literal `authorizeRequest` string, but they delegate to shared helpers that do.

| Area | Route Files | Auth Helper | Status |
| --- | --- | --- | --- |
| Safety Intelligence | `app/api/company/safety-intelligence/**/route.ts` | [authorizeSafetyIntelligenceRequest](../lib/safety-intelligence/http.ts) | Verified shared-auth wrapper. |
| Microsoft Project integration | `connect`, `mappings`, `projects`, `status`, `sync` under [microsoft-project](../app/api/company/integrations/microsoft-project) | [authorizeMicrosoftProjectRequest](../app/api/company/integrations/microsoft-project/_shared.ts) | Verified shared-auth wrapper. |
| Superadmin AI Engine | [calls](../app/api/superadmin/ai-engine/calls/route.ts), [evals](../app/api/superadmin/ai-engine/evals/route.ts), [feedback](../app/api/superadmin/ai-engine/feedback/route.ts), [metrics](../app/api/superadmin/ai-engine/metrics/route.ts), [recommendations](../app/api/superadmin/ai-engine/recommendations/route.ts) | [authorizeSuperadminAiEngineRequest](../lib/superadmin/aiEngineAuth.ts) | Verified shared-auth wrapper. |
| Marketplace preview/access helpers | `app/api/library/preview/**` and purchase/credits routes | Shared marketplace/legal/credit helpers | Partial; review helper evidence before release. |
| Mobile features alias | [app/api/mobile/me/features/route.ts](../app/api/mobile/me/features/route.ts) | Calls [mobile me route](../app/api/mobile/me/route.ts) | Verified proxy to authorized route. |

## Proxy / Re-Export Exceptions

These routes forward to or re-export authorized company routes.

| Route | Target / Behavior | Status |
| --- | --- | --- |
| [app/api/companies/route.ts](../app/api/companies/route.ts) | Proxies to company users. | Verified proxy. |
| [app/api/incidents/route.ts](../app/api/incidents/route.ts) | Proxies to company incidents. | Verified proxy. |
| [app/api/jobsites/route.ts](../app/api/jobsites/route.ts) | Proxies to company jobsites. | Verified proxy. |
| [app/api/jsa/route.ts](../app/api/jsa/route.ts) | Legacy proxy to company JSA surface. | Verified proxy. |
| [app/api/observations/route.ts](../app/api/observations/route.ts) | Proxies/mixes company observation targets. | Verified proxy; review target map when changed. |
| [app/api/permits/route.ts](../app/api/permits/route.ts) | Proxies to company permits. | Verified proxy. |
| [app/api/reports/route.ts](../app/api/reports/route.ts) | Proxies to company reports. | Verified proxy. |
| `app/api/company/observations/[id]/*` | Re-exports corrective-action routes. | Verified re-export; auth is in target route. |

## Public / Session / Tokenized Exceptions

| Route | Behavior | Status |
| --- | --- | --- |
| [POST /api/auth/register](../app/api/auth/register/route.ts) | Public signup flow. | Intentional public route; validate input server-side. |
| [POST /api/auth/company-register](../app/api/auth/company-register/route.ts) | Public company signup flow. | Intentional public route; validate input server-side. |
| [POST /api/mobile/auth/login](../app/api/mobile/auth/login/route.ts) | Mobile credential exchange with Supabase Auth. | Intentional session route. |
| [POST /api/mobile/auth/refresh](../app/api/mobile/auth/refresh/route.ts) | Mobile refresh token exchange. | Intentional session route. |
| [GET /api/legal/config](../app/api/legal/config/route.ts) | Public legal/agreement config. | Intentional public route. |
| [GET /api/uploads](../app/api/uploads/route.ts) | Returns upload endpoint hints; `POST` disabled. | Intentional low-risk public route. |
| [GET/POST /api/contractor-training-intake](../app/api/contractor-training-intake/route.ts) | Tokenized contractor intake flow. | Needs release review of token entropy, expiry, and rate limits. |
| [POST /api/offline/session](../app/api/offline/session/route.ts) and [offline demo pack](../app/api/offline/demo-pack/open/route.ts) | Offline desktop/demo-only routes. | Needs production disabled evidence. |

## Cron And Webhook Exceptions

| Route | Guard | Status |
| --- | --- | --- |
| [GET /api/cron/injury-weather-refresh](../app/api/cron/injury-weather-refresh/route.ts) | `CRON_SECRET` | Verified cron-secret route. |
| [GET /api/cron/company-billing-invoices](../app/api/cron/company-billing-invoices/route.ts) | `CRON_SECRET` | Verified cron-secret route. |
| [GET /api/cron/risk-memory-rollup](../app/api/cron/risk-memory-rollup/route.ts) | `CRON_SECRET` | Verified cron-secret route. |
| [GET /api/cron/microsoft-project-sync](../app/api/cron/microsoft-project-sync/route.ts) | `CRON_SECRET` | Verified cron-secret route. |
| [POST /api/billing/stripe/webhook](../app/api/billing/stripe/webhook/route.ts) | Stripe signature verification expected. | Needs current webhook secret evidence. |

## Re-Audit Checklist

1. Is the route public on purpose? Document it here.
2. For user/company data, does it call `authorizeRequest` or a documented shared-auth helper before DB access?
3. Does company/jobsite scope come from trusted membership or role state rather than client input alone?
4. Do mutations enforce at least the same scope and role checks as reads?
5. Do cron/webhook routes use secrets/signatures rather than guessable URLs alone?
6. Are high-value actions recorded in `company_security_events` when customer audit evidence is expected?

## Maintenance

Re-run inventory:

```bash
node -e "const fs=require('fs');const path=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):e.name==='route.ts'?[p]:[]});const routes=walk('app/api');let a=0,b=0;for(const f of routes){const s=fs.readFileSync(f,'utf8');if(s.includes('authorizeRequest'))a++;if(s.includes('authorizeSafetyIntelligenceRequest'))b++;}console.log({total:routes.length,authorizeRequest:a,authorizeSafetyIntelligenceRequest:b,other:routes.length-a-b});"
```

Any new non-proxy/non-public route without `authorizeRequest`, `authorizeSafetyIntelligenceRequest`, or a documented shared-auth helper should be reviewed before merge.
