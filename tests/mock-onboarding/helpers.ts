/**
 * Shared helpers for the mock-onboarding E2E suite.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { acceptAgreementIfPresent } from "../helpers/auth";

export const TEST_COMPANY_NAME = "TEST_E2E Mock Construction Co";
export const TEST_JOBSITE_NAME = "TEST_E2E Alpha Site";

/** IDs injected by the seed script (set these in .env.local after seeding). */
export function getTestIds() {
  return {
    companyId: process.env.E2E_TEST_COMPANY_ID ?? "",
    jobsiteId: process.env.E2E_TEST_JOBSITE_ID ?? "",
    adminEmail: process.env.E2E_COMPANY_ADMIN_EMAIL ?? "test-admin-e2e@safety360.test",
    fieldEmail: process.env.E2E_FIELD_USER_EMAIL ?? "test-field-e2e@safety360.test",
  };
}

/** Navigates to a page and waits for it to not be on /login. */
export async function gotoAndWaitForApp(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await acceptAgreementIfPresent(page);
  // Dismiss product tour overlay if it appears (intercepts pointer events)
  const tourBtn = page.getByRole("button", { name: "Skip tour" });
  const hasTour = await tourBtn.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
  if (hasTour) {
    await page.keyboard.press("Escape");
    await tourBtn.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
  }
  // Give client-side navigation a moment to resolve
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
}

/** Waits for a heading (or text) to appear, fails with a clear message on timeout. */
export async function expectHeading(page: Page, pattern: RegExp | string, timeout = 20_000) {
  const loc = page.getByRole("heading", { name: pattern }).or(
    page.getByText(pattern, { exact: false }).first()
  );
  await expect(loc).toBeVisible({ timeout });
}

/** Fills a labelled input by its label text (or placeholder). */
export async function fillInput(page: Page, label: string | RegExp, value: string) {
  const input = page.getByLabel(label).or(page.getByPlaceholder(label as string)).first();
  await input.fill(value);
}

/** Clicks a button matching the label. */
export async function clickButton(page: Page, label: string | RegExp) {
  await page.getByRole("button", { name: label }).first().click();
}

/**
 * Watches for a network request matching urlPattern during the action, and asserts it succeeds.
 * Returns the parsed JSON body of the first matching response.
 */
export async function expectApiCall(
  page: Page,
  urlPattern: string | RegExp,
  action: () => Promise<void>
): Promise<{ status: number; body: unknown }> {
  const responsePromise = page.waitForResponse(
    (res) => {
      const url = res.url();
      return typeof urlPattern === "string" ? url.includes(urlPattern) : urlPattern.test(url);
    },
    { timeout: 45_000 }
  );

  await action();

  const response = await responsePromise;
  const status = response.status();
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => null);
  }
  return { status, body };
}

/** Dismisses any open modal/drawer with Escape. */
export async function dismissModal(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
