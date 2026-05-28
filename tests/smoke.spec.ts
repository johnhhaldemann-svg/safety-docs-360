import { test, expect } from "@playwright/test";
import { clearClientAuthState } from "./helpers/storage";

/**
 * Fast PR smoke: public pages and unauthenticated redirects.
 * Does not require E2E_USER_* secrets (unlike full authenticated suites).
 */
test.describe("PR smoke", () => {
  test("marketing home loads primary CTAs", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /open workspace/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("login page loads access portal", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Secure Access", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Access Workspace" })).toBeVisible();
  });

  const protectedRoutes = [
    "/safe-predict",
    "/safe-predict/documents",
    "/safe-predict/permits",
    "/dashboard",
    "/documents",
  ] as const;

  for (const path of protectedRoutes) {
    test(`${path} redirects unauthenticated users to login`, async ({ page, context }) => {
      await clearClientAuthState(page, context);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login(?:$|[/?#])/, { timeout: 25_000 });
    });
  }

  const publicRoutes = ["/", "/marketing", "/login", "/company-signup", "/terms", "/privacy"] as const;

  for (const path of publicRoutes) {
    test(`${path} remains public`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/\/login\?redirectedFrom=/);
    });
  }
});
