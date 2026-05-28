import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { E2E_PLACEHOLDER_UUID } from "./routes";

const PAGE_FILE_PATTERN = /^page\.(tsx|ts)$/;

function walkPages(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      walkPages(fullPath, out);
      continue;
    }

    if (PAGE_FILE_PATTERN.test(entry)) {
      out.push(fullPath);
    }
  }

  return out;
}

function routeSegment(segment: string) {
  if (!segment || segment.startsWith("(") || segment.startsWith("@")) return null;
  if (segment.startsWith("[[...") && segment.endsWith("]]")) return null;
  if (segment.startsWith("[...") && segment.endsWith("]")) return E2E_PLACEHOLDER_UUID;
  if (segment.startsWith("[") && segment.endsWith("]")) return E2E_PLACEHOLDER_UUID;
  return segment;
}

export function pageFileToRoute(appDir: string, pageFile: string) {
  const rel = relative(appDir, pageFile);
  const parts = rel.split(sep).slice(0, -1);
  const routeParts = parts.map(routeSegment).filter(Boolean);
  return routeParts.length ? `/${routeParts.join("/")}` : "/";
}

export function discoverAppPageRoutes(appDir = join(process.cwd(), "app")) {
  return [...new Set(walkPages(appDir).map((file) => pageFileToRoute(appDir, file)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function normalizeRouteForCoverage(route: string) {
  const [pathname] = route.split(/[?#]/, 1);
  return pathname === "" ? "/" : pathname;
}
