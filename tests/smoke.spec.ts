import { test, expect } from "@playwright/test";

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

  test("dashboard redirects unauthenticated users to a public entry point", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/(login|safe-predict)(?:$|[/?#])/, { timeout: 25_000 });
  });
});
