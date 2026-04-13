/**
 * Finds working Supavisor session pooler host by trying aws-0/aws-1 + regions.
 * Reads postgres.<ref> and password from DATABASE_URL in .env.local, ref from NEXT_PUBLIC_SUPABASE_URL if needed.
 *
 * Usage: node scripts/try-supabase-pooler-push.mjs
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");
const text = fs.readFileSync(envPath, "utf8");

let ref = null;
for (const line of text.split("\n")) {
  const m = line.match(
    /^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*https?:\/\/([a-z0-9]+)\.supabase\.co/i
  );
  if (m) ref = m[1];
}

const urlLine = text.split("\n").find((l) => /^\s*DATABASE_URL\s*=/.test(l));
if (!urlLine || !ref) {
  console.error("Need DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

const pwMatch = urlLine.match(/postgres\.[a-z0-9]+:([^@]+)@/i);
const password = pwMatch ? decodeURIComponent(pwMatch[1]) : null;
if (!password) {
  console.error("Could not parse password from DATABASE_URL (expected postgres.<ref>:password@...)");
  process.exit(1);
}

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "eu-central-2",
  "eu-north-1",
  "eu-south-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "sa-east-1",
  "me-central-1",
  "me-south-1",
  "af-south-1",
  "ap-east-1",
];

const cli = path.join(
  root,
  "node_modules",
  "supabase",
  "bin",
  process.platform === "win32" ? "supabase.exe" : "supabase"
);

for (const aws of ["aws-0", "aws-1"]) {
  for (const region of regions) {
    const poolHostname = `${aws}-${region}.pooler.supabase.com`;
    const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolHostname}:5432/postgres`;
    const r = spawnSync(
      cli,
      ["db", "push", "--yes", "--db-url", dbUrl],
      { cwd: root, encoding: "utf8", env: process.env }
    );
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    if (r.status === 0) {
      console.log(`OK: ${poolHostname}`);
      const next = text.replace(
        /^\s*DATABASE_URL\s*=.*$/m,
        `DATABASE_URL=${dbUrl}`
      );
      if (next !== text) {
        fs.writeFileSync(envPath, next, "utf8");
        console.log("Updated DATABASE_URL in .env.local");
      }
      process.exit(0);
    }
    if (!out.includes("Tenant or user not found")) {
      console.log(`--- ${poolHostname} (exit ${r.status}) ---`);
      console.log(out.slice(0, 800));
    }
  }
}

console.error("No pooler host matched. Paste Session pooler URI from Dashboard → Connect.");
process.exit(1);
