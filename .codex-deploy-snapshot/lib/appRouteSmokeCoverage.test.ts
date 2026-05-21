import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverAppPageUrlPaths } from "./discoverAppPageRoutes";
import {
  authenticatedSmokeRoutes,
  AUTH_APP_DYNAMIC_ROUTES,
  AUTH_APP_STATIC_ROUTES,
  PUBLIC_ROUTES,
} from "../tests/helpers/routes";

const REPO_ROOT = join(import.meta.dirname, "..");

describe("App route smoke coverage", () => {
  it("every app page.tsx maps to a URL covered by public or authenticated smoke lists", () => {
    const discovered = discoverAppPageUrlPaths(REPO_ROOT);
    expect(discovered.length).toBeGreaterThan(0);

    const publicSet = new Set<string>(PUBLIC_ROUTES);
    const smokePaths = new Set(
      authenticatedSmokeRoutes().map((href) => {
        const pathOnly = href.split("#")[0] ?? href;
        return pathOnly === "" ? "/" : pathOnly;
      })
    );

    const missing: string[] = [];
    for (const { pageFile, urlPath, requiresAuthShell } of discovered) {
      if (requiresAuthShell) {
        if (!smokePaths.has(urlPath)) {
          missing.push(`${pageFile} → ${urlPath} (auth shell)`);
        }
      } else if (!publicSet.has(urlPath) && urlPath !== "/") {
        missing.push(`${pageFile} → ${urlPath} (public)`);
      } else if (urlPath === "/" && !publicSet.has("/")) {
        missing.push(`${pageFile} → / (public)`);
      }
    }

    expect(
      missing,
      `Add each URL to tests/helpers/routes.ts (PUBLIC_ROUTES or AUTH_APP_*), or ensure it appears in lib/appNavigation.ts:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("every declared smoke route points at a real app page", () => {
    const discovered = discoverAppPageUrlPaths(REPO_ROOT);
    const discoveredPaths = new Set(discovered.map((entry) => entry.urlPath));

    const missingPublic = PUBLIC_ROUTES.filter((href) => href !== "/" && !discoveredPaths.has(href));
    const missingStatic = AUTH_APP_STATIC_ROUTES.filter((href) => !discoveredPaths.has(href));
    const missingDynamic = AUTH_APP_DYNAMIC_ROUTES.filter((href) => !discoveredPaths.has(href));

    expect(
      [...missingPublic, ...missingStatic, ...missingDynamic],
      [
        "Remove stale routes from tests/helpers/routes.ts or restore the missing page files.",
        `Public: ${missingPublic.join(", ") || "(none)"}`,
        `Auth static: ${missingStatic.join(", ") || "(none)"}`,
        `Auth dynamic: ${missingDynamic.join(", ") || "(none)"}`,
      ].join("\n")
    ).toEqual([]);
  });
});
