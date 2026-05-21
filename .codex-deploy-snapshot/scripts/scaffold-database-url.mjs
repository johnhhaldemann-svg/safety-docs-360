/**
 * Appends DATABASE_URL to .env.local using your NEXT_PUBLIC_SUPABASE_URL project ref.
 * You must replace REPLACE_WITH_DATABASE_PASSWORD with your real database password
 * (Supabase → Project Settings → Database), or paste the full Session pooler URI instead.
 *
 * Usage: npm run db:scaffold-url
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local — copy .env.example first.");
  process.exit(1);
}

let text = fs.readFileSync(envPath, "utf8");

if (/^\s*DATABASE_URL\s*=/m.test(text) || /^\s*DIRECT_URL\s*=/m.test(text)) {
  console.log(".env.local already has DATABASE_URL or DIRECT_URL — not changing.");
  process.exit(0);
}

let ref = null;
for (const line of text.split("\n")) {
  const m = line.match(
    /^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*https?:\/\/([a-z0-9]+)\.supabase\.co/i
  );
  if (m) {
    ref = m[1];
    break;
  }
}

if (!ref) {
  console.error(
    "Could not find NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co in .env.local."
  );
  process.exit(1);
}

const block = `

# --- Database URL for: npm run db:push:env (IPv4-friendly session pooler, port 5432) ---
# Replace REPLACE_WITH_DATABASE_PASSWORD with your database password (Dashboard → Database).
# If you get "Tenant or user not found", run: npm run db:try-pooler — or paste the exact Session pooler URI from Connect.
DATABASE_URL=postgresql://postgres.${ref}:REPLACE_WITH_DATABASE_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres
`;

fs.appendFileSync(envPath, block, "utf8");
console.log(
  "Appended DATABASE_URL (session pooler template for ref " +
    ref +
    ").\n" +
    "Replace REPLACE_WITH_DATABASE_PASSWORD, then npm run db:push:env (or npm run db:try-pooler if the pooler host is wrong)."
);
