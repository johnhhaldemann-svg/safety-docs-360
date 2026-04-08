import { test, expect } from "./fixtures";
import { performLogin, performLogout } from "./helpers/auth";
import { clearClientAuthState } from "./helpers/storage";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

function getAuthSmokeCredentials() {
  const email = process.env.E2E_AUTH_USER_EMAIL?.trim() || process.env.E2E_USER_EMAIL?.trim();
  const password = process.env.E2E_AUTH_USER_PASSWORD?.trim() || process.env.E2E_USER_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

test.describe("Login page", () => {
  test("loads secure access portal", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Secure Access", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Access Workspace" })).toBeVisible();
  });

  test("rejects invalid credentials with a visible message", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Login" }).first().click();
    await page.getByPlaceholder("name@company.com").fill("e2e-invalid-not-a-user@example.com");
    await page.locator("input[type='password']").first().fill("wrong-password-12345");
    await page.getByRole("button", { name: "Access Workspace" }).click();
    await expect(page.locator("text=/invalid|credentials|password|email/i").first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe("Authenticated session", () => {
  test("login and logout round-trip", async ({ page }) => {
    const credentials = getAuthSmokeCredentials();
    test.skip(!credentials, "Set E2E_AUTH_USER_EMAIL and E2E_AUTH_USER_PASSWORD to run this test.");

    const { email, password } = credentials!;

    await performLogin(page, { email, password });
    await expectAuthenticatedShellUrl(page, "after login");

    await performLogout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Protected routes (no saved session)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, context }) => {
    await clearClientAuthState(page, context);
  });

  test("dashboard sends unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
  });

  test("library sends unauthenticated users to login", async ({ page }) => {
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
  });
});
