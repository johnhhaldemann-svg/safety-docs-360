/**
 * Runs the aggregate-only Supabase data readiness audit.
 *
 * Safe by design:
 * - requires a Postgres URL for the selected target
 * - refuses production unless --allow-production-read is present
 * - checks expected app tables before running the full audit
 * - executes a read-only SQL bundle that returns counts only
 *
 * Usage:
 *   npm run db:data-readiness -- --target=staging
 *   npm run db:data-readiness -- --target=production --allow-production-read
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  defaultStagingProjectRef,
  inferProjectRef,
  loadDefaultEnv,
  productionProjectRef,
  root,
  supabaseArgs,
  validateDbUrl,
} from "./supabase-baseline-utils.mjs";

const auditSqlPath = path.join(root, "supabase", "readiness", "data_readiness_audit.sql");
const expectedTables = [
  "companies",
  "company_jobsites",
  "company_memberships",
  "company_subscriptions",
  "company_training_requirements",
  "company_jobsite_emergency_profiles",
  "approved_knowledge",
  "approved_sources",
  "billing_customers",
  "documents",
];

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function runSupabaseCapture(args, label) {
  const command = supabaseArgs(args);
  let result = spawnSync(command.cli, command.args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });

  if (process.platform === "win32" && result.error?.code === "EPERM") {
    result = spawnSync(command.cli, command.args, {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      shell: true,
    });
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    const diagnostic = [
      result.error ? `Spawn error: ${result.error.message}` : null,
      result.status !== null ? `Exit status: ${result.status}` : null,
      result.signal ? `Signal: ${result.signal}` : null,
      !output ? "No CLI output was returned. Verify the DB URL is percent-encoded and reachable from this machine." : null,
    ].filter(Boolean);
    throw new Error([`${label} failed.`, output, ...diagnostic].filter(Boolean).join("\n"));
  }
  return output;
}

function resolveTarget() {
  const target = (argValue("target") || process.env.SUPABASE_READINESS_TARGET || "staging").toLowerCase();
  if (!["staging", "production"].includes(target)) {
    throw new Error(`Unsupported target "${target}". Use staging or production.`);
  }

  const dbUrl =
    target === "staging"
      ? process.env.STAGING_DATABASE_URL || process.env.SUPABASE_STAGING_DB_URL
      : process.env.SUPABASE_READONLY_DATABASE_URL ||
        process.env.SUPABASE_MIGRATION_CHECK_DB_URL ||
        process.env.DATABASE_URL ||
        process.env.DIRECT_URL;

  validateDbUrl(`${target.toUpperCase()} database URL`, dbUrl);

  const ref = inferProjectRef(dbUrl);
  if (target === "staging") {
    const expected = process.env.STAGING_SUPABASE_REF || defaultStagingProjectRef;
    if (ref === productionProjectRef) {
      throw new Error(`Refusing to run staging audit against production ref ${productionProjectRef}.`);
    }
    if (ref && expected && ref !== expected) {
      throw new Error(`Refusing to run staging audit against ${ref}; expected ${expected}.`);
    }
  }

  if (target === "production" && (ref === productionProjectRef || !ref) && !hasFlag("allow-production-read")) {
    throw new Error(
      [
        "Production data readiness audits are read-only, but still require explicit intent.",
        "Re-run with --allow-production-read after confirming this is the intended target.",
      ].join("\n")
    );
  }

  return { target, dbUrl, ref: ref ?? "unknown" };
}

function parseCsvRows(csv) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((part) => part.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((part) => part.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

loadDefaultEnv();

try {
  if (!fs.existsSync(auditSqlPath)) {
    throw new Error(`Missing audit SQL bundle: ${auditSqlPath}`);
  }

  const { target, dbUrl, ref } = resolveTarget();
  const tableList = expectedTables.map((table) => `'${table}'`).join(",");
  const preflightSql = [
    "select table_name",
    "from information_schema.tables",
    "where table_schema = 'public'",
    `and table_name in (${tableList})`,
    "order by table_name;",
  ].join(" ");

  const preflight = runSupabaseCapture(
    ["--agent", "no", "db", "query", "--db-url", dbUrl, "--output", "csv", preflightSql],
    "Readiness table preflight"
  );
  const present = new Set(parseCsvRows(preflight).map((row) => row.table_name));
  const missing = expectedTables.filter((table) => !present.has(table));
  if (missing.length > 0) {
    throw new Error(
      [
        `Supabase ${target} (${ref}) is missing ${missing.length} expected app table(s):`,
        missing.map((table) => `- ${table}`).join("\n"),
        "If this is staging, run npm run db:staging:bootstrap after setting the real staging DB password.",
      ].join("\n")
    );
  }

  console.log(`# Supabase data readiness audit`);
  console.log(`Target: ${target}`);
  console.log(`Project ref: ${ref}`);
  console.log(`SQL bundle: ${path.relative(root, auditSqlPath)}`);
  console.log("");

  const report = runSupabaseCapture(
    ["--agent", "no", "db", "query", "--db-url", dbUrl, "--output", "csv", "--file", auditSqlPath],
    "Data readiness audit"
  );
  console.log(report);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
