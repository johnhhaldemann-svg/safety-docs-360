import { existsSync } from "node:fs";
import { join } from "node:path";

/** Pathname only: strips `?query` and `#hash`. */
export function stripQueryAndHash(href: string): string {
  const q = href.split("?")[0] ?? href;
  return (q.split("#")[0] ?? q).trim();
}

/** App Router page modules used by this repo (tsx only). */
export function resolveHrefToPageFile(repoRoot: string, href: string): string | null {
  const pathname = stripQueryAndHash(href);
  if (!pathname.startsWith("/")) {
    return null;
  }
  const pathPart = pathname.slice(1);
  const candidates = pathPart
    ? [`app/(app)/${pathPart}/page.tsx`, `app/${pathPart}/page.tsx`]
    : ["app/page.tsx"];
  for (const rel of candidates) {
    const abs = join(repoRoot, rel);
    if (existsSync(abs)) {
      return rel;
    }
  }
  return null;
}

export function resolveApiHrefToRouteFile(repoRoot: string, href: string): string | null {
  const pathname = stripQueryAndHash(href);
  if (!pathname.startsWith("/api/")) {
    return null;
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api") {
    return null;
  }
  const base = join(repoRoot, "app", ...segments);
  for (const name of ["route.ts", "route.js"]) {
    const abs = join(base, name);
    if (existsSync(abs)) {
      return join("app", ...segments, name);
    }
  }
  return null;
}

export function resolvePublicAsset(repoRoot: string, href: string): string | null {
  const pathname = stripQueryAndHash(href);
  if (!pathname.startsWith("/") || pathname.startsWith("/_next")) {
    return null;
  }
  if (pathname === "/") {
    return null;
  }
  const pathPart = pathname.replace(/^\//, "");
  const rel = join("public", pathPart);
  const abs = join(repoRoot, rel);
  if (existsSync(abs)) {
    return rel;
  }
  return null;
}

export type ResolvedInternalLink =
  | { ok: true; kind: "page" | "api" | "public"; file: string }
  | { ok: false; kind: "none" };

/**
 * Resolves a static in-app URL (page, App Router API route, or `public/` file).
 * Does not resolve dynamic route instances (e.g. `/jobsites/123/overview`).
 */
export function resolveInternalStaticLink(repoRoot: string, href: string): ResolvedInternalLink {
  const pathname = stripQueryAndHash(href);
  if (!pathname.startsWith("/")) {
    return { ok: false, kind: "none" };
  }

  if (pathname.startsWith("/api/")) {
    const api = resolveApiHrefToRouteFile(repoRoot, href);
    if (api) {
      return { ok: true, kind: "api", file: api };
    }
    return { ok: false, kind: "none" };
  }

  const page = resolveHrefToPageFile(repoRoot, href);
  if (page) {
    return { ok: true, kind: "page", file: page };
  }

  const pub = resolvePublicAsset(repoRoot, href);
  if (pub) {
    return { ok: true, kind: "public", file: pub };
  }

  return { ok: false, kind: "none" };
}
