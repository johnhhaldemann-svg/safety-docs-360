import { expect, test } from "@playwright/test";

test.describe("SafePredict launch workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/safe-predict", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.clear());
  });

  test("jobsite card opens the command center and tabs respond", async ({ page }) => {
    await page.goto("/safe-predict/jobsites", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await page.getByTestId("safe-predict-jobsite-card-riverside").click();
    await expect(page).toHaveURL(/\/safe-predict\/jobsites\/riverside$/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Riverside Commercial Tower" })).toBeVisible();

    const permitsTab = page.getByRole("button", { name: "Permits" });
    await permitsTab.click();
    await expect(permitsTab).toHaveClass(/bg-blue-600/);

    const incidentsTab = page.getByRole("button", { name: "Incidents & Observations" });
    await incidentsTab.click();
    await expect(incidentsTab).toHaveClass(/bg-blue-600/);
    await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Observations" })).toBeVisible();
  });

  test("risk mitigation queue, action board, filters, and export respond", async ({ page }) => {
    await page.goto("/safe-predict/risk-mitigation", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Risk Mitigation Workspace" })).toBeVisible();
    await page.getByRole("button", { name: /Filtered Alerts/i }).click();
    await expect(page.locator("p").filter({ hasText: "Filtered alerts" })).toBeVisible();

    await page.locator("#prioritized-risk-queue").getByRole("button", { name: /Machine Guarding Bypass/i }).click();
    await expect(page.locator("#corrective-action-tracker")).toBeVisible();

    const statusSelect = page.getByLabel(/Change status for Update forklift traffic management plan/i);
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption("In Progress");
    await expect(statusSelect).toHaveValue("In Progress");

    await page.getByRole("button", { name: "Clear Filters" }).click();
    await page.getByRole("button", { name: "New Corrective Action" }).click();
    await expect(page.locator("#corrective-action-tracker").getByText(/Review .* controls/i).first()).toBeVisible();

    await expect(page.getByRole("button", { name: "Export corrective action report" })).toBeVisible();
  });

  test("native workspace filters and conversion action create a draft action", async ({ page }) => {
    await page.goto("/safe-predict/observations", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Observations" })).toBeVisible();
    await page.getByPlaceholder("Search observations...").fill("edge");
    const observationRow = page.getByRole("row", { name: /Unprotected edge/i });
    await expect(observationRow).toBeVisible();
    await observationRow.getByRole("button", { name: "Convert" }).click();

    await expect(page).toHaveURL(/\/safe-predict\/corrective-actions/);
    await expect(page.getByText(/Resolve unprotected edge/i)).toBeVisible();
  });

  test("core SafetyDoc360 routes keep logo, heatmaps, and responsive width", async ({ page }) => {
    const routes = [
      "/safe-predict",
      "/safe-predict/jobsites",
      "/safe-predict/jobsites/riverside",
      "/safe-predict/risk-mitigation",
      "/safe-predict/analytics",
    ];
    const viewports = [
      { width: 1440, height: 1000 },
      { width: 390, height: 900 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("link", { name: /SafetyDoc360/ }).filter({ visible: true }).first()).toBeVisible();
        await expect(page.locator('[data-testid$="heat-map"]').first()).toBeVisible();
        const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
        expect(hasHorizontalOverflow, `${route} should not overflow at ${viewport.width}px`).toBe(false);
      }
    }
  });

  test("all SafetyDoc360 operating routes load without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    const routes = [
      "/safe-predict",
      "/safe-predict/jobsites",
      "/safe-predict/jobsites/riverside",
      "/safe-predict/predictive-risk",
      "/safe-predict/risk-mitigation",
      "/safe-predict/incidents",
      "/safe-predict/observations",
      "/safe-predict/corrective-actions",
      "/safe-predict/inspections",
      "/safe-predict/hazards",
      "/safe-predict/workforce",
      "/safe-predict/training",
      "/safe-predict/permits",
      "/safe-predict/analytics",
      "/safe-predict/reports",
      "/safe-predict/platform-actions",
      "/safe-predict/settings",
    ];

    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("link", { name: /SafetyDoc360/ }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText("404");
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(hasHorizontalOverflow, `${route} should not overflow at desktop width`).toBe(false);
    }

    expect(consoleErrors).toEqual([]);
  });
});
