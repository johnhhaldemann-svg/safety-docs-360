import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { authenticatedSmokeRoutes, PUBLIC_ROUTES } from "./helpers/routes";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

test.describe("Public routes", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`GET ${path} responds and renders`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response, `navigation to ${path}`).toBeTruthy();
      expect(response!.status(), `${path} HTTP status`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test.describe("Whole app — authenticated route smoke", () => {
  test.beforeEach(() => {
    test.skip(
      !hasE2ECredentials(),
      "Set E2E_USER_EMAIL and E2E_USER_PASSWORD (and run global setup) for authenticated route tests."
    );
  });

  for (const path of authenticatedSmokeRoutes()) {
    test(`loads ${path}`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response, `navigation to ${path}`).toBeTruthy();
      expect(response!.status(), `${path} should not be 5xx`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expectAuthenticatedShellUrl(page, path);
    });
  }

  test("sidebar: every visible menu link stays in the authenticated shell", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/dashboard (sidebar start)");

    const links = page.locator("aside nav a[href^='/']");
    const count = await links.count();
    test.skip(count === 0, "No sidebar links found for this layout/role.");

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href");
      if (!href || href.startsWith("//")) continue;
      await link.click();
      await expectAuthenticatedShellUrl(page, `sidebar → ${href}`);
      await expect(page.locator("body")).toBeVisible();
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expectAuthenticatedShellUrl(page, "/dashboard (sidebar reset)");
    }
  });

  test("Command Center launches the Safety Intelligence workflow and companion analytics", async ({ page }) => {
    await page.goto("/command-center", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/command-center");

    await page.getByRole("link", { name: /Start Safety Intelligence workflow/i }).click();
    await expectAuthenticatedShellUrl(page, "/safety-intelligence");

    const tradeSelect = page.getByLabel("Trade");
    test.skip(
      (await tradeSelect.locator("option").count()) === 0,
      "Safety Intelligence trade library is not available for this workspace."
    );

    await page.getByLabel("Task").fill("E2E safety workflow check");
    await page.getByLabel("Field detail").fill("Temporary intake to verify the guided workflow from Command Center.");
    await page.getByLabel("Work area").fill("North deck");
    await page.getByLabel("Weather").fill("clear");
    await page.getByLabel("Start").fill("2026-04-14T08:00");
    await page.getByLabel("End").fill("2026-04-14T10:00");
    await page.getByRole("button", { name: "Bucket + evaluate" }).click();

    await expect(
      page.getByText(/Intake completed\. Rules and conflict evaluation are ready for document generation\./)
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole("button", { name: "Generate draft" }).click();
    await expect(
      page.getByText(/Document draft and risk outputs generated\. Review queue is ready for the next handoff\./)
    ).toBeVisible({ timeout: 45000 });

    await page.getByRole("link", { name: "View analytics" }).click();
    await expectAuthenticatedShellUrl(page, "/analytics/safety-intelligence");

    await page.getByRole("link", { name: "Command Center" }).click();
    await expectAuthenticatedShellUrl(page, "/command-center");
  });
});
