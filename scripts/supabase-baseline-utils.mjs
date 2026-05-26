import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, "..");
export const productionProjectRef = "mdqkfbnwxrasdmbsjcqv";
export const defaultStagingProjectRef = "dacafxrcrijqevgjotjc";
export const baselineVersion = "20260522135305";
export const baselineName = "gus_planning_sessions";
export const baselineDir = path.join(root, "supabase", "baseline");
export const baselinePath = path.join(baselineDir, `${baselineVersion}_schema.sql`);
export const storageConfigPath = path.join(baselineDir, `${baselineVersion}_storage_config.sql`);

export function loadEnvFile(name) {
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

export function loadDefaultEnv() {
  loadEnvFile(".env.staging.local");
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

export function supabaseCliPath() {
  const win = process.platform === "win32";
  const exe = path.join(root, "node_modules", "supabase", "bin", win ? "supabase.exe" : "supabase");
  if (fs.existsSync(exe)) return exe;
  return win ? "npx.cmd" : "npx";
}

export function supabaseArgs(args) {
  const cli = supabaseCliPath();
  return {
    cli,
    args: cli.endsWith("supabase") || cli.endsWith("supabase.exe") ? args : ["supabase", ...args],
  };
}

export function inferProjectRef(value) {
  if (!value) return null;

  const supabaseHost = String(value).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (supabaseHost) return supabaseHost[1];

  const poolerUser = String(value).match(/postgres\.([a-z0-9]+):/i);
  if (poolerUser) return poolerUser[1];

  const dbHost = String(value).match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (dbHost) return dbHost[1];

  return null;
}

export function validateDbUrl(label, dbUrl) {
  if (!dbUrl) {
    throw new Error(`Missing ${label}. Set it in the environment or .env.staging.local.`);
  }
  if (dbUrl.includes("REPLACE_WITH_DATABASE_PASSWORD")) {
    throw new Error(`${label} still contains REPLACE_WITH_DATABASE_PASSWORD.`);
  }
  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    throw new Error(`${label} must be a Postgres connection string.`);
  }
}

export function validateSchemaOnlySql(sql, label) {
  const forbidden = [
    [/^\s*copy\s+/im, "COPY data block"],
    [/^--\s*Data for Name:/im, "pg_dump data section"],
    [/^\s*(copy|insert)\s+.*\bauth\.users\b/im, "auth.users data statement"],
    [/\bsupabase_migrations\.schema_migrations\b/i, "migration history reference"],
    [/\bservice_role\b[^;]*eyJ/i, "possible service-role JWT"],
    [/\bsk-[A-Za-z0-9_-]{20,}\b/, "possible API key"],
  ];

  for (const [pattern, reason] of forbidden) {
    if (pattern.test(sql)) {
      throw new Error(`${label} failed schema-only validation: found ${reason}.`);
    }
  }
}
