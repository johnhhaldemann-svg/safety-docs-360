#!/usr/bin/env node
/**
 * Squash the Supabase migration history into a single declarative baseline.
 *
 * WHY: the incremental migrations cannot bootstrap a fresh database — 43 tables are
 * assumed to pre-exist and a function is used before it is defined, so migration #1 fails
 * on any clean DB / preview branch. See supabase/MIGRATIONS.md for the full diagnosis.
 *
 * WHAT THIS DOES (requires `npx supabase login` first):
 *   1. Links the project.
 *   2. Runs `supabase db dump --schema public` -> 00000000000000_baseline.sql.
 *   3. Sanity-checks the dump produced a real schema file.
 *   4. Moves the existing incremental migrations into supabase/migrations_archive/.
 *
 * WHAT THIS DOES NOT DO (intentionally — these need a human + verification):
 *   - It does not run `supabase migration repair` against production.
 *   - It does not validate the baseline; do that on a throwaway branch / `supabase db reset`.
 *
 * Usage:  node scripts/squash-migrations.mjs            (uses default project ref)
 *         SUPABASE_PROJECT_REF=xxxx node scripts/squash-migrations.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const ARCHIVE_DIR = join(ROOT, "supabase", "migrations_archive");
const BASELINE_NAME = "00000000000000_baseline.sql";
const BASELINE_PATH = join(MIGRATIONS_DIR, BASELINE_NAME);
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF?.trim() || "mdqkfbnwxrasdmbsjcqv";
const MIN_BASELINE_BYTES = 50_000; // a real full-schema dump is far larger; guard against an empty/failed dump

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT });
}

function main() {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations dir not found: ${MIGRATIONS_DIR}`);
  }
  if (existsSync(BASELINE_PATH)) {
    throw new Error(`${BASELINE_NAME} already exists — refusing to overwrite. Remove it first if you intend to regenerate.`);
  }

  // 1 + 2: link and dump. stdio is inherited so the interactive DB-password prompt works.
  // Dump BOTH custom schemas: `public` holds the app tables/policies, `private`
  // holds SECURITY DEFINER trigger functions referenced by public triggers.
  // Dumping `public` alone leaves triggers pointing at a non-existent `private`
  // schema, so a fresh DB fails. (Supabase-managed schemas — auth, storage,
  // realtime, etc. — are intentionally excluded.)
  run(`npx --no-install supabase link --project-ref ${PROJECT_REF}`);
  run(`npx --no-install supabase db dump --linked --schema public,private -f "${BASELINE_PATH}"`);

  // 3: sanity-check the dump.
  if (!existsSync(BASELINE_PATH) || statSync(BASELINE_PATH).size < MIN_BASELINE_BYTES) {
    throw new Error(
      `Baseline dump missing or suspiciously small (< ${MIN_BASELINE_BYTES} bytes). ` +
        `Aborting before archiving any migrations.`
    );
  }

  // 3b: re-add CREATE EXTENSION statements. `supabase db dump` omits them (the
  // extensions live in the `extensions` schema, outside the dumped schemas), but
  // the schema references the pgvector type as "extensions"."vector". Without
  // these, a fresh DB fails on the first such reference. Injected right before
  // the first CREATE SCHEMA so the extensions exist before any object uses them.
  const dumped = readFileSync(BASELINE_PATH, "utf8");
  const EXTENSIONS_PREAMBLE =
    `-- Extensions required by this schema. \`supabase db dump\` omits CREATE EXTENSION\n` +
    `-- statements (they live outside the dumped schemas), so they are re-added here.\n` +
    `-- Without these, a fresh database fails on the first reference to the\n` +
    `-- "extensions"."vector" type (pgvector). Matches the archived migrations.\n` +
    `CREATE SCHEMA IF NOT EXISTS "extensions";\n` +
    `CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";\n` +
    `CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";\n\n\n`;
  if (!dumped.includes(`CREATE EXTENSION IF NOT EXISTS "vector"`)) {
    const anchor = dumped.indexOf("CREATE SCHEMA");
    if (anchor === -1) {
      throw new Error(`No CREATE SCHEMA found in dump — cannot place extensions preamble. Aborting before archiving.`);
    }
    writeFileSync(BASELINE_PATH, dumped.slice(0, anchor) + EXTENSIONS_PREAMBLE + dumped.slice(anchor));
    console.log(`✓ Injected CREATE EXTENSION preamble (pgcrypto, vector).`);
  }

  console.log(`\n✓ Baseline written: ${BASELINE_PATH} (${statSync(BASELINE_PATH).size} bytes)`);

  // 4: archive the incremental migrations (everything except the new baseline).
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const incrementals = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.toLowerCase().endsWith(".sql") && f !== BASELINE_NAME
  );
  for (const file of incrementals) {
    renameSync(join(MIGRATIONS_DIR, file), join(ARCHIVE_DIR, file));
  }
  console.log(`✓ Archived ${incrementals.length} incremental migration(s) to supabase/migrations_archive/`);

  console.log(`
Next steps (NOT done automatically):
  1. Validate: spin up a throwaway Supabase preview branch (must reach MIGRATIONS_PASSED),
     or run \`npx supabase db reset\` locally — it must apply the baseline cleanly.
  2. Reconcile prod (LAST, with review):
       npx supabase migration repair --status applied 00000000000000
       npx supabase migration list   # confirm
  3. Commit the baseline + migrations_archive/ and open the PR.
See supabase/MIGRATIONS.md.`);
}

try {
  main();
} catch (err) {
  console.error(`\n✗ squash-migrations failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
