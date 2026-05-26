/**
 * Bootstraps the staging Supabase database from the committed schema baseline.
 *
 * Required env:
 *   STAGING_DATABASE_URL or SUPABASE_STAGING_DB_URL
 *
 * Optional env:
 *   STAGING_SUPABASE_REF=dacafxrcrijqevgjotjc
 *
 * Usage:
 *   npm run db:staging:bootstrap
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  baselineName,
  baselinePath,
  baselineVersion,
  defaultStagingProjectRef,
  inferProjectRef,
  loadDefaultEnv,
  productionProjectRef,
  root,
  storageConfigPath,
  supabaseArgs,
  validateDbUrl,
  validateSchemaOnlySql,
} from "./supabase-baseline-utils.mjs";

loadDefaultEnv();

const stagingDbUrl = process.env.STAGING_DATABASE_URL || process.env.SUPABASE_STAGING_DB_URL;
validateDbUrl("STAGING_DATABASE_URL", stagingDbUrl);

const expectedStagingRef = process.env.STAGING_SUPABASE_REF || defaultStagingProjectRef;
const stagingRef = inferProjectRef(stagingDbUrl) || expectedStagingRef;
if (stagingRef === productionProjectRef) {
  throw new Error(`Refusing to bootstrap production-like project ${productionProjectRef}.`);
}
if (expectedStagingRef && stagingRef !== expectedStagingRef) {
  throw new Error(`Refusing to bootstrap ${stagingRef}; expected staging ref ${expectedStagingRef}.`);
}

if (!fs.existsSync(baselinePath)) {
  throw new Error(`Missing baseline file: ${baselinePath}. Run npm run db:baseline:dump first.`);
}

const baselineSql = fs.readFileSync(baselinePath, "utf8");
validateSchemaOnlySql(baselineSql, baselinePath);
if (!fs.existsSync(storageConfigPath)) {
  throw new Error(`Missing storage config baseline file: ${storageConfigPath}. Run npm run db:baseline:dump first.`);
}
const storageConfigSql = fs.readFileSync(storageConfigPath, "utf8");
validateSchemaOnlySql(storageConfigSql, storageConfigPath);

function runSupabase(args, label) {
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

function runSupabaseCapture(args, label) {
  const command = supabaseArgs(args);
  const result = spawnSync(command.cli, command.args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error([`${label} failed.`, output].filter(Boolean).join("\n"));
  }
  return output;
}

const appTableCheck = runSupabaseCapture(
  [
    "--agent",
    "no",
    "db",
    "query",
    "--db-url",
    stagingDbUrl,
    "--output",
    "csv",
    "select count(*)::int as app_table_count from information_schema.tables where table_schema = 'public' and table_name in ('submissions','documents','companies','company_jobsites');",
  ],
  "Staging app-table preflight"
);

const appTableCount = Number(appTableCheck.match(/\b\d+\b/)?.[0] ?? "0");
if (appTableCount > 0) {
  throw new Error(
    `Refusing to bootstrap staging because ${appTableCount} expected app tables already exist. Use a clean staging DB.`
  );
}

runSupabase(["db", "query", "--db-url", stagingDbUrl, "--file", baselinePath], "Apply schema baseline");
runSupabase(["db", "query", "--db-url", stagingDbUrl, "--file", storageConfigPath], "Apply storage config baseline");

const migrationFiles = fs
  .readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();

const historicalVersions = migrationFiles
  .map((name) => name.slice(0, 14))
  .filter((version) => version <= baselineVersion);

if (!historicalVersions.includes(baselineVersion)) {
  throw new Error(`Could not find baseline migration version ${baselineVersion}.`);
}

runSupabase(
  ["migration", "repair", ...historicalVersions, "--status", "applied", "--db-url", stagingDbUrl],
  `Repair migration history through ${baselineVersion}_${baselineName}`
);

runSupabase(
  ["db", "push", "--yes", "--include-all", "--db-url", stagingDbUrl],
  "Apply pending staging migrations"
);

console.log(`Staging bootstrap completed for ${stagingRef}.`);
