/**
 * Runs `supabase db push` using DATABASE_URL or DIRECT_URL from .env.local / .env.
 * Dashboard: Project Settings → Database → Connect → Session pooler (IPv4-friendly) → URI.
 *
 * Usage: npm run db:push:env
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFile(name) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!dbUrl) {
  console.error(
    "Missing DATABASE_URL (or DIRECT_URL) in .env.local.\n" +
      "Run: npm run db:scaffold-url\n" +
      "Or add the Postgres URI from Supabase → Connect → Session pooler → URI (replace [YOUR-PASSWORD])."
  );
  process.exit(1);
}
if (dbUrl.includes("REPLACE_WITH_DATABASE_PASSWORD")) {
  console.error(
    "DATABASE_URL still contains REPLACE_WITH_DATABASE_PASSWORD.\n" +
      "Open .env.local and replace it with your real database password (URL-encode special characters if needed)."
  );
  process.exit(1);
}

/** Prefer bundled CLI binary — spawnSync("npx", …) can fail with EINVAL on some Windows setups. */
function supabaseCliPath() {
  const win = process.platform === "win32";
  const exe = path.join(root, "node_modules", "supabase", "bin", win ? "supabase.exe" : "supabase");
  if (fs.existsSync(exe)) return exe;
  return win ? "npx.cmd" : "npx";
}

const cli = supabaseCliPath();
const args =
  cli.endsWith("supabase") || cli.endsWith("supabase.exe")
    ? ["db", "push", "--yes", "--db-url", dbUrl]
    : ["supabase", "db", "push", "--yes", "--db-url", dbUrl];

const r = spawnSync(cli, args, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
  shell: false,
});

process.exit(r.status === null ? 1 : r.status);
