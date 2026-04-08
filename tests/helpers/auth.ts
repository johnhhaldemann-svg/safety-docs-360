import type { Page } from "@playwright/test";

/** E2E: with E2E_USER_EMAIL/PASSWORD, authenticated flows can open /dashboard or /library; company AI panels POST to /api/company/ai/assist only after user clicks Ask. */

export function hasE2ECredentials(): boolean {
  return Boolean(process.env.E2E_USER_EMAIL?.trim() && process.env.E2E_USER_PASSWORD);
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

  const accept = page.getByRole("button", { name: "Accept & Continue" });
  try {
    await accept.waitFor({ state: "visible", timeout: 5000 });
    await accept.click();
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  } catch {
    // No agreement gate for this user
  }
}

export async function performLogout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForFunction(
    () => {
      const p = window.location.pathname;
      return p === "/login" || p.startsWith("/login/");
    },
    null,
    { timeout: 20_000 }
  );
}
