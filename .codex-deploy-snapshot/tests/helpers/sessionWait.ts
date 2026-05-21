import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function isLoginPathname(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

/**
 * Waits until the URL is not `/login`. The app layout can briefly send users there while
 * Supabase restores the session from storage; `/admin` may then redirect to `/dashboard`
 * for users without internal admin access.
 */
export async function expectAuthenticatedShellUrl(page: Page, hint: string) {
  await expect
    .poll(() => !isLoginPathname(pathnameOf(page.url())), {
      timeout: 30_000,
      intervals: [50, 100, 200, 400, 600, 1000],
      message: `${hint}: still on /login after navigation — check E2E storage state and credentials.`,
    })
    .toBe(true);
}
