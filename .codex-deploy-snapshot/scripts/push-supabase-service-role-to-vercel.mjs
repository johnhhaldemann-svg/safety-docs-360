/**
 * Sets SUPABASE_SERVICE_ROLE_KEY on Vercel **Production** from .env.local (stdin to CLI).
 *
 * Preview / Development: your project may already use the legacy typo name
 * SUPABASE_SERIVCE_ROLE_KEY (all envs) — lib/supabaseAdmin.ts reads that too. To add the
 * canonical name for Preview, run (replace … with the key from Supabase Dashboard):
 *
 *   npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview --value "…" --yes --sensitive --force
 *
 * Same pattern with `development` for local `vercel dev` if needed.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
let raw;
try {
  raw = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env.local (copy from .env.example and add keys).");
  process.exit(1);
}

const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
if (!m) {
  console.error(".env.local must contain SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

let val = m[1].trim();
if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
  val = val.slice(1, -1);
}

const cmd =
  "npx --yes vercel@latest env add SUPABASE_SERVICE_ROLE_KEY production --yes --sensitive --force";
const r = spawnSync(cmd, {
  cwd: root,
  shell: true,
  input: `${val}\n`,
  encoding: "utf8",
  stdio: ["pipe", "inherit", "inherit"],
});

if (r.status !== 0) {
  console.error(`Failed (exit ${r.status ?? "unknown"}). Try: npx vercel login`);
  process.exit(1);
}

console.log("SUPABASE_SERVICE_ROLE_KEY set for Vercel Production. Redeploy to pick up changes.");
