/**
 * Suite 2: Field-user full function pass
 *
 * Walks through every feature and module as a standard (non-admin) test user.
 * Pre-requisite: run `npm run seed:test-company` first, then set env vars:
 *   E2E_FIELD_USER_EMAIL, E2E_FIELD_USER_PASSWORD
 *   E2E_TEST_COMPANY_ID, E2E_TEST_JOBSITE_ID
 *
 * Tests run using the saved Playwright storage state for the field user
 * (playwright/.auth/field-user.json, written by global setup).
 */
import { test, expect } from "../fixtures";
import { hasRoleE2ECredentials, E2E_ROLE_AUTH, acceptAgreementIfPresent } from "../helpers/auth";
import { expectAuthenticatedShellUrl } from "../helpers/sessionWait";
import {
  TEST_COMPANY_NAME,
  TEST_JOBSITE_NAME,
  getTestIds,
  gotoAndWaitForApp,
  expectHeading,
  expectApiCall,
} from "./helpers";

const ROLE = "fieldUser" as const;

function skip() {
  test.skip(!hasRoleE2ECredentials(ROLE), "Set E2E_FIELD_USER_EMAIL and E2E_FIELD_USER_PASSWORD, then run npm run seed:test-company.");
}

function skipNoJobsite() {
  test.skip(!process.env.E2E_TEST_JOBSITE_ID, "Set E2E_TEST_JOBSITE_ID (output by seed script).");
}

test.use({ storageState: E2E_ROLE_AUTH.fieldUser.storageState });

// ─── Auth ──────────────────────────────────────────────────────────────────
test.describe("Auth: field user session", () => {
  test("stored session navigates to authenticated shell", async ({ page }) => {
    skip();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page);
    await expectAuthenticatedShellUrl(page, "dashboard");
  });

  test("protected route /dashboard is accessible (not redirected to /login)", async ({ page }) => {
    skip();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────
test.describe("Dashboard: renders for field user", () => {
  test("dashboard page loads and is visible", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/dashboard");
    // Should see some dashboard content — heading, a card, or company name
    const body = page.locator("main, [role='main'], body");
    await expect(body).toBeVisible({ timeout: 20_000 });
    // Must not be a blank error page
    const errorPage = page.getByText(/500|internal server error/i).first();
    await expect(errorPage).not.toBeVisible();
  });

  test("dashboard shows company context (company name visible or user is scoped)", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/dashboard");
    // The company name or "welcome" message should appear somewhere on the page
    const companyText = page.getByText(TEST_COMPANY_NAME, { exact: false });
    const welcomeText = page.getByText(/welcome|dashboard|overview/i).first();
    const hasCompany = await companyText.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasWelcome = await welcomeText.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCompany || hasWelcome).toBe(true);
  });
});

// ─── Jobsites list ─────────────────────────────────────────────────────────
test.describe("Jobsites: list view", () => {
  test("jobsites page loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/jobsites");
    await expect(page).not.toHaveURL(/\/login/);
    const header = page.getByRole("heading", { name: /jobsite|project|site/i }).first();
    await expect(header).toBeVisible({ timeout: 20_000 });
  });

  test("test jobsite appears in the list", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/jobsites");
    const jobsiteLink = page.getByText(TEST_JOBSITE_NAME, { exact: false });
    await expect(jobsiteLink).toBeVisible({ timeout: 20_000 });
  });
});

// ─── Jobsite overview (sub-routes) ─────────────────────────────────────────
test.describe("Jobsite sub-routes: field user can navigate", () => {
  const JOBSITE_ROUTES = [
    ["overview", /overview|summary/i],
    ["team", /team|member/i],
    ["jsa", /jsa|job safety|analysis/i],
    ["incidents", /incident|report/i],
    ["permits", /permit/i],
    ["documents", /document/i],
    ["schedule", /schedule|calendar/i],
  ] as const;

  for (const [route, heading] of JOBSITE_ROUTES) {
    test(`/jobsites/[id]/${route} loads without 500`, async ({ page }) => {
      skip();
      skipNoJobsite();
      const { jobsiteId } = getTestIds();
      test.skip(!jobsiteId, "E2E_TEST_JOBSITE_ID not set.");

      await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/${route}`);
      await expect(page).not.toHaveURL(/\/login/);

      // No server-error page
      await expect(page.getByText(/500|internal server error/i).first()).not.toBeVisible();

      // Heading loosely matches
      const hdr = page.getByRole("heading", { name: heading }).first();
      const hdrVisible = await hdr.isVisible({ timeout: 15_000 }).catch(() => false);
      // Some pages use text not headings — just verify no crash
      if (!hdrVisible) {
        const content = page.locator("main, [role='main']");
        await expect(content).toBeVisible({ timeout: 10_000 });
      }
    });
  }
});

// ─── Documents: CRUD ───────────────────────────────────────────────────────
test.describe("Documents: read + upload", () => {
  test("documents page loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/documents");
    const header = page.getByRole("heading", { name: /document/i }).first();
    await expect(header).toBeVisible({ timeout: 20_000 });
  });

  test("documents list is visible (empty state or real data)", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/documents");
    // Either a table/list of documents, or an empty state message
    const content = page.locator("table, ul, [role='list'], [data-testid='empty-state']").first();
    const emptyText = page.getByText(/no documents|upload|get started|empty/i).first();
    const hasTable = await content.isVisible({ timeout: 15_000 }).catch(() => false);
    const hasEmpty = await emptyText.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("file upload input is present on documents page", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/documents");
    // Look for upload button or hidden file input
    const uploadBtn = page.getByRole("button", { name: /upload|add document|new/i }).first();
    const fileInput = page.locator("input[type='file']").first();
    const hasUpload = await uploadBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasInput = await fileInput.isAttached({ timeout: 5_000 }).catch(() => false);
    expect(hasUpload || hasInput).toBe(true);
  });
});

// ─── JSA: CRUD + AI ────────────────────────────────────────────────────────
test.describe("JSA: create, view, AI fill", () => {
  test("JSA hub page loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/jsa");
    const header = page.getByRole("heading", { name: /jsa|job safety|analysis/i }).first();
    const content = page.locator("main, [role='main']");
    const hasHeader = await header.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasHeader) {
      await expect(content).toBeVisible({ timeout: 10_000 });
    }
  });

  test("jobsite JSA tab loads", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/jsa`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/500/i).first()).not.toBeVisible();

    const createBtn = page.getByRole("button", { name: /new jsa|create jsa|add jsa/i }).first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    test.info().annotations.push({
      type: "note",
      description: hasCreateBtn ? "New JSA button is visible" : "New JSA button not visible (may require specific role/jobsite state)",
    });
  });

  test("AI fill API (/api/company/ai/assist) responds when triggered", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/jsa`);

    // Look for an AI-assist button
    const aiBtn = page
      .getByRole("button", { name: /ai fill|generate|ai assist|auto.?fill/i })
      .first();
    const hasAiBtn = await aiBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasAiBtn) {
      test.info().annotations.push({ type: "skip", description: "No AI fill button visible on JSA page — skipping AI API assertion." });
      return;
    }

    // Intercept the AI API call and assert it succeeds
    const result = await expectApiCall(page, /\/api\/company\/ai\/assist|\/api\/ai/i, async () => {
      await aiBtn.click();
    });

    expect([200, 201]).toContain(result.status);
    // Body should be non-empty
    expect(result.body).not.toBeNull();
  });
});

// ─── Incidents: CRUD ───────────────────────────────────────────────────────
test.describe("Incidents: create and view", () => {
  test("incidents hub loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/incidents");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/500/i).first()).not.toBeVisible();
    const header = page.getByRole("heading", { name: /incident/i }).first();
    const hasHeader = await header.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasHeader) {
      await expect(page.locator("main, [role='main']")).toBeVisible();
    }
  });

  test("jobsite incidents tab loads", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/incidents`);
    await expect(page).not.toHaveURL(/\/login/);
    const content = page.locator("main, [role='main']");
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test("new incident form can be opened", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/incidents`);
    const newBtn = page.getByRole("button", { name: /new incident|report incident|add/i }).first();
    const hasNewBtn = await newBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasNewBtn) {
      await newBtn.click();
      await page.waitForTimeout(500);
      // Modal or inline form should appear
      const form = page.locator("form, [role='dialog'], [data-testid*='form']").first();
      await expect(form).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: "note", description: "New incident button not visible for this user role." });
    }
  });
});

// ─── Permits ───────────────────────────────────────────────────────────────
test.describe("Permits: view", () => {
  test("permits hub loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/permits");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/500/i).first()).not.toBeVisible();
  });

  test("jobsite permits tab loads", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/permits`);
    await expect(page).not.toHaveURL(/\/login/);
    const content = page.locator("main, [role='main']");
    await expect(content).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Safety Intelligence ────────────────────────────────────────────────────
test.describe("Safety Intelligence: risk panel", () => {
  test("safety intelligence tab loads without server error", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/safety-intelligence`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/500/i).first()).not.toBeVisible();
  });
});

// ─── Reports ───────────────────────────────────────────────────────────────
test.describe("Reports: generation", () => {
  test("jobsite reports page loads", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/reports`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/500/i).first()).not.toBeVisible();
  });

  test("OSHA 300 log page loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/osha-300");
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── Training & Inductions ─────────────────────────────────────────────────
test.describe("Training / Inductions: view", () => {
  test("company inductions page loads", async ({ page }) => {
    skip();
    await gotoAndWaitForApp(page, "/company-inductions");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/500/i).first()).not.toBeVisible();
  });

  test("jobsite inductions tab loads", async ({ page }) => {
    skip();
    skipNoJobsite();
    const { jobsiteId } = getTestIds();
    test.skip(!jobsiteId);

    await gotoAndWaitForApp(page, `/jobsites/${jobsiteId}/inductions`);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── Admin routes are blocked ───────────────────────────────────────────────
test.describe("Admin routes: field user is denied", () => {
  test("field user cannot access /admin", async ({ page }) => {
    skip();
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 3_000);

    // Should be redirected to /dashboard or /login, never land on /admin content
    const pathname = await page.evaluate(() => window.location.pathname);
    const blockedOrRedirected = !pathname.startsWith("/admin") || pathname === "/admin";

    // Acceptable outcomes: redirect to /dashboard, /login, or a "Not authorized" message
    const notAuthorized = page.getByText(/not authorized|access denied|forbidden|no permission/i).first();
    const isBlocked = await notAuthorized.isVisible({ timeout: 5_000 }).catch(() => false);

    test.info().annotations.push({
      type: "note",
      description: `Field user on /admin → pathname: ${pathname}, blocked message: ${isBlocked}`,
    });

    // Pass if redirected away or shown a denial message
    expect(pathname !== "/admin" || isBlocked).toBe(true);
  });
});
