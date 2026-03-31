import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

test.describe("Training matrix", () => {
  test.beforeEach(() => {
    test.skip(
      !hasE2ECredentials(),
      "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD. Use a user with training-matrix access (e.g. company_admin, manager, safety_manager, or project_manager)."
    );
  });

  test("page loads for authorized workspace users", async ({ page }) => {
    await page.goto("/training-matrix", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/training-matrix");

    const onMatrix = page.url().includes("/training-matrix");
    const redirected = page.url().includes("/dashboard");
    expect(onMatrix || redirected, `unexpected URL after training-matrix: ${page.url()}`).toBeTruthy();

    if (onMatrix) {
      await expect(page.getByText("Training matrix", { exact: false }).first()).toBeVisible({
        timeout: 25_000,
      });
    }
  });

  test("reload preserves session and does not blank the app", async ({ page }) => {
    await page.goto("/training-matrix", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/training-matrix before reload");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/training-matrix after reload");
    await expect(page.locator("body")).toBeVisible();
  });
});
