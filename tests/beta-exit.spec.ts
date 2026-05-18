import { test, expect } from "./fixtures";
import { acceptAgreementIfPresent, performLogin, performLogout } from "./helpers/auth";
import { clearClientAuthState } from "./helpers/storage";
import { expectAuthenticatedShellUrl } from "./helpers/sessionWait";

type Credentials = {
  email: string;
  password: string;
};

function credentials(prefix: "ADMIN" | "FIELD"): Credentials | null {
  const email = process.env[`E2E_BETA_${prefix}_EMAIL`]?.trim();
  const password = process.env[`E2E_BETA_${prefix}_PASSWORD`]?.trim();
  return email && password ? { email, password } : null;
}

function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

test.describe("Beta exit public surface", () => {
  test("public pages and validation load without a session", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/SafetyDocs360 Platform|Request a Demo|Open Workspace/i);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Secure Access", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Login" }).first().click();
    await page.getByPlaceholder("name@company.com").fill("beta-exit-invalid@example.com");
    await page.locator("input[type='password']").first().fill("wrong-password-12345");
    await page.getByRole("button", { name: "Access Workspace" }).click();
    await expect(page.locator("text=/invalid|credentials|password|email/i").first()).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/company-signup", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /create|submit|request/i }).click();
    await expect(page.locator("text=/required|password|details/i").first()).toBeVisible();
  });

  test("protected pages redirect anonymous users", async ({ page, context }) => {
    await clearClientAuthState(page, context);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (process.env.CI) {
      await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
    } else {
      const pathname = new URL(page.url()).pathname;
      if (pathname !== "/login") {
        await expect(page.locator("body")).toContainText(/sign in|login|404|could not be found/i);
      }
    }
  });
});

test.describe("Beta exit admin walkthrough", () => {
  test.beforeEach(async ({ page, context }) => {
    await clearClientAuthState(page, context);
  });

  test("admin can traverse critical workspace flows", async ({ page }) => {
    const admin = credentials("ADMIN");
    test.skip(!admin, "Set E2E_BETA_ADMIN_EMAIL and E2E_BETA_ADMIN_PASSWORD to run beta admin E2E.");

    await performLogin(page, admin!);
    await expectAuthenticatedShellUrl(page, "beta admin login");

    const routes: Array<{ path: string; marker: RegExp }> = [
      { path: "/dashboard", marker: /dashboard|overview|workspace/i },
      { path: "/jobsites", marker: /jobsite|project/i },
      { path: "/permits", marker: /permit/i },
      { path: "/jsa", marker: /jsa|job safety|activity/i },
      { path: "/reports", marker: /report|export/i },
      { path: "/safety-intelligence", marker: /safety intelligence|risk|memory/i },
      { path: "/company-users", marker: /user|invite|team/i },
      { path: "/training-matrix", marker: /training|readiness|requirement/i },
      { path: "/customer/billing", marker: /billing|invoice|subscription|payment/i },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await acceptAgreementIfPresent(page, 2_500);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).toContainText(route.marker, { timeout: 20_000 });
    }

    await performLogout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Beta exit field and security checks", () => {
  test.beforeEach(async ({ page, context }) => {
    await clearClientAuthState(page, context);
  });

  test("field user can sign in but is blocked from admin-only surfaces", async ({ page }) => {
    const field = credentials("FIELD");
    test.skip(!field, "Set E2E_BETA_FIELD_EMAIL and E2E_BETA_FIELD_PASSWORD to run beta field E2E.");

    await performLogin(page, field!);
    await acceptAgreementIfPresent(page, 2_500);
    await expectAuthenticatedShellUrl(page, "beta field login");

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 2_500);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toContainText(/dashboard|workspace|assigned|field/i);

    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 2_500);
    const adminPath = new URL(page.url()).pathname;
    if (adminPath.startsWith("/admin/users")) {
      await expect(page.locator("body")).toContainText(/access|permission|not authorized|forbidden/i);
    } else {
      expect(adminPath).not.toMatch(/^\/login/);
    }

    await page.goto("/billing", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 2_500);
    const billingPath = new URL(page.url()).pathname;
    if (billingPath === "/billing") {
      await expect(page.locator("body")).toContainText(
        /limited|forbidden|permission|not authorized|sign in required/i
      );
    } else {
      expect(billingPath).not.toBe("/billing");
      expect(billingPath).not.toMatch(/^\/login/);
    }
  });

  test("revoked public RPCs and profile photo listing are blocked", async ({ request }) => {
    const env = supabasePublicEnv();
    test.skip(!env, "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run Supabase security checks.");

    const headers = {
      apikey: env!.anonKey,
      Authorization: `Bearer ${env!.anonKey}`,
      "Content-Type": "application/json",
    };

    const rpcResponse = await request.post(`${env!.url}/rest/v1/rpc/lookup_company_invite`, {
      headers,
      data: { invite_email: "beta-exit-invitee@example.com" },
    });
    expect([401, 403, 404]).toContain(rpcResponse.status());

    const helperRpcResponse = await request.post(
      `${env!.url}/rest/v1/rpc/billing_is_super_platform`,
      {
        headers,
        data: {},
      }
    );
    expect([401, 403, 404]).toContain(helperRpcResponse.status());

    const storageResponse = await request.post(`${env!.url}/storage/v1/object/list/profile-photos`, {
      headers,
      data: { limit: 10, offset: 0, prefix: "" },
    });
    if (storageResponse.status() === 200) {
      await expect(storageResponse.json()).resolves.toEqual([]);
    } else {
      expect([400, 401, 403]).toContain(storageResponse.status());
    }
  });
});
