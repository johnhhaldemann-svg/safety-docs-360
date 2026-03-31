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
});
