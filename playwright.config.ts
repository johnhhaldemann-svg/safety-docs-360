import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — production-style defaults.
 *
 * Run (from repo root):
 *   1. Ensure `.env.local` has NEXT_PUBLIC_SUPABASE_* (same as dev).
 *   2. Start the app, then run tests:
 *        npm run dev
 *        npx playwright test
 *      Or one-shot CI-style (build + serve + test):
 *        npm run test:e2e:ci
 *
 * Optional auth (login, protected routes, nav, forms):
 *   E2E_USER_EMAIL=you@example.com E2E_USER_PASSWORD=secret npx playwright test
 *
 * Override base URL:
 *   PLAYWRIGHT_BASE_URL=https://staging.example.com npx playwright test
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const useStorageState =
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD
    ? "playwright/.auth/user.json"
    : undefined;

export default defineConfig({
  testDir: "./tests",
  globalSetup: require.resolve("./playwright-global-setup.ts"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["github"],
      ]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium-public",
      testMatch: "**/auth.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: "**/auth.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        ...(useStorageState ? { storageState: useStorageState } : {}),
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: process.env.CI ? "npm run start" : "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: process.env.CI ? 120_000 : 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
