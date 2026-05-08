import { expect, test } from "@playwright/test";

test.describe("SafePredict beta platform routes", () => {
  const redirects = [
    ["/dashboard", "/safe-predict"],
    ["/jobsites", "/safe-predict/jobsites"],
    ["/jobsites/riverside/permits", "/safe-predict/jobsites/riverside"],
    ["/analytics/predictive-model", "/safe-predict/predictive-risk"],
    ["/field-id-exchange", "/safe-predict/corrective-actions"],
    ["/incidents", "/safe-predict/incidents"],
    ["/safety-submit", "/safe-predict/observations"],
    ["/field-audits", "/safe-predict/inspections"],
    ["/safety-intelligence", "/safe-predict/hazards"],
    ["/company-users", "/safe-predict/workforce"],
    ["/training-matrix", "/safe-predict/training"],
    ["/permits", "/safe-predict/permits"],
    ["/analytics", "/safe-predict/analytics"],
    ["/reports", "/safe-predict/reports"],
    ["/command-center", "/safe-predict"],
    ["/settings/risk-memory", "/safe-predict/settings"],
  ] as const;

  test("loads the beta platform shell directly", async ({ page }) => {
    await page.goto("/safe-predict", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /SafetyDoc360/ }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back, John." })).toBeVisible();
  });

  for (const [from, to] of redirects) {
    test(`${from} redirects to ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      expect(response.headers().location).toContain(to);
    });
  }
});
