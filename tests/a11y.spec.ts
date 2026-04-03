import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function seriousViolations(violations: { impact?: string | null }[]) {
  return violations.filter((v) => v.impact === "critical" || v.impact === "serious");
}

test.describe("Accessibility (axe)", () => {
  test("marketing home has no critical or serious issues", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(seriousViolations(violations), JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("login has no critical or serious issues", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(seriousViolations(violations), JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("submit flow entry (redirects if unauthenticated) has no critical or serious issues", async ({
    page,
  }) => {
    await page.goto("/submit");
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(seriousViolations(violations), JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
