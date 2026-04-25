/**
 * Walks `tests/ai/golden/<surface>/*.json` and returns parsed fixtures.
 * The directory structure determines the `surface` for each fixture, so a new
 * surface = a new sibling directory. No registry edits required.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiEvalFixture } from "./schema";

const HERE = dirname(fileURLToPath(import.meta.url));

function isJsonFile(name: string) {
  return name.toLowerCase().endsWith(".json");
}

export function loadAiEvalFixtures(rootDir: string = HERE): AiEvalFixture[] {
  const out: AiEvalFixture[] = [];
  let entries: string[];
  try {
    entries = readdirSync(rootDir);
  } catch {
    return out;
  }
  for (const surfaceDir of entries) {
    const fullPath = join(rootDir, surfaceDir);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;

    let files: string[] = [];
    try {
      files = readdirSync(fullPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!isJsonFile(file)) continue;
      const filePath = join(fullPath, file);
      let raw: string;
      try {
        raw = readFileSync(filePath, "utf-8");
      } catch {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `tests/ai eval: invalid JSON in ${filePath}: ${err instanceof Error ? err.message : "parse error"}`
        );
      }
      if (!parsed || typeof parsed !== "object") {
        throw new Error(`tests/ai eval: fixture ${filePath} is not an object`);
      }
      const fixture = parsed as Partial<AiEvalFixture>;
      if (!fixture.surface || typeof fixture.surface !== "string") {
        throw new Error(`tests/ai eval: fixture ${filePath} missing 'surface'`);
      }
      if (fixture.surface !== surfaceDir) {
        throw new Error(
          `tests/ai eval: fixture ${filePath} declares surface '${fixture.surface}' but lives in '${surfaceDir}/'`
        );
      }
      const name = fixture.name ?? file.replace(/\.json$/i, "");
      out.push({
        name,
        surface: fixture.surface,
        input: fixture.input,
        assertions: fixture.assertions ?? {},
        notes: fixture.notes,
      });
    }
  }
  return out;
}
