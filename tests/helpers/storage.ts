import type { BrowserContext, Page } from "@playwright/test";

/** Matches `playwright.config.ts` default when env is unset. */
export function playwrightBaseURL(): string {
  return (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

/**
 * Clears cookies and web storage so Supabase client session is gone.
 * Call before asserting protected-route redirects (localStorage survives empty `storageState` if a prior test touched the origin).
 */
export async function clearClientAuthState(page: Page, context: BrowserContext): Promise<void> {
  await context.clearCookies();
  const base = playwrightBaseURL();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore non-browser contexts */
    }
  });
}
