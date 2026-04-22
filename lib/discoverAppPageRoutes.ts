import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Same placeholder as Playwright smoke tests — any dynamic segment becomes this UUID. */
export const APP_ROUTE_DISCOVERY_PLACEHOLDER_UUID =
  "00000000-0000-4000-8000-000000000001";

function isRouteGroupSegment(segment: string) {
  return segment.startsWith("(") && segment.endsWith(")");
}

function isDynamicSegment(segment: string) {
  return segment.startsWith("[") && segment.endsWith("]");
}

function walkPageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkPageFiles(p));
    } else if (ent.name === "page.tsx" || ent.name === "page.jsx") {
      out.push(p);
    }
  }
  return out;
}

/**
 * True when the page lives under the authenticated `(app)` route group (needs session for smoke).
 */
export function isAuthenticatedAppShellPage(appRoot: string, pageFilePath: string): boolean {
  const rel = relative(appRoot, pageFilePath).split(sep).join("/");
  return rel.includes("(app)/") || rel.startsWith("(app)/");
}

/**
 * Map `app/.../page.tsx` to a URL pathname (Next.js App Router: omit route groups, substitute dynamics).
 */
export function appPageFileToUrlPath(appRoot: string, pageFilePath: string): string {
  const rel = relative(appRoot, pageFilePath).split(sep).join("/");
  const isRootPage = rel === "page.tsx" || rel === "page.jsx";
  if (!isRootPage && !rel.endsWith("/page.tsx") && !rel.endsWith("/page.jsx")) {
    throw new Error(`Not a page file: ${rel}`);
  }
  const dir = isRootPage
    ? ""
    : rel.replace(/\/page\.tsx$/, "").replace(/\/page\.jsx$/, "");
  const segments = dir.split("/").filter(Boolean);
  const urlParts: string[] = [];
  for (const seg of segments) {
    if (isRouteGroupSegment(seg)) {
      continue;
    }
    if (isDynamicSegment(seg)) {
      urlParts.push(APP_ROUTE_DISCOVERY_PLACEHOLDER_UUID);
    } else {
      urlParts.push(seg);
    }
  }
  if (urlParts.length === 0) {
    return "/";
  }
  return `/${urlParts.join("/")}`;
}

export function discoverAppPageUrlPaths(repoRoot: string): {
  pageFile: string;
  urlPath: string;
  requiresAuthShell: boolean;
}[] {
  const appRoot = join(repoRoot, "app");
  const files = walkPageFiles(appRoot);
  return files.map((pageFile) => ({
    pageFile: relative(repoRoot, pageFile).split(sep).join("/"),
    urlPath: appPageFileToUrlPath(appRoot, pageFile),
    requiresAuthShell: isAuthenticatedAppShellPage(appRoot, pageFile),
  }));
}
