import { expect, test } from "@playwright/test";

test.describe("legacy SafePredict routes", () => {
  const redirects = [
    ["/safe-predict", "/dashboard"],
    ["/safe-predict/jobsites", "/jobsites"],
    ["/safe-predict/jobsites/riverside", "/jobsites/riverside/overview"],
    ["/safe-predict/predictive-risk", "/analytics/predictive-model"],
    ["/safe-predict/risk-mitigation", "/field-id-exchange"],
    ["/safe-predict/incidents", "/incidents"],
    ["/safe-predict/observations", "/safety-submit"],
    ["/safe-predict/corrective-actions", "/field-id-exchange"],
    ["/safe-predict/inspections", "/field-audits"],
    ["/safe-predict/hazards", "/safety-intelligence"],
    ["/safe-predict/workforce", "/company-users"],
    ["/safe-predict/training", "/training-matrix"],
    ["/safe-predict/permits", "/permits"],
    ["/safe-predict/analytics", "/analytics"],
    ["/safe-predict/reports", "/reports"],
    ["/safe-predict/platform-actions", "/command-center"],
    ["/safe-predict/settings", "/settings/risk-memory"],
  ] as const;

  for (const [from, to] of redirects) {
    test(`${from} redirects to ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      expect(response.headers().location).toContain(to);
    });
  }
});
