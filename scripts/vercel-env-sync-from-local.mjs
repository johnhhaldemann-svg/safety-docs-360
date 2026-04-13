/**
 * Adds CRON_SECRET to Vercel Production + Preview from .env.local (matches local cron auth).
 * Set NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL in the Vercel UI for each environment if needed.
 *
 * Usage: node scripts/vercel-env-sync-from-local.mjs
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const text = readFileSync(envPath, "utf8");

const vars = {};
for (const line of text.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  vars[k] = v;
}

function addEnv(name, value, env, sensitive) {
  const args = [
    "vercel@latest",
    "env",
    "add",
    name,
    env,
    "--value",
    value,
    "--yes",
    ...(sensitive ? ["--sensitive"] : []),
    "--force",
  ];
  const r = spawnSync("npx", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "inherit", "inherit"],
  });
  return r.status === 0;
}

if (!vars.CRON_SECRET) {
  console.error("Missing CRON_SECRET in .env.local");
  process.exit(1);
}

let ok = 0;
let fail = 0;
/** Production crons use this. Preview: add CRON_SECRET in Vercel UI per preview branch if needed. */
if (addEnv("CRON_SECRET", vars.CRON_SECRET, "production", true)) ok++;
else fail++;

console.log(`CRON_SECRET on Vercel: ${ok} ok, ${fail} failed.`);
