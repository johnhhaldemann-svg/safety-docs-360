import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

test.describe("Library", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  });

  test("loads document center heading", async ({ page }) => {
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/library");
    await expect(
      page.getByRole("heading", { name: /Find what you need faster|Open completed company documents/i })
    ).toBeVisible({ timeout: 25_000 });
  });

  test("refresh keeps user on library", async ({ page }) => {
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/library before reload");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/library after reload");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Submit request (form behavior)", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  });

  test("submit request stays disabled until legal checkbox when role can submit", async ({ page }) => {
    await page.goto("/submit", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/submit");

    const submitBtn = page.getByRole("button", { name: "Submit Request" });
    await expect(submitBtn).toBeVisible({ timeout: 25_000 });

    const roleBlocked = page.getByText(/cannot submit documents into the review queue/i);
    if (await roleBlocked.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: "note",
        description: "User role cannot submit — skipping agreement gate assertion.",
      });
      return;
    }

    const fieldset = page.locator("fieldset").filter({ has: page.getByText("Request Title") });
    const agreement = fieldset.locator('input[type="checkbox"]');
    await expect(agreement).toBeVisible({ timeout: 15_000 });
    await expect(submitBtn).toBeDisabled();
    await agreement.check();
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
  });
});
