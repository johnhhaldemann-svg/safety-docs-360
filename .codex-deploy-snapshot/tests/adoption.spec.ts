import { test, expect } from "./fixtures";
import { hasE2ECredentials } from "./helpers/auth";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

test.describe("Adoption public path", () => {
  test("marketing page exposes the three primary adoption CTAs", async ({ page }) => {
    await page.goto("/marketing", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Safety operations command center/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Book Demo" }).first()).toHaveAttribute("href", /mailto:/);
    await expect(page.getByRole("link", { name: "Request Company Workspace" }).first()).toHaveAttribute(
      "href",
      "/company-signup"
    );
    await expect(page.getByRole("link", { name: "Open Workspace" }).first()).toHaveAttribute("href", "/login");
  });

  test("company signup shows the pending approval success path", async ({ page }) => {
    await page.route("**/api/auth/company-register", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Company account submitted.",
          warning: "Internal approval is pending.",
        }),
      });
    });

    await page.goto("/company-signup", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Company name").fill("Acme Safety");
    await page.getByLabel("Industry").fill("Construction");
    await page.getByLabel("Company phone").fill("555-0100");
    await page.getByLabel("Address line 1").fill("100 Main Street");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State or region").fill("TX");
    await page.getByLabel("Postal code").fill("78701");
    await page.getByLabel("Country").fill("USA");
    await page.getByLabel("Owner full name").fill("Jordan Safety");
    await page.getByLabel("Owner email").fill("owner@example.com");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("correct-horse-battery-staple");
    await page.getByLabel("Confirm password").fill("correct-horse-battery-staple");
    await page.getByLabel(/I agree to the Terms/i).check();
    await expect(page.getByLabel("City")).toHaveValue("Austin");
    await page.getByRole("button", { name: "Create Company Account" }).click();

    await expect(page.getByText("Company account submitted. Internal approval is pending.")).toBeVisible();
  });
});

test.describe("Adoption authenticated path", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated adoption tests.");
  });

  test("Command Center is reachable and shows the launch checklist", async ({ page }) => {
    await page.goto("/command-center", { waitUntil: "domcontentloaded" });
    await expectAuthenticatedShellUrl(page, "/command-center");
    await expect(page.getByText("Workspace launch checklist")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Complete company profile")).toBeVisible();
  });
});
