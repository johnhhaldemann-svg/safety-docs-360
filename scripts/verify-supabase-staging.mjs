/**
 * Verifies staging Supabase schema and migration history after bootstrap.
 *
 * Required env:
 *   STAGING_DATABASE_URL or SUPABASE_STAGING_DB_URL
 *
 * Usage:
 *   npm run db:staging:verify
 */

import { spawnSync } from "child_process";
import {
  defaultStagingProjectRef,
  inferProjectRef,
  loadDefaultEnv,
  productionProjectRef,
  root,
  supabaseArgs,
  validateDbUrl,
} from "./supabase-baseline-utils.mjs";

loadDefaultEnv();

const stagingDbUrl = process.env.STAGING_DATABASE_URL || process.env.SUPABASE_STAGING_DB_URL;
validateDbUrl("STAGING_DATABASE_URL", stagingDbUrl);

const expectedStagingRef = process.env.STAGING_SUPABASE_REF || defaultStagingProjectRef;
const stagingRef = inferProjectRef(stagingDbUrl) || expectedStagingRef;
if (stagingRef === productionProjectRef) {
  throw new Error(`Refusing to verify production-like project ${productionProjectRef}.`);
}

function run(args, label) {
  const command = supabaseArgs(args);
  const result = spawnSync(command.cli, command.args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed.`);
  }
}

run(
  [
    "--agent",
    "no",
    "db",
    "query",
    "--db-url",
    stagingDbUrl,
    "select table_schema, table_name from information_schema.tables where table_schema = 'public' and table_name in ('submissions','documents','companies','company_jobsites') order by table_name;",
  ],
  "Expected table verification"
);

run(["--agent", "no", "migration", "list", "--db-url", stagingDbUrl, "--output", "json"], "Migration history verification");

console.log(`Staging Supabase verification completed for ${stagingRef}.`);
