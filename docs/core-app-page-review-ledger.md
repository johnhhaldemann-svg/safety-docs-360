# Core App Page Review Ledger

Last updated: 2026-05-21

This ledger is the working checklist for the core web app page-by-page review. It covers public pages, authenticated app pages, core API/Supabase dependencies, Vercel runtime health, and critical safety workflows. Mobile, Electron/offline demo, Streamlit, and docs-only artifacts stay out of scope unless a core page depends on them.

## Baseline

- Route discovery found 127 `page.tsx` files under `app/`.
- `npm run test:navigation` passes.
- `npm run test:links` passes.
- `npm test -- lib/appRouteSmokeCoverage.test.ts` passes after adding `/library` and `/jobsites/[jobsiteId]/site-visual` to the authenticated smoke inventory.
- `node ./node_modules/typescript/bin/tsc --noEmit` passes.
- `npm run test` passes: 278 files, 1233 tests passed, 1 skipped.
- `npm run build` passes. Next still skips type validation during build because `typescript.ignoreBuildErrors` is enabled, so the separate typecheck remains required until that config is fixed.
- `npx playwright test tests/navigation.spec.ts --project=chromium` passes for public routes: 31 passed, 100 authenticated checks skipped because `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are not set.
- Vercel project metadata is linked locally, but the connector returns `403 Forbidden` for the configured team scope. Production deployment inspection is blocked until the Vercel app is re-authenticated for `team_aokvdgYK1ovY1nIDeeBsoWKN`.
- Supabase advisors are reachable for project `mdqkfbnwxrasdmbsjcqv`.

## Route Groups

Use these groups as the order for manual and Playwright review batches.

| Group | Routes | Initial status | Next check |
| --- | --- | --- | --- |
| Public/auth/onboarding | `/`, `/login`, `/marketing`, `/terms`, `/privacy`, `/liability-waiver`, `/company-signup`, `/contractor-training-intake`, `/demo/load` | Covered by public smoke list | Verify no 5xx, auth redirects, form validation, and safe empty states. |
| SafePredict public product | `/safe-predict` plus analytics, jobsites, permits, reports, risk, settings, team, training, workforce, and dynamic jobsite detail | Covered by public smoke list | Verify page links and safety risk messaging stay useful without auth. |
| Dashboard and command center | `/dashboard`, `/command-center` | Covered by authenticated smoke list | Verify urgent risk, top drivers, next actions, and role-specific dashboard actions. |
| Documents and marketplace | `/documents`, `/library`, `/submit`, `/upload`, `/search`, `/purchases`, `/marketplace-preview-approvals`, `/peshep`, `/csep` | `/library` coverage fixed | Verify document permissions, marketplace tab links, upload/submit validation, and CSEP/PESHEP safety language. |
| Jobsite surfaces | `/jobsites` and `/jobsites/[jobsiteId]/*`: overview, analytics, schedule, site-visual, documents, contractor-training, JSA, incidents, live-view, permits, reports, safety-intelligence, team, inductions, toolbox, chemicals, safety-forms | `site-visual` coverage fixed | Verify placeholder IDs do not 5xx, jobsite access scope is enforced, and urgent jobsite safety issues are prominent. |
| Safety workflows | `/safety-intelligence`, `/analytics/safety-intelligence`, `/analytics/predictive-model`, `/analytics`, `/permits`, `/jsa`, `/incidents`, `/reports`, `/field-id-exchange`, `/field-audits`, `/safety-submit`, `/my-submissions` | Covered by authenticated smoke list or nav discovery | Verify risk badges, high/critical escalation language, conservative missing-data behavior, and form failure states. |
| Programs and access | `/company-users`, `/company-onboarding`, `/company-inductions`, `/company-safety-forms`, `/company-integrations`, `/training`, `/training-matrix`, `/company-contractors`, `/company-contractors/[id]`, `/company-setup`, `/customer/billing` | Mostly covered by authenticated smoke list/nav discovery | Verify role visibility, company scope, import validation, and billing/user-access boundaries. |
| Companies and billing | `/companies`, `/companies/[companyId]/*`, `/billing`, `/billing/invoices`, `/billing/invoices/new`, `/billing/invoices/[id]`, `/customer/billing/invoices/[id]` | Covered by authenticated smoke list/nav discovery | Verify company isolation, invoice permissions, and missing service-role fallbacks. |
| Admin | `/admin`, users, companies, review-documents, archive, transactions, settings, agreements, marketplace, jobsite-audits, SOR audit, and dynamic admin detail pages | Covered by authenticated smoke list/nav discovery | Verify admin-only access, queue empty states, document lifecycle transitions, and audit trails. |
| Superadmin | `/superadmin` plus AI engine, builder text, CSEP tools, cyber security, document library, injury tools, jurisdiction standards, OSHA IPA lab, prediction validation, system health, and system test | Partially listed explicitly plus nav discovery | Verify superadmin-only navigation, service-role dependency messaging, and no ordinary admin exposure. |

## Findings Queue

| Priority | Finding | Evidence | Recommended fix |
| --- | --- | --- | --- |
| P0 | Production Vercel inspection is blocked. | Vercel connector returned `403 Forbidden` for the locally linked team. | Re-authenticate the Vercel connector or provide a token with access to the project scope, then inspect latest deployments and build logs. |
| P1 | Vercel Node runtime does not match repo engines. | `.vercel/project.json` uses `nodeVersion: 24.x`; `package.json` declares `20.x`. | Decide on one runtime. Prefer aligning Vercel to Node 20 unless the app is intentionally moving to Node 24 and CI/local tooling are updated. |
| P1 | Next build can mask TypeScript failures. | `next.config.ts` sets `typescript.ignoreBuildErrors: true`. | Run `tsc --noEmit`, fix current errors, then remove `ignoreBuildErrors` so Vercel builds fail on type regressions. |
| P1 | Supabase security advisors report RLS and RPC exposure items. | Advisor output includes RLS-enabled tables without policies, public/authenticated executable `SECURITY DEFINER` functions, `vector` in `public`, and leaked-password protection disabled. | Triage each item against intended access. Revoke direct RPC execution or move helper functions where safe; add policies or intentionally keep server-only tables unreachable; enable leaked-password protection or document why it is deferred. |
| P2 | Supabase performance advisors report many unindexed FKs and repeated permissive policies. | Advisor output includes high-volume tables such as jobsite visual jobs, documents, employee profile/time tables, and auditflow tables. | Prioritize indexes and policy consolidation on pages with frequent list/detail reads before broad cleanup. |
| P2 | Segment-level loading/error coverage is uneven. | Current route files include global/app shell loading/error files and a few segment loading states, but many major pages rely on generic fallbacks. | Add focused loading/error states first for dashboard, Safety Intelligence, documents, jobsites, permits, and admin queues. |
| P3 | Vitest warns about ESM package type. | Repeated warning: `package.json` lacks `"type": "module"` while config files parse as ESM. | Add `"type": "module"` only after checking Electron/build scripts for CommonJS assumptions; otherwise document as accepted test noise. |
| P3 | Lint is passing with warnings, not clean. | `npm run lint` exits 0 with 117 warnings, mostly React Compiler hook warnings plus unused CSEP renderer helpers. | Triage warnings by page group; start with dashboard, Safety Intelligence, documents, jobsites, and admin queues before low-risk cleanup. |

## Supabase Advisor Triage Notes

- Tables with RLS enabled and no policies should be split into intentional server-only tables versus missing policy bugs. Do not add permissive policies just to silence the advisor.
- `SECURITY DEFINER` helpers in `public` need function-by-function review because several appear to back auth, billing, invite, company role, and safety intelligence checks. Revoking execute blindly could break RLS or onboarding flows.
- `vector` in `public` is a security advisor warning. Moving it requires checking all embeddings, company memory, and similarity search SQL that references `public.vector`.
- Leaked-password protection is a Supabase Auth setting, not a repo migration. Enable it in the Supabase dashboard or record the pilot/prod decision.

## Review Checklist Per Page

- Page loads without 5xx and renders a meaningful body.
- Empty, loading, error, and permission-denied states are understandable.
- Primary actions validate input and show success/failure feedback.
- Navigation, sidebar, header, and command links resolve to existing routes.
- Role-based content matches user, company manager, company admin, admin, or superadmin audience.
- Safety-critical information uses clear low, moderate, high, and critical risk treatment.
- High and critical risks show top drivers and immediate next actions.
- Missing data is surfaced conservatively and never filled in as certainty.
- Supabase reads and writes enforce company scope and, when relevant, jobsite access scope.
- Service-role behavior stays server-side and degrades safely when the key is not configured.

## Verification Commands

- `npm run test:navigation`
- `npm run test:links`
- `npm test -- lib/appRouteSmokeCoverage.test.ts`
- `npm run lint`
- `node ./node_modules/typescript/bin/tsc --noEmit`
- `npm run test`
- `npm run build`
- `npx playwright test tests/navigation.spec.ts --project=chromium` with broad-access E2E credentials for authenticated smoke coverage.
