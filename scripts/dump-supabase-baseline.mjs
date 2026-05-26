/**
 * Creates a schema-only baseline from the current production-like Supabase DB.
 *
 * Required env:
 *   SOURCE_DATABASE_URL or DATABASE_URL
 *
 * Optional env:
 *   SOURCE_SUPABASE_REF=mdqkfbnwxrasdmbsjcqv
 *
 * Usage:
 *   npm run db:baseline:dump
 *   npm run db:baseline:dump -- --dry-run
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  baselineName,
  baselinePath,
  baselineVersion,
  baselineDir,
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

const dryRun = process.argv.includes("--dry-run");
const sourceDbUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;
validateDbUrl("SOURCE_DATABASE_URL or DATABASE_URL", sourceDbUrl);

const expectedSourceRef = process.env.SOURCE_SUPABASE_REF || productionProjectRef;
const sourceRef =
  inferProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  inferProjectRef(sourceDbUrl);
if (sourceRef && sourceRef !== expectedSourceRef) {
  throw new Error(`Refusing to dump baseline: source ref is ${sourceRef}, expected ${expectedSourceRef}.`);
}

fs.mkdirSync(baselineDir, { recursive: true });

function dumpSchema(schema, file) {
  const dumpArgs = [
    "db",
    "dump",
    "--db-url",
    sourceDbUrl,
    "--schema",
    schema,
    "--file",
    file,
  ];
  if (dryRun) dumpArgs.push("--dry-run");

  const { cli, args } = supabaseArgs(dumpArgs);
  const result = spawnSync(cli, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error([`Could not dump Supabase ${schema} schema.`, output].filter(Boolean).join("\n"));
  }
}

function queryJson(sql, label) {
  const { cli, args } = supabaseArgs([
    "--agent",
    "no",
    "db",
    "query",
    "--db-url",
    sourceDbUrl,
    "--output",
    "json",
    sql,
  ]);
  const result = spawnSync(cli, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error([`${label} failed.`, output].filter(Boolean).join("\n"));
  }
  return JSON.parse(result.stdout);
}

const privateDump = path.join(baselineDir, `${baselineVersion}_private.tmp.sql`);
const publicDump = path.join(baselineDir, `${baselineVersion}_public.tmp.sql`);

dumpSchema("private", privateDump);
dumpSchema("public", publicDump);

if (dryRun) {
  console.log("Supabase schema dump dry-run completed.");
  process.exit(0);
}

const dumped = [
  fs.readFileSync(privateDump, "utf8"),
  "",
  fs.readFileSync(publicDump, "utf8"),
].join("\n");
validateSchemaOnlySql(dumped, baselinePath);

const header = [
  "-- SafetyDocs360 Supabase schema baseline.",
  `-- Source project ref: ${expectedSourceRef}`,
  `-- Baseline migration: ${baselineVersion}_${baselineName}`,
  "-- Data handling: schema-only dump for public/private schemas; no production rows.",
  "",
].join("\n");

fs.writeFileSync(baselinePath, `${header}${dumped}`, "utf8");

fs.rmSync(privateDump, { force: true });
fs.rmSync(publicDump, { force: true });

const storageRows = queryJson(
  String.raw`
with bucket_lines as (
  select 10 as sort_key,
         format(
           'insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %s) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;',
           id,
           name,
           public,
           coalesce(file_size_limit::text, 'null'),
           case when allowed_mime_types is null then 'null' else quote_literal(allowed_mime_types::text) || '::text[]' end
         ) as ddl
  from storage.buckets
), policy_lines as (
  select 20 as sort_key,
         format('drop policy if exists %I on %I.%I;', p.policyname, p.schemaname, p.tablename) || E'\n' ||
         format(
           'create policy %I on %I.%I as permissive for %s to %s%s%s;',
           p.policyname,
           p.schemaname,
           p.tablename,
           lower(p.cmd),
           array_to_string(array(select quote_ident(role_name) from unnest(p.roles) as role_name), ', '),
           case when p.qual is null then '' else ' using (' || p.qual || ')' end,
           case when p.with_check is null then '' else ' with check (' || p.with_check || ')' end
         ) as ddl
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
)
select ddl from (
  select * from bucket_lines
  union all
  select * from policy_lines
) lines
order by sort_key, ddl;
`,
  "Storage baseline query"
);

const storageSql = [
  "-- SafetyDocs360 Supabase storage config baseline.",
  `-- Source project ref: ${expectedSourceRef}`,
  `-- Baseline migration: ${baselineVersion}_${baselineName}`,
  "-- Data handling: bucket configuration and storage.objects policies only; no storage objects.",
  "",
  ...storageRows.map((row) => row.ddl),
  "",
].join("\n\n");
validateSchemaOnlySql(storageSql, storageConfigPath);
fs.writeFileSync(storageConfigPath, storageSql, "utf8");

console.log(`Wrote schema-only baseline: ${baselinePath}`);
console.log(`Wrote storage config baseline: ${storageConfigPath}`);
