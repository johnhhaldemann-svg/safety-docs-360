/**
 * Writes a safe .env.staging.local template for Supabase staging bootstrap.
 *
 * Usage:
 *   npm run db:staging:scaffold-url
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.staging.local");
const stagingRef = process.env.STAGING_SUPABASE_REF || "dacafxrcrijqevgjotjc";

let text = "";
if (fs.existsSync(envPath)) {
  text = fs.readFileSync(envPath, "utf8");
}

const hasRef = /^\s*STAGING_SUPABASE_REF\s*=/m.test(text);
const hasDbUrl = /^\s*(STAGING_DATABASE_URL|SUPABASE_STAGING_DB_URL)\s*=/m.test(text);

if (hasRef && hasDbUrl) {
  console.log(".env.staging.local already has staging ref and database URL keys.");
  process.exit(0);
}

const lines = [];
if (text.trim().length > 0 && !text.endsWith("\n")) lines.push("");
if (!hasRef) lines.push(`STAGING_SUPABASE_REF=${stagingRef}`);
if (!hasDbUrl) {
  lines.push(
    "# Paste the exact Session pooler URI from Supabase Dashboard -> Project Settings -> Database -> Connect."
  );
  lines.push(
    "# Replace REPLACE_WITH_STAGING_DATABASE_PASSWORD with the staging database password."
  );
  lines.push(
    `STAGING_DATABASE_URL=postgresql://postgres.${stagingRef}:REPLACE_WITH_STAGING_DATABASE_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres`
  );
}

fs.appendFileSync(envPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Updated ${envPath}`);
console.log("Replace REPLACE_WITH_STAGING_DATABASE_PASSWORD before running npm run db:staging:bootstrap.");

