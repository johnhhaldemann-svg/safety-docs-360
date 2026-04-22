import { getDeclaredAppNavHrefs } from "../../lib/appNavigation";

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
] as const;

/**
 * Every static page under the authenticated `(app)` shell (no `[param]` segments).
 * Keeps the app map in sync with filesystem routes.
 */
export const AUTH_APP_STATIC_ROUTES = [
  "/dashboard",
  "/library",
  "/submit",
  "/upload",
  "/search",
  "/profile",
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
  "/superadmin/csep-programs",
  "/superadmin/csep-completeness-review",
  "/superadmin/injury-forecast-lab",
] as const;

/**
 * Well-formed UUID that is unlikely to collide with real rows; pages should still render
 * shell (empty state, redirect, or 404 UI) without 5xx.
 */
export const E2E_PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000001";

const id = E2E_PLACEHOLDER_UUID;

/** Dynamic `(app)` routes exercised with a placeholder id. */
export const AUTH_APP_DYNAMIC_ROUTES = [
  `/admin/companies/${id}`,
  `/admin/review-documents/${id}`,
  `/jobsites/${id}/overview`,
  `/jobsites/${id}/analytics`,
  `/jobsites/${id}/documents`,
  `/jobsites/${id}/jsa`,
  `/jobsites/${id}/incidents`,
  `/jobsites/${id}/live-view`,
  `/jobsites/${id}/permits`,
  `/jobsites/${id}/reports`,
  `/jobsites/${id}/safety-intelligence`,
  `/jobsites/${id}/team`,
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
    ...getDeclaredAppNavHrefs(),
  ]);
  return [...set].sort((a, b) => a.localeCompare(b));
}
