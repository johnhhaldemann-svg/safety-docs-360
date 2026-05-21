import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInternalStaticLink } from "./internalLinkResolve";

const REPO_ROOT = join(import.meta.dirname, "..");

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "mcps"]);

/** Roots relative to repo; only static analyzable TS/TSX. */
const SCAN_DIRS = ["app", "components", "lib"];

const LINK_REGEXES: RegExp[] = [
  /\bhref\s*=\s*["'](\/[^"']+)["']/g,
  /\bhref\s*=\s*\{\s*["'](\/[^"']+)["']\s*\}/g,
  /\b(?:src|poster)\s*=\s*["'](\/(?!_next\/)[^"']+)["']/g,
  /\brouter\.(?:push|replace)\s*\(\s*["'](\/[^"']+)["']/g,
  /\bredirect\s*\(\s*["'](\/[^"']+)["']/g,
  /\bfetch(?:WithTimeout)?\s*\(\s*["'](\/[^"']+)["']/g,
  /\bwindow\.location\.(?:href|assign)\s*=\s*["'](\/[^"']+)["']/g,
];

type Finding = { file: string; line: number; href: string; detail: string };

function* walkSourceFiles(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* walkSourceFiles(p);
    } else if (ent.isFile() && (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx"))) {
      if (ent.name.includes(".test.")) continue;
      yield p;
    }
  }
}

function lineAtIndex(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function extractStaticLinks(source: string): { href: string; index: number }[] {
  const found: { href: string; index: number }[] = [];
  for (const re of LINK_REGEXES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const href = m[1];
      if (!href.startsWith("/")) continue;
      if (href.startsWith("//")) continue;
      found.push({ href, index: m.index });
    }
  }
  return found;
}

function scanRepo(): Finding[] {
  const failures: Finding[] = [];
  const seen = new Set<string>();

  for (const root of SCAN_DIRS) {
    const absRoot = join(REPO_ROOT, root);
    if (!statSync(absRoot, { throwIfNoEntry: false })?.isDirectory()) {
      continue;
    }
    for (const filePath of walkSourceFiles(absRoot)) {
      const relFile = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
      const source = readFileSync(filePath, "utf8");
      for (const { href, index } of extractStaticLinks(source)) {
        const line = lineAtIndex(source, index);
        const dedupeKey = `${relFile}:${line}:${href}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const r = resolveInternalStaticLink(REPO_ROOT, href);
        if (!r.ok) {
          failures.push({
            file: relFile,
            line,
            href,
            detail: "no matching page.tsx, app/api/.../route, or public file",
          });
        }
      }
    }
  }

  return failures;
}

describe("Broken link checker (static internal URLs)", () => {
  it("all static /… links in app, components, and lib resolve to a real target", () => {
    const failures = scanRepo();
    const message =
      failures.length === 0
        ? ""
        : `\n${failures.map((f) => `  ${f.file}:${f.line}  ${f.href}\n    → ${f.detail}`).join("\n")}`;
    expect(failures, message).toEqual([]);
  });
});
