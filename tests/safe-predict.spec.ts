import { expect, test } from "@playwright/test";

test.describe("SafePredict beta platform routes", () => {
  const redirects = [
    ["/dashboard", "/safe-predict"],
    ["/jobsites", "/safe-predict/jobsites"],
    ["/jobsites/riverside/permits", "/safe-predict/jobsites/riverside"],
    ["/analytics/predictive-model", "/safe-predict/predictive-risk"],
    ["/field-id-exchange", "/safe-predict/corrective-actions"],
    ["/safety-submit", "/safe-predict/observations"],
    ["/field-audits", "/safe-predict/inspections"],
    ["/safety-intelligence", "/safe-predict/hazards"],
    ["/permits", "/safe-predict/permits"],
    ["/incidents", "/safe-predict/incidents"],
    ["/analytics", "/safe-predict/analytics"],
    ["/reports", "/safe-predict/reports"],
    ["/csep", "/safe-predict/csep"],
    ["/peshep", "/safe-predict/peshep"],
    ["/command-center", "/safe-predict"],
    ["/settings/risk-memory", "/safe-predict/risk-memory"],
  ] as const;

  test("loads the beta platform shell directly", async ({ page }) => {
    await page.goto("/safe-predict", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /SafePredict/ }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "SafePredict Command Center" })).toBeVisible();
  });

  test("shows grounded reasons when a predictive risk point is selected", async ({ page }) => {
    await page.goto("/safe-predict", { waitUntil: "domcontentloaded" });

    const reasonPanel = page.getByTestId("forecast-risk-reason-panel");
    if (await reasonPanel.isVisible().catch(() => false)) {
      const initialReason = await reasonPanel.textContent();
      await page.getByTestId("forecast-risk-point").first().click();

      await expect.poll(async () => reasonPanel.textContent()).not.toBe(initialReason);
      await expect(reasonPanel).toContainText("Selected point:");
      await expect(reasonPanel).toContainText(/\/100/);
      await expect(reasonPanel).toContainText(/review|verify|monitor/i);
      return;
    }

    await expect(page.getByText("No live forecast yet")).toBeVisible();
    await expect(page.getByText(/before SafePredict shows a predictive/)).toBeVisible();
  });

  for (const [from, to] of redirects) {
    test(`${from} redirects to ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      expect(response.headers().location).toContain(to);
    });
  }

  test("routes the canonical training matrix path to the SafePredict tracker", async ({ request }) => {
    const response = await request.get("/training-matrix", { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(response.headers().location ?? "").toContain("/safe-predict/training-tracker");
  });

  test("keeps the canonical team access route in the app shell", async ({ request }) => {
    const response = await request.get("/company-users", { maxRedirects: 0 });
    expect([200, 307, 401]).toContain(response.status());
    expect(response.headers().location ?? "").not.toContain("/safe-predict/workforce");
  });
});
