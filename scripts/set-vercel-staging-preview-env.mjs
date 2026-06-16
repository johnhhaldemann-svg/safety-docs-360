/**
 * Sets staging Supabase env vars on Vercel Preview environment.
 * Reads the SUPABASE_SERVICE_ROLE_KEY for staging from .env.staging.local or prompts.
 *
 * Usage:
 *   STAGING_SERVICE_ROLE_KEY=eyJ... node scripts/set-vercel-staging-preview-env.mjs
 *
 * Or without env var (will fail gracefully and tell you what to set):
 *   node scripts/set-vercel-staging-preview-env.mjs
 */

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// --- 1. Load Vercel auth token ---
function loadVercelToken() {
  const locations = [
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), "AppData", "Roaming", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".config", "vercel", "auth.json"),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      try {
        const data = JSON.parse(fs.readFileSync(loc, "utf8"));
        if (data.token) return data.token;
      } catch {}
    }
  }
  throw new Error(
    "Vercel auth token not found. Run: npx vercel login"
  );
}

// --- 2. Load env files ---
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const vars = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    vars[k] = v;
  }
  return vars;
}

const localEnv = parseEnvFile(path.join(root, ".env.local"));

// --- 3. Staging env values ---
const STAGING_URL = "https://dacafxrcrijqevgjotjc.supabase.co";
const STAGING_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhY2FmeHJjcmlqcWV2Z2pvdGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDY4NzgsImV4cCI6MjA5NTM4Mjg3OH0.AftAC8MoePsX2_3gc0Gl6YK5V1THMQlf0wJr_5qgc1g";

// Service role key: pass via env var or .env.staging.local
const STAGING_SERVICE_ROLE_KEY =
  process.env.STAGING_SERVICE_ROLE_KEY ||
  parseEnvFile(path.join(root, ".env.staging.local")).STAGING_SERVICE_ROLE_KEY;

// Stripe test key: pass via env var or read from .env.local (test key, safe for preview)
const STRIPE_KEY =
  process.env.STAGING_STRIPE_SECRET_KEY ||
  (localEnv.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? localEnv.STRIPE_SECRET_KEY : null);

// CRON_SECRET: reuse the same secret as production (preview crons use the same auth)
const CRON_SECRET = process.env.STAGING_CRON_SECRET || localEnv.CRON_SECRET;

// --- 4. Vercel project config ---
const vercelConfig = JSON.parse(
  fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8")
);
const PROJECT_ID = vercelConfig.projectId;
const TEAM_ID = vercelConfig.orgId;

// --- 5. Vercel API helpers ---
async function upsertEnv(token, key, value, type, target) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // First try to find existing env entry for preview
  const listRes = await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&decrypt=false`,
    { headers }
  );
  if (!listRes.ok) throw new Error(`Failed to list env vars: ${listRes.status}`);
  const { envs } = await listRes.json();

  // Find any existing entries that cover "preview"
  const existing = envs.filter(
    (e) => e.key === key && e.target?.includes("preview")
  );

  if (existing.length > 0) {
    // Update the first matching entry
    const id = existing[0].id;
    const patchRes = await fetch(
      `https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${id}?teamId=${TEAM_ID}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ value, type, target }),
      }
    );
    if (!patchRes.ok) {
      const err = await patchRes.text();
      throw new Error(`PATCH ${key} failed (${patchRes.status}): ${err}`);
    }
    return "updated";
  } else {
    // Create new
    const postRes = await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ key, value, type, target }),
      }
    );
    if (!postRes.ok) {
      const err = await postRes.text();
      throw new Error(`POST ${key} failed (${postRes.status}): ${err}`);
    }
    return "created";
  }
}

// --- 6. Main ---
const token = loadVercelToken();
console.log(`Project: ${PROJECT_ID}  Team: ${TEAM_ID}\n`);

const vars = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    value: STAGING_URL,
    type: "plain",
    required: true,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    value: STAGING_ANON_KEY,
    type: "plain",
    required: true,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    value: STAGING_SERVICE_ROLE_KEY,
    type: "sensitive",
    required: false,
    missing: "Pass STAGING_SERVICE_ROLE_KEY=eyJ... as an env var before running this script",
  },
  {
    key: "STRIPE_SECRET_KEY",
    value: STRIPE_KEY,
    type: "sensitive",
    required: false,
    missing:
      "Pass STAGING_STRIPE_SECRET_KEY=sk_test_... as an env var, or add STRIPE_SECRET_KEY=sk_test_... to .env.local",
  },
  {
    key: "CRON_SECRET",
    value: CRON_SECRET,
    type: "sensitive",
    required: false,
    missing: "Add CRON_SECRET=... to .env.local",
  },
];

let ok = 0;
let skipped = 0;
let failed = 0;

for (const { key, value, type, required, missing } of vars) {
  if (!value) {
    console.warn(`  SKIP  ${key} — ${missing || "value not found"}`);
    skipped++;
    continue;
  }
  try {
    const result = await upsertEnv(token, key, value, type, ["preview"]);
    console.log(`  OK    ${key} (${result})`);
    ok++;
  } catch (err) {
    console.error(`  FAIL  ${key}: ${err.message}`);
    if (required) failed++;
    else skipped++;
  }
}

console.log(`\nDone: ${ok} set, ${skipped} skipped, ${failed} failed.`);
if (skipped > 0) {
  console.log("\nTo set skipped vars, re-run with env prefixes, e.g.:");
  console.log(
    "  STAGING_SERVICE_ROLE_KEY=eyJ... STAGING_STRIPE_SECRET_KEY=sk_test_... node scripts/set-vercel-staging-preview-env.mjs"
  );
}
if (ok > 0) {
  console.log("\nRedeploy Preview to pick up changes:");
  console.log("  npx vercel deploy");
}
