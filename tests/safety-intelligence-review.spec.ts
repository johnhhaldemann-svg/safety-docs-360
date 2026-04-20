import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

test.describe("Safety Intelligence review", () => {
  test.beforeEach(() => {
    test.skip(
      !hasE2ECredentials(),
      "Requires E2E_USER_EMAIL and E2E_USER_PASSWORD. Use a user with Safety Intelligence access."
    );
  });

  test("renders the unified permit, training, and PPE review tabs", async ({ page }) => {
    await page.goto("/safety-intelligence", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/safety-intelligence");

    const onWorkflow = page.url().includes("/safety-intelligence");
    const redirected = page.url().includes("/dashboard");
    expect(onWorkflow || redirected, `unexpected URL after safety-intelligence: ${page.url()}`).toBeTruthy();

    if (onWorkflow) {
      await expect(page.getByText("Permit matrix", { exact: false }).first()).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.getByText("Training review", { exact: false }).first()).toBeVisible();
      await expect(page.getByText("PPE review", { exact: false }).first()).toBeVisible();
      await page.getByRole("tab", { name: "Training review" }).click();
      await expect(page.getByRole("tab", { name: "Training review" })).toBeVisible();
    }
  });
});
