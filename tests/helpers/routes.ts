import { getDeclaredAppNavHrefs } from "../../lib/appNavigation";

/**
 * Well-formed UUID that is unlikely to collide with real rows; pages should still render
 * shell (empty state, redirect, or 404 UI) without 5xx.
 */
export const E2E_PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000001";

/**
 * Smoke targets: public marketing/legal and unauthenticated entry.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/marketing",
  "/terms",
  "/privacy",
  "/liability-waiver",
  "/company-signup",
  "/contractor-training-intake",
  "/demo/load",
] as const;

export const SAFE_PREDICT_WORKSPACE_ROUTES = [
  "/safe-predict",
  "/safe-predict/analytics",
  "/safe-predict/apps-integrations",
  "/safe-predict/billing",
  "/safe-predict/corrective-actions",
  "/safe-predict/csep",
  "/safe-predict/documents",
  "/safe-predict/gus-coaching",
  "/safe-predict/hazards",
  "/safe-predict/incidents",
  "/safe-predict/inspections",
  "/safe-predict/inductions",
  "/safe-predict/jobsites",
  `/safe-predict/jobsites/${E2E_PLACEHOLDER_UUID}`,
  "/safe-predict/observations",
  "/safe-predict/onboarding-import",
  "/safe-predict/permit-center",
  "/safe-predict/permits",
  "/safe-predict/peshep",
  "/safe-predict/platform-actions",
  "/safe-predict/predictive-risk",
  "/safe-predict/profile",
  "/safe-predict/reports",
  "/safe-predict/risk-memory",
  "/safe-predict/risk-mitigation",
  "/safe-predict/safety-forms",
  "/safe-predict/settings",
  "/safe-predict/team-access",
  "/safe-predict/training",
  "/safe-predict/training-tracker",
  "/safe-predict/workforce",
] as const;

/**
 * Every static page under the authenticated `(app)` shell (no `[param]` segments).
 * Keeps the app map in sync with filesystem routes.
 */
export const AUTH_APP_STATIC_ROUTES = [
  "/dashboard",
  "/documents",
  "/library",
  "/submit",
  "/upload",
  "/search",
  "/profile",
  "/support",
  "/peshep",
  "/csep",
  "/purchases",
  "/jobsites",
  "/training-matrix",
  "/field-id-exchange",
  "/jsa",
  "/permits",
  "/incidents",
  "/safety-intelligence",
  "/analytics",
  "/analytics/safety-intelligence",
  "/command-center",
  "/company-inductions",
  "/company-safety-forms",
  "/company-integrations",
  "/settings/risk-memory",
  "/reports",
  "/company-users",
  "/company-setup",
  "/safety-submit",
  "/my-submissions",
  "/admin",
  "/admin/users",
  "/admin/companies",
  "/admin/review-documents",
  "/admin/archive",
  "/admin/transactions",
  "/admin/settings",
  "/admin/agreements",
  "/admin/marketplace",
  "/billing/invoices",
  "/billing/invoices/new",
  "/companies",
  "/superadmin/cyber-security",
  "/superadmin/ai-knowledge-map",
  "/superadmin/csep-programs",
  "/superadmin/csep-completeness-review",
  "/superadmin/help-tickets",
  "/superadmin/injury-forecast-lab",
  "/superadmin/owner-validation/report",
] as const;

const id = E2E_PLACEHOLDER_UUID;

/** Dynamic `(app)` routes exercised with a placeholder id. */
export const AUTH_APP_DYNAMIC_ROUTES = [
  `/company-contractors/${id}`,
  `/admin/companies/${id}`,
  `/admin/review-documents/${id}`,
  `/jobsites/${id}/overview`,
  `/jobsites/${id}/analytics`,
  `/jobsites/${id}/schedule`,
  `/jobsites/${id}/documents`,
  `/jobsites/${id}/contractor-training`,
  `/jobsites/${id}/emergency-action-plan`,
  `/jobsites/${id}/jsa`,
  `/jobsites/${id}/incidents`,
  `/jobsites/${id}/live-view`,
  `/jobsites/${id}/permits`,
  `/jobsites/${id}/reports`,
  `/jobsites/${id}/safety-intelligence`,
  `/jobsites/${id}/team`,
  `/jobsites/${id}/inductions`,
  `/jobsites/${id}/toolbox`,
  `/jobsites/${id}/chemicals`,
  `/jobsites/${id}/safety-forms`,
  `/jobsites/${id}/site-visual`,
  `/companies/${id}/overview`,
  `/companies/${id}/documents`,
  `/companies/${id}/jobsites`,
  `/companies/${id}/analytics`,
  `/companies/${id}/users`,
  `/billing/invoices/${id}`,
  `/customer/billing/invoices/${id}`,
  `/sor/${id}`,
] as const;

/**
 * Full authenticated smoke list: static pages + dynamic placeholders + every href from
 * `lib/appNavigation.ts` (deduped). Use a broad-access E2E user (e.g. platform admin).
 */
export function authenticatedSmokeRoutes(): string[] {
  const set = new Set<string>([
    ...AUTH_APP_STATIC_ROUTES,
    ...AUTH_APP_DYNAMIC_ROUTES,
    ...SAFE_PREDICT_WORKSPACE_ROUTES,
    ...getDeclaredAppNavHrefs(),
  ]);
  return [...set].sort((a, b) => a.localeCompare(b));
}
