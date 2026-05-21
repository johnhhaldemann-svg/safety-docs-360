/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture `use()` is not React */
import { test as base, expect } from "@playwright/test";

export type NetworkFailure =
  | { kind: "failed"; url: string; method: string; failure: string }
  | { kind: "http_error"; url: string; method: string; status: number };

/**
 * Wraps `page` with console + network diagnostics attached to the HTML report on failure.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const networkFailures: NetworkFailure[] = [];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (text.includes("webpack-hmr") || text.includes("_next/webpack-hmr")) return;
      consoleErrors.push(`[console.${msg.type()}] ${text}`);
    });

    page.on("pageerror", (err) => {
      consoleErrors.push(`[pageerror] ${err.message}`);
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure();
      networkFailures.push({
        kind: "failed",
        url: request.url(),
        method: request.method(),
        failure: failure?.errorText ?? "unknown",
      });
    });

    page.on("response", (response) => {
      const status = response.status();
      if (status < 400) return;
      const req = response.request();
      const type = req.resourceType();
      if (!["document", "fetch", "xhr", "other"].includes(type)) return;
      const url = response.url();
      if (url.includes("favicon") || url.includes("chrome-extension")) return;
      networkFailures.push({
        kind: "http_error",
        url,
        method: req.method(),
        status,
      });
    });

    await use(page);

    const shouldAttach =
      testInfo.status === "failed" ||
      testInfo.status === "timedOut" ||
      testInfo.status === "interrupted" ||
      process.env.E2E_ATTACH_DIAGNOSTICS_ALWAYS === "1";

    if (shouldAttach) {
      const consoleBody =
        consoleErrors.length > 0
          ? consoleErrors.join("\n")
          : "(no console errors captured)";
      const netBody =
        networkFailures.length > 0
          ? JSON.stringify(networkFailures, null, 2)
          : "(no failed requests or HTTP 4xx/5xx on fetch/xhr/document)";

      await testInfo.attach("diagnostics-console.txt", {
        body: consoleBody,
        contentType: "text/plain",
      });
      await testInfo.attach("diagnostics-network.json", {
        body: netBody,
        contentType: "application/json",
      });
    }
  },
});

export { expect };
