import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserContext, Page, Response } from "@playwright/test";
import { test, expect } from "./fixtures";
import { E2E_ROLE_AUTH, hasRoleE2ECredentials, type E2ERoleKey } from "./helpers/auth";
import { discoverAppPageRoutes, normalizeRouteForCoverage } from "./helpers/pageRouteInventory";
import { PUBLIC_ROUTES, authenticatedSmokeRoutes } from "./helpers/routes";

type RouteResult = {
  route: string;
  role: "public" | E2ERoleKey;
  finalUrl: string;
  status: number | null;
  ok: boolean;
  denied: boolean;
  bodyLength: number;
  failures: string[];
  consoleMessages: string[];
  networkIssues: Array<{ method: string; url: string; status?: number; failure?: string }>;
};

type CoverageResult = {
  discoveredPageRoutes: string[];
  knownPageRoutes: string[];
  missingRouteCoverage: string[];
};

const roleRoutes = authenticatedSmokeRoutes();
const coverage: CoverageResult = {
  discoveredPageRoutes: discoverAppPageRoutes(),
  knownPageRoutes: [...new Set([...PUBLIC_ROUTES, ...roleRoutes].map(normalizeRouteForCoverage))].sort((a, b) =>
    a.localeCompare(b)
  ),
  missingRouteCoverage: [],
};
coverage.missingRouteCoverage = coverage.discoveredPageRoutes.filter(
  (route) => !coverage.knownPageRoutes.includes(normalizeRouteForCoverage(route))
);

const routeResults: RouteResult[] = [];
const missingRoleStorageStates: string[] = [];

function reportPath() {
  const dir = process.env.ROUTE_OPERABILITY_REPORT_DIR || join(tmpdir(), "safety-docs-360-route-operability");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(dir, `route-operability-${stamp}.json`);
}

function isExpectedDenied(status: number | null, bodyText: string) {
  return (
    status === 401 ||
    status === 403 ||
    /\b(access denied|forbidden|not authorized|unauthorized|permission required)\b/i.test(bodyText)
  );
}

async function hasFrameworkOverlay(page: Page) {
  const selectors = [
    "nextjs-portal",
    "[data-nextjs-dialog-overlay]",
    "[data-nextjs-dialog]",
    "text=/Unhandled Runtime Error|Build Error|Application error|Runtime Error/i",
  ];
  for (const selector of selectors) {
    const visible = await page.locator(selector).first().isVisible({ timeout: 500 }).catch(() => false);
    if (visible) return true;
  }
  return false;
}

async function routeStatus(page: Page, route: string) {
  let response: Response | null = null;
  try {
    response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch {
    response = null;
  }
  return response;
}

async function checkRoute(page: Page, route: string, role: RouteResult["role"]): Promise<RouteResult> {
  const failures: string[] = [];
  const consoleMessages: string[] = [];
  const networkIssues: RouteResult["networkIssues"] = [];

  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const text = message.text();
    if (text.includes("webpack-hmr") || text.includes("_next/webpack-hmr")) return;
    consoleMessages.push(`[${message.type()}] ${text}`);
  });
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    networkIssues.push({
      method: request.method(),
      url: request.url(),
      failure: failure?.errorText ?? "unknown",
    });
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;
    const request = response.request();
    const resourceType = request.resourceType();
    if (!["document", "fetch", "xhr", "other"].includes(resourceType)) return;
    networkIssues.push({ method: request.method(), url: response.url(), status });
  });

  const response = await routeStatus(page, route);
  const status = response?.status() ?? null;
  if (!response) failures.push("navigation did not return a response");
  if (status != null && status >= 500) failures.push(`document returned HTTP ${status}`);

  let bodyText = "";
  try {
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    bodyText = (await page.locator("body").innerText({ timeout: 15_000 })).trim();
  } catch (error) {
    failures.push(`body did not become visible: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (bodyText.length < 20) failures.push(`body text is too short (${bodyText.length} chars)`);
  if (await hasFrameworkOverlay(page)) failures.push("framework error overlay is visible");
  if (networkIssues.some((issue) => (issue.status ?? 0) >= 500)) failures.push("one or more page requests returned 5xx");

  const denied = isExpectedDenied(status, bodyText);
  const result: RouteResult = {
    route,
    role,
    finalUrl: page.url(),
    status,
    ok: failures.length === 0,
    denied,
    bodyLength: bodyText.length,
    failures,
    consoleMessages,
    networkIssues,
  };
  routeResults.push(result);
  return result;
}

async function checkRoutesInContext(context: BrowserContext, routes: string[], role: RouteResult["role"]) {
  const results: RouteResult[] = [];
  for (const route of routes) {
    const page = await context.newPage();
    try {
      results.push(await checkRoute(page, route, role));
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  return results;
}

async function visibleNavigationHrefs(page: Page) {
  return page.locator("a[href^='/']").evaluateAll((links) => {
    return links
      .filter((link) => {
        const rect = link.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href && !href.startsWith("//"))
      .slice(0, 25);
  });
}

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  const outputPath = reportPath();
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
        coverage,
        missingRoleStorageStates,
        summary: {
          checked: routeResults.length,
          passed: routeResults.filter((result) => result.ok).length,
          failed: routeResults.filter((result) => !result.ok).length,
          denied: routeResults.filter((result) => result.denied).length,
          withConsoleMessages: routeResults.filter((result) => result.consoleMessages.length > 0).length,
          withNetworkIssues: routeResults.filter((result) => result.networkIssues.length > 0).length,
        },
        results: routeResults,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[route-operability] Report written to ${outputPath}`);
});

test.describe("Route inventory coverage", () => {
  test("all filesystem page routes are represented in route fixtures or navigation", async () => {
    expect(coverage.missingRouteCoverage).toEqual([]);
  });
});

test.describe("Public page routes", () => {
  test("all public routes render without 5xx or framework overlays", async ({ browser }) => {
    const context = await browser.newContext();
    const results = await checkRoutesInContext(context, [...PUBLIC_ROUTES], "public");
    await context.close();
    expect(results.filter((result) => !result.ok)).toEqual([]);
  });

  test("visible public navigation links stay operational", async ({ page }) => {
    await checkRoute(page, "/", "public");
    const hrefs = [...new Set(await visibleNavigationHrefs(page))].map(normalizeRouteForCoverage);
    const context = page.context();
    const results = await checkRoutesInContext(context, hrefs, "public");
    expect(results.filter((result) => !result.ok)).toEqual([]);
  });
});

for (const role of Object.keys(E2E_ROLE_AUTH) as E2ERoleKey[]) {
  const config = E2E_ROLE_AUTH[role];
  const hasCurrentCredentials = hasRoleE2ECredentials(role);
  const hasStorageState = existsSync(config.storageState);

  test.describe(`${config.label} page routes`, () => {
    test.skip(
      !hasCurrentCredentials || !hasStorageState,
      `${config.storageState} unavailable. Set ${config.emailEnv}/${config.passwordEnv}.`
    );

    test("known authenticated routes render, redirect, or deny cleanly", async ({ browser }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ storageState: config.storageState });
      const results = await checkRoutesInContext(context, roleRoutes, role);
      await context.close();
      expect(results.filter((result) => !result.ok)).toEqual([]);
    });

    test("visible authenticated navigation links stay operational", async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ storageState: config.storageState });
      const page = await context.newPage();
      await checkRoute(page, "/dashboard", role);
      const hrefs = [...new Set(await visibleNavigationHrefs(page))].map(normalizeRouteForCoverage);
      await page.close();
      const results = await checkRoutesInContext(context, hrefs, role);
      await context.close();
      expect(results.filter((result) => !result.ok)).toEqual([]);
    });
  });

  if (!hasCurrentCredentials || !hasStorageState) {
    missingRoleStorageStates.push(`${config.label}: ${config.storageState}`);
  }
}
