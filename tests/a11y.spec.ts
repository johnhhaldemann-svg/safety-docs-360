import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PUBLIC_ROUTES } from "./helpers/routes";

function seriousViolations(violations: { impact?: string | null }[]) {
  return violations.filter((v) => v.impact === "critical" || v.impact === "serious");
}

async function expectVisibleFocusRing(page: Page, selector: string) {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  await target.focus();

  const focusStyle = await target.evaluate((node) => {
    const styles = window.getComputedStyle(node as HTMLElement);
    return {
      boxShadow: styles.boxShadow,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    };
  });

  const hasVisibleOutline =
    focusStyle.outlineStyle !== "none" &&
    focusStyle.outlineWidth !== "0px" &&
    focusStyle.outlineWidth !== "0";
  const hasVisibleShadow = focusStyle.boxShadow !== "none";
  expect(hasVisibleOutline || hasVisibleShadow).toBeTruthy();
}

test.describe("Accessibility (axe)", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`${path} has no critical or serious axe issues`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(seriousViolations(violations), JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }

  test("submit flow entry (redirects if unauthenticated) has no critical or serious issues", async ({
    page,
  }) => {
    await page.goto("/submit");
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(seriousViolations(violations), JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("marketing calls-to-action show visible keyboard focus", async ({ page }) => {
    await page.goto("/marketing");
    await page.waitForLoadState("domcontentloaded");
    await expectVisibleFocusRing(page, 'a[href="/login"]');
    await expectVisibleFocusRing(page, 'a[href="/#platform"]');
  });

  test("login form controls show visible keyboard focus", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expectVisibleFocusRing(page, 'input[placeholder="name@company.com"]');
    await expectVisibleFocusRing(page, 'input[placeholder="Enter password"]');
    await expectVisibleFocusRing(page, 'button:has-text("Access Workspace")');
  });

  test("company-signup inputs show visible keyboard focus", async ({ page }) => {
    await page.goto("/company-signup");
    await page.waitForLoadState("networkidle");
    await expectVisibleFocusRing(page, 'input[placeholder="Company name"]');
    await expectVisibleFocusRing(page, 'input[placeholder="Industry"]');
  });

  test("skip-to-main-content link is present and focusable on public routes", async ({
    page,
  }) => {
    for (const path of ["/", "/marketing", "/login"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      const skipLink = page.locator('a.app-skip-link[href="#main-content"]').first();
      await expect(skipLink).toHaveCount(1);

      const mainContent = page.locator("#main-content").first();
      await expect(mainContent).toHaveCount(1);

      await expectVisibleFocusRing(page, 'a.app-skip-link[href="#main-content"]');
    }
  });

});
