import { expect, test } from "@playwright/test";
import { clearClientAuthState } from "./helpers/storage";

test.describe("SafePredict beta platform routes", () => {
  const protectedRoutes = [
    "/safe-predict",
    "/safe-predict/documents",
    "/safe-predict/jobsites",
    "/safe-predict/permits",
    "/safe-predict/reports",
    "/dashboard",
    "/documents",
    "/jobsites",
    "/jobsites/riverside/permits",
    "/analytics/predictive-model",
    "/field-id-exchange",
    "/safety-submit",
    "/field-audits",
    "/safety-intelligence",
    "/permits",
    "/incidents",
    "/analytics",
    "/reports",
    "/csep",
    "/peshep",
    "/command-center",
    "/settings/risk-memory",
  ] as const;

  test("protects the beta platform shell from anonymous users", async ({ page, context }) => {
    await clearClientAuthState(page, context);
    await page.goto("/safe-predict", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:$|[/?#])/, { timeout: 25_000 });
  });

  for (const route of protectedRoutes) {
    test(`${route} redirects anonymous users to login`, async ({ page, context }) => {
      await clearClientAuthState(page, context);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login(?:$|[/?#])/, { timeout: 25_000 });
    });
  }

  test("protects the canonical training matrix path", async ({ page, context }) => {
    await clearClientAuthState(page, context);
    await page.goto("/training-matrix", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:$|[/?#])/, { timeout: 25_000 });
  });

  test("keeps the canonical team access route in the app shell", async ({ request }) => {
    const response = await request.get("/company-users", { maxRedirects: 0 });
    expect([200, 307, 401]).toContain(response.status());
    expect(response.headers().location ?? "").not.toContain("/safe-predict/workforce");
  });
});
