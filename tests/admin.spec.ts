import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { clearClientAuthState } from "./helpers/storage";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

test.describe("Admin routes without session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, context }) => {
    await clearClientAuthState(page, context);
  });

  test("/admin redirects unauthenticated users away from the workspace", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
  });
});

test.describe("Admin shell (authenticated)", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  });

  test("admin area loads or redirects to an allowed workspace route", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/admin");
    const url = page.url();
    expect(
      url.includes("/admin") || url.includes("/dashboard"),
      `expected /admin or post-redirect dashboard, got ${url}`
    ).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin users listing route returns a page", async ({ page }) => {
    const response = await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    expect(response!.status()).toBeLessThan(500);
    await expectAuthenticatedShellUrl(page, "/admin/users");
    await expect(page.locator("body")).toBeVisible();
  });

  test("refresh on /admin/users keeps session", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/admin/users before reload");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/admin/users after reload");
  });
});
