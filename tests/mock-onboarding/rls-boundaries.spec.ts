/**
 * Suite 4: RLS boundary tests — cross-tenant isolation
 *
 * Verifies that:
 *  - Field user sees only their own company's data (jobsites, JSAs, incidents, etc.)
 *  - Accessing another tenant's company/jobsite ID returns 0 results or is blocked
 *  - Direct Supabase REST API calls with the user's JWT enforce RLS
 *  - Admin routes are inaccessible to field users
 *  - Superadmin-only routes are inaccessible to both company roles
 *
 * Pre-requisite: run `npm run seed:test-company`, set:
 *   E2E_FIELD_USER_EMAIL, E2E_FIELD_USER_PASSWORD
 *   E2E_TEST_COMPANY_ID, E2E_TEST_JOBSITE_ID
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { test, expect } from "../fixtures";
import { hasRoleE2ECredentials, E2E_ROLE_AUTH, acceptAgreementIfPresent } from "../helpers/auth";
import { getTestIds } from "./helpers";

/** A UUID that does not belong to the test company */
const FOREIGN_COMPANY_ID = "00000000-dead-beef-dead-000000000001";
const FOREIGN_JOBSITE_ID = "00000000-dead-beef-dead-000000000002";

test.use({ storageState: E2E_ROLE_AUTH.fieldUser.storageState });

function skip() {
  test.skip(!hasRoleE2ECredentials("fieldUser"), "Set E2E_FIELD_USER_EMAIL and E2E_FIELD_USER_PASSWORD.");
}

// ─── Route-level isolation ──────────────────────────────────────────────────
test.describe("Route isolation: foreign company/jobsite IDs", () => {
  test("navigating to a foreign company overview is blocked or empty", async ({ page }) => {
    skip();
    await page.goto(`/companies/${FOREIGN_COMPANY_ID}/overview`, {
      waitUntil: "domcontentloaded",
    });
    await acceptAgreementIfPresent(page, 3_000);
    // Wait for API calls and client-side redirect to settle
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);

    const url = page.url();
    const isRedirected = url.includes("/dashboard") || url.includes("/login") || url.includes("/jobsites");
    const isNotFound = await page.getByText(/not found|404|no access|forbidden|unauthorized|scope/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
    const isEmpty = await page.getByText(/no data|empty|nothing here/i).first().isVisible({ timeout: 5_000 }).catch(() => false);

    test.info().annotations.push({
      type: "result",
      description: `Foreign company route → url: ${url}, redirected: ${isRedirected}, 404/denied: ${isNotFound}, empty: ${isEmpty}`,
    });

    // At least one isolation mechanism must be active
    expect(isRedirected || isNotFound || isEmpty || !url.includes(FOREIGN_COMPANY_ID)).toBe(true);
  });

  test("navigating to a foreign jobsite overview is blocked or shows no data", async ({ page }) => {
    skip();
    await page.goto(`/jobsites/${FOREIGN_JOBSITE_ID}/overview`, {
      waitUntil: "domcontentloaded",
    });
    await acceptAgreementIfPresent(page, 3_000);
    // Skip networkidle — background polling keeps the network busy indefinitely.
    // Wait directly for the async API response which renders "Jobsite not found in your company scope."
    // NOTE: isVisible() does not wait — must use waitFor() to actually poll until visible.
    const isNotFound = await page.getByText(/not found|no access|no jobsite|scope/i).first()
      .waitFor({ state: "visible", timeout: 35_000 }).then(() => true).catch(() => false);

    const url = page.url();
    const isRedirected = !url.includes(FOREIGN_JOBSITE_ID);

    test.info().annotations.push({
      type: "result",
      description: `Foreign jobsite route → redirected: ${isRedirected}, denied: ${isNotFound}`,
    });

    expect(isRedirected || isNotFound).toBe(true);
  });

  test("navigating to foreign jobsite JSA tab returns empty or blocked", async ({ page }) => {
    skip();
    await page.goto(`/jobsites/${FOREIGN_JOBSITE_ID}/jsa`, { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);
    // Skip networkidle — background polling keeps the network busy indefinitely.
    // NOTE: isVisible() does not wait — must use waitFor() to actually poll until visible.
    const denied = await page.getByText(/not found|no access|forbidden|scope/i).first()
      .waitFor({ state: "visible", timeout: 35_000 }).then(() => true).catch(() => false);

    const url = page.url();
    const redirected = !url.includes(FOREIGN_JOBSITE_ID);

    expect(redirected || denied).toBe(true);
  });

  test("navigating to foreign jobsite incidents tab returns empty or blocked", async ({ page }) => {
    skip();
    await page.goto(`/jobsites/${FOREIGN_JOBSITE_ID}/incidents`, { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);
    // Skip networkidle — background polling keeps the network busy indefinitely.
    // NOTE: isVisible() does not wait — must use waitFor() to actually poll until visible.
    const isDenied = await page.getByText(/not found|no access|scope/i).first()
      .waitFor({ state: "visible", timeout: 35_000 }).then(() => true).catch(() => false);

    const url = page.url();
    const isRedirected = !url.includes(FOREIGN_JOBSITE_ID);

    expect(isRedirected || isDenied).toBe(true);
  });
});

// ─── API-level RLS (Supabase REST) ──────────────────────────────────────────
test.describe("Supabase RLS: direct API calls with user JWT", () => {
  test("field user JWT cannot read another company's memberships via REST", async ({ page }) => {
    skip();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!supabaseUrl || !anonKey, "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.");

    // Get the user's session JWT from browser storage
    const jwt = await page.evaluate(async (url) => {
      const keys = Object.keys(localStorage);
      const sessionKey = keys.find((k) => k.includes("supabase") && k.includes("auth"));
      if (!sessionKey) return null;
      try {
        const session = JSON.parse(localStorage.getItem(sessionKey) ?? "{}");
        return session?.access_token ?? null;
      } catch {
        return null;
      }
    }, supabaseUrl);

    if (!jwt) {
      test.info().annotations.push({ type: "skip", description: "Could not extract JWT from localStorage." });
      return;
    }

    // Call the Supabase REST API directly with the user's JWT, querying for a foreign company's memberships
    const result = await page.evaluate(
      async ({ url, key, token, foreignId }) => {
        const res = await fetch(
          `${url}/rest/v1/company_memberships?company_id=eq.${foreignId}&select=*`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const body = await res.json();
        return { status: res.status, count: Array.isArray(body) ? body.length : -1 };
      },
      { url: supabaseUrl!, key: anonKey!, token: jwt, foreignId: FOREIGN_COMPANY_ID }
    );

    test.info().annotations.push({
      type: "result",
      description: `RLS check: foreign company_memberships query → status: ${result.status}, rows: ${result.count}`,
    });

    // RLS must return 0 rows (not a 4xx, because Supabase returns 200 with empty array for RLS-filtered rows)
    expect(result.count).toBe(0);
  });

  test("field user JWT cannot read another company's jobsites via REST", async ({ page }) => {
    skip();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!supabaseUrl || !anonKey, "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.");

    const jwt = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const sessionKey = keys.find((k) => k.includes("supabase") && k.includes("auth"));
      if (!sessionKey) return null;
      try {
        return JSON.parse(localStorage.getItem(sessionKey) ?? "{}")?.access_token ?? null;
      } catch { return null; }
    });

    if (!jwt) {
      test.info().annotations.push({ type: "skip", description: "JWT not available." });
      return;
    }

    const result = await page.evaluate(
      async ({ url, key, token, foreignId }) => {
        const res = await fetch(
          `${url}/rest/v1/company_jobsites?company_id=eq.${foreignId}&select=id,name`,
          {
            headers: { apikey: key, Authorization: `Bearer ${token}` },
          }
        );
        const body = await res.json();
        return { status: res.status, count: Array.isArray(body) ? body.length : -1 };
      },
      { url: supabaseUrl!, key: anonKey!, token: jwt, foreignId: FOREIGN_COMPANY_ID }
    );

    test.info().annotations.push({
      type: "result",
      description: `RLS: foreign company_jobsites → rows: ${result.count}`,
    });
    expect(result.count).toBe(0);
  });

  test("field user can read their own company's jobsites via REST", async ({ page }) => {
    skip();
    const { companyId } = getTestIds();
    test.skip(!companyId, "E2E_TEST_COMPANY_ID not set.");

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!supabaseUrl || !anonKey);

    const jwt = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const sessionKey = keys.find((k) => k.includes("supabase") && k.includes("auth"));
      if (!sessionKey) return null;
      try { return JSON.parse(localStorage.getItem(sessionKey) ?? "{}")?.access_token ?? null; }
      catch { return null; }
    });

    if (!jwt) return;

    const result = await page.evaluate(
      async ({ url, key, token, ownCompanyId }) => {
        const res = await fetch(
          `${url}/rest/v1/company_jobsites?company_id=eq.${ownCompanyId}&select=id,name`,
          { headers: { apikey: key, Authorization: `Bearer ${token}` } }
        );
        const body = await res.json();
        return { status: res.status, count: Array.isArray(body) ? body.length : -1 };
      },
      { url: supabaseUrl!, key: anonKey!, token: jwt, ownCompanyId: companyId }
    );

    test.info().annotations.push({
      type: "result",
      description: `RLS: own company_jobsites → rows: ${result.count}`,
    });
    // Should return at least 1 jobsite (the TEST_E2E Alpha Site)
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  test("field user JWT cannot read foreign company's JSAs via REST", async ({ page }) => {
    skip();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!supabaseUrl || !anonKey);

    const jwt = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const k = keys.find((k) => k.includes("supabase") && k.includes("auth"));
      if (!k) return null;
      try { return JSON.parse(localStorage.getItem(k) ?? "{}")?.access_token ?? null; }
      catch { return null; }
    });

    if (!jwt) return;

    const result = await page.evaluate(
      async ({ url, key, token, foreignId }) => {
        const res = await fetch(
          `${url}/rest/v1/company_jsas?company_id=eq.${foreignId}&select=id`,
          { headers: { apikey: key, Authorization: `Bearer ${token}` } }
        );
        const body = await res.json();
        return { count: Array.isArray(body) ? body.length : -1 };
      },
      { url: supabaseUrl!, key: anonKey!, token: jwt, foreignId: FOREIGN_COMPANY_ID }
    );

    expect(result.count).toBe(0);
  });

  test("field user JWT cannot read foreign company's incidents via REST", async ({ page }) => {
    skip();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!supabaseUrl || !anonKey);

    const jwt = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const k = keys.find((k) => k.includes("supabase") && k.includes("auth"));
      if (!k) return null;
      try { return JSON.parse(localStorage.getItem(k) ?? "{}")?.access_token ?? null; }
      catch { return null; }
    });

    if (!jwt) return;

    const result = await page.evaluate(
      async ({ url, key, token, foreignId }) => {
        const res = await fetch(
          `${url}/rest/v1/company_incidents?company_id=eq.${foreignId}&select=id`,
          { headers: { apikey: key, Authorization: `Bearer ${token}` } }
        );
        const body = await res.json();
        return { count: Array.isArray(body) ? body.length : -1 };
      },
      { url: supabaseUrl!, key: anonKey!, token: jwt, foreignId: FOREIGN_COMPANY_ID }
    );

    expect(result.count).toBe(0);
  });
});

// ─── Role escalation: field user cannot access admin routes ─────────────────
test.describe("Role escalation: field user blocked from admin routes", () => {
  test("field user is denied /admin (redirected or shown denial)", async ({ page }) => {
    skip();
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);
    await page.waitForURL(/\/dashboard|\/login|\/get-started/, { timeout: 12_000 }).catch(() => undefined);

    const url = page.url();
    const redirected = !url.endsWith("/admin") && !url.includes("/admin/");
    const denied = await page.getByText(/not authorized|access denied|forbidden/i).first().isVisible({ timeout: 5_000 }).catch(() => false);

    test.info().annotations.push({ type: "result", description: `Field user /admin → url: ${url}, denied: ${denied}` });
    expect(redirected || denied).toBe(true);
  });

  test("field user cannot access /admin/users", async ({ page }) => {
    skip();
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);
    await page.waitForURL(/\/dashboard|\/login|\/get-started/, { timeout: 12_000 }).catch(() => undefined);

    const url = page.url();
    const blocked = !url.includes("/admin/users") ||
      await page.getByText(/not authorized|forbidden|login/i).first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(blocked).toBe(true);
  });

  test("field user cannot access /admin/companies", async ({ page }) => {
    skip();
    await page.goto("/admin/companies", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);
    await page.waitForURL(/\/dashboard|\/login|\/get-started/, { timeout: 12_000 }).catch(() => undefined);

    const url = page.url();
    const blocked = !url.includes("/admin/companies") ||
      await page.getByText(/not authorized|forbidden/i).first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(blocked).toBe(true);
  });
});

// ─── Unauthenticated access (clean session) ─────────────────────────────────
test.describe("Unauthenticated: all protected routes redirect to /login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const PROTECTED_ROUTES = [
    "/dashboard",
    "/documents",
    "/jobsites",
    "/incidents",
    "/permits",
    "/jsa",
    "/admin",
  ];

  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects unauthenticated users to /login`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
    });
  }
});
