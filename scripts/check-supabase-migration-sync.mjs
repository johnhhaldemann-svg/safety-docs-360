/**
 * Fails when local Supabase migrations are not present in the target database.
 *
 * Safe by design: this script only reads local migration files and runs
 * `supabase migration list`. It never applies SQL.
 *
 * Usage:
 *   npm run db:check-sync
 *   npm run db:check-local
 *
 * Optional env:
 *   SUPABASE_MIGRATION_CHECK_DB_URL=<postgres-url>    Read remote history by DB URL.
 *   SUPABASE_DB_PUSH_URL=<postgres-url>                Fallback DB URL shared with db:push:env.
 *   SUPABASE_REMOTE_MIGRATION_VERSION=20260522135305 Compare against a known latest remote version.
 *     This legacy override can only prove the latest version, not full history.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const localOnly = process.argv.includes("--local-only");

function loadEnvFile(name) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function supabaseCliPath() {
  const win = process.platform === "win32";
  const exe = path.join(root, "node_modules", "supabase", "bin", win ? "supabase.exe" : "supabase");
  if (fs.existsSync(exe)) return exe;
  return win ? "npx.cmd" : "npx";
}

function listLocalMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    .map((name) => {
      const [version] = name.split("_", 1);
      return { version, name };
    })
    .sort((a, b) => a.version.localeCompare(b.version));

  if (migrations.length === 0) {
    throw new Error("No Supabase migration files found.");
  }

  return migrations;
}

function flattenRemoteVersionsFromJson(value, pathParts = []) {
  const out = new Set();

  if (Array.isArray(value)) {
    for (const item of value) {
      for (const version of flattenRemoteVersionsFromJson(item, pathParts)) out.add(version);
    }
    return out;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const version = entries.find(([key, val]) => /version|id/i.test(key) && /^\d{14}$/.test(String(val ?? "")))?.[1];
    const remoteish = entries.some(([key, val]) => /remote|applied|database/i.test(key) && Boolean(val));
    const explicitlyLocalOnly = entries.some(([key, val]) => /local/i.test(key) && Boolean(val)) && !remoteish;
    if (version && !explicitlyLocalOnly) out.add(String(version));

    for (const [key, val] of entries) {
      for (const nested of flattenRemoteVersionsFromJson(val, [...pathParts, key])) out.add(nested);
    }
    return out;
  }

  if (typeof value === "string" && /^\d{14}$/.test(value) && pathParts.some((part) => /remote|migration/i.test(part))) {
    out.add(value);
  }

  return out;
}

function parsePrettyRemoteVersions(text) {
  const versions = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !/\d{14}/.test(line)) continue;

    const parts = line
      .split(/[│|]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const remote = parts[1].match(/\d{14}/)?.[0];
      if (remote) versions.add(remote);
      continue;
    }

    const all = line.match(/\d{14}/g) ?? [];
    for (const version of all) versions.add(version);
  }
  return versions;
}

function listRemoteMigrations() {
  if (process.env.SUPABASE_REMOTE_MIGRATION_VERSION) {
    return {
      versions: new Set([process.env.SUPABASE_REMOTE_MIGRATION_VERSION.trim()]),
      isCompleteHistory: false,
    };
  }

  const cli = supabaseCliPath();
  const dbUrl =
    process.env.SUPABASE_MIGRATION_CHECK_DB_URL ||
    process.env.SUPABASE_DB_PUSH_URL ||
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL;
  const migrationArgs = ["migration", "list", "--output", "json"];
  if (dbUrl) migrationArgs.push("--db-url", dbUrl);
  else migrationArgs.push("--linked");

  const args =
    cli.endsWith("supabase") || cli.endsWith("supabase.exe")
      ? migrationArgs
      : ["supabase", ...migrationArgs];

  const result = spawnSync(cli, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(
      [
        "Could not read remote Supabase migration history.",
        output,
        "Set SUPABASE_MIGRATION_CHECK_DB_URL or link the project with `supabase link`, then retry.",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const versions = flattenRemoteVersionsFromJson(parsed);
    if (versions.size > 0) return { versions, isCompleteHistory: true };
  } catch {
    // Fall back to pretty/table parsing below.
  }

  const versions = parsePrettyRemoteVersions(output);
  if (versions.size === 0) {
    throw new Error(`Could not parse remote migration list output:\n${output}`);
  }
  return { versions, isCompleteHistory: true };
}

loadEnvFile(".env.local");
loadEnvFile(".env");

try {
  const local = listLocalMigrations();
  const latestLocal = local.at(-1);
  console.log(`Latest local migration: ${latestLocal.version} (${latestLocal.name})`);

  if (localOnly) {
    process.exit(0);
  }

  const { versions: remoteVersions, isCompleteHistory } = listRemoteMigrations();
  const sortedRemote = [...remoteVersions].sort();
  const latestRemote = sortedRemote.at(-1) ?? "none";
  console.log(`Latest remote migration: ${latestRemote}`);

  if (isCompleteHistory) {
    const missingLocal = local.filter((migration) => !remoteVersions.has(migration.version));
    if (missingLocal.length > 0) {
      const preview = missingLocal
        .slice(0, 12)
        .map((migration) => `- ${migration.version} (${migration.name})`)
        .join("\n");
      const remaining = missingLocal.length > 12 ? `\n...and ${missingLocal.length - 12} more.` : "";
      console.error(
        [
          "Supabase migration drift detected.",
          `Remote is missing ${missingLocal.length} local migration(s):`,
          `${preview}${remaining}`,
          "Run `npm run db:push` or `npm run db:push:env` against the intended staging/production project before deploying Vercel.",
        ].join("\n")
      );
      process.exit(1);
    }
  } else if (!remoteVersions.has(latestLocal.version)) {
    console.error(
      [
        "Supabase migration drift detected.",
        `Remote is missing latest local migration ${latestLocal.name}.`,
        "Run `npm run db:push` or `npm run db:push:env` against the intended staging/production project before deploying Vercel.",
      ].join("\n")
    );
    process.exit(1);
  } else {
    console.warn(
      "SUPABASE_REMOTE_MIGRATION_VERSION only verifies the latest local migration; use a DB URL or linked project to verify full history."
    );
  }

  console.log("Supabase migration history is in sync with local migrations.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
