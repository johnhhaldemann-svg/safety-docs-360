import type { Page } from "@playwright/test";

/** E2E: with E2E_USER_EMAIL/PASSWORD, authenticated flows can open /dashboard or /documents; company AI panels POST to /api/company/ai/assist only after user clicks Ask. */

export const E2E_ROLE_AUTH = {
  companyAdmin: {
    label: "company admin",
    emailEnv: "E2E_COMPANY_ADMIN_EMAIL",
    passwordEnv: "E2E_COMPANY_ADMIN_PASSWORD",
    storageState: "playwright/.auth/company-admin.json",
  },
  fieldUser: {
    label: "field user",
    emailEnv: "E2E_FIELD_USER_EMAIL",
    passwordEnv: "E2E_FIELD_USER_PASSWORD",
    storageState: "playwright/.auth/field-user.json",
  },
  superadmin: {
    label: "superadmin",
    emailEnv: "E2E_SUPERADMIN_EMAIL",
    passwordEnv: "E2E_SUPERADMIN_PASSWORD",
    storageState: "playwright/.auth/superadmin.json",
  },
} as const;

export type E2ERoleKey = keyof typeof E2E_ROLE_AUTH;

export function hasE2ECredentials(): boolean {
  return Boolean(process.env.E2E_USER_EMAIL?.trim() && process.env.E2E_USER_PASSWORD);
}

export function hasRoleE2ECredentials(role: E2ERoleKey): boolean {
  const config = E2E_ROLE_AUTH[role];
  return Boolean(process.env[config.emailEnv]?.trim() && process.env[config.passwordEnv]);
}

/**
 * Accepts the platform agreement gate when it is visible.
 */
export async function acceptAgreementIfPresent(
  page: Page,
  timeout = 5_000
): Promise<boolean> {
  const accept = page.getByRole("button", { name: "Accept & Continue" });

  try {
    await accept.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }

  await accept.click();
  await accept.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  return true;
}

/**
 * Completes the login form and optional first-run agreement gate.
 */
export async function performLogin(
  page: Page,
  opts: { email: string; password: string }
): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Login" }).first().click();
  await page.getByPlaceholder("name@company.com").fill(opts.email);
  await page.locator("input[type='password']").first().fill(opts.password);
  await page.getByRole("button", { name: "Access Workspace" }).click();

  // Leave /login (router.push) or show `data-testid="login-error"` — both are visible in the
  // page context; `waitForURL` is unreliable for App Router client transitions.
  try {
    await page.waitForFunction(
      () => {
        const p = window.location.pathname;
        if (p !== "/login" && !p.startsWith("/login/")) return true;
        const el = document.querySelector("[data-testid=\"login-error\"]");
        return Boolean(el?.textContent?.trim());
      },
      null,
      { timeout: 45_000 }
    );
  } catch (e) {
    const msg = await page.getByTestId("login-error").textContent().catch(() => null);
    if (msg?.trim()) {
      throw new Error(`Login failed (still on /login): ${msg.trim()}`);
    }
    throw e;
  }

  const stillOnLogin = await page.evaluate(() => {
    const p = window.location.pathname;
    return p === "/login" || p.startsWith("/login/");
  });
  if (stillOnLogin) {
    const msg = (await page.getByTestId("login-error").textContent())?.trim();
    throw new Error(`Login failed (still on /login): ${msg || "unknown error"}`);
  }

  await acceptAgreementIfPresent(page);
}

export async function performLogout(page: Page): Promise<void> {
  let logout = page.getByRole("button", { name: /log\s*out/i });
  const canLogoutFromCurrentPage = await logout
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!canLogoutFromCurrentPage) {
    await page.goto("/safe-predict", { waitUntil: "domcontentloaded" });
    await acceptAgreementIfPresent(page, 2_500);
    logout = page.getByRole("button", { name: /log\s*out/i });
  }

  await logout.click();
  await page.waitForFunction(
    () => {
      const p = window.location.pathname;
      return p === "/login" || p.startsWith("/login/");
    },
    null,
    { timeout: 20_000 }
  );
}
