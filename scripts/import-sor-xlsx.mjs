/**
 * Bulk-import SOR-style rows from "SOR Fixed.xlsx" (sheet "Keyword Reworked")
 * into `public.company_sor_records`.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           SOR_IMPORT_COMPANY_ID (must equal a real row in `public.companies`).
 *
 * Optional: SOR_IMPORT_PROJECT (default "Imported workbook"),
 *           SOR_IMPORT_LOCATION (default "Field"),
 *           SOR_IMPORT_DRY_RUN=1 — parse only, no DB writes (remove or set to 0 for real import).
 *
 * Usage:
 *   node scripts/import-sor-xlsx.mjs --list-companies
 *   node scripts/import-sor-xlsx.mjs "C:/path/to/SOR Fixed.xlsx"
 *   node scripts/import-sor-xlsx.mjs --dry-run "C:/path/to/SOR Fixed.xlsx"
 *
 * If insert fails with:
 *   violates foreign key constraint "company_sor_records_company_id_fkey"
 * then SOR_IMPORT_COMPANY_ID is not a valid `companies.id`. Fix:
 *   1. Supabase → Table Editor → `companies` → copy the `id` UUID for the company that should own the rows.
 *   2. In `.env.local` set: SOR_IMPORT_COMPANY_ID=<that-uuid>
 *   3. Ensure SOR_IMPORT_DRY_RUN is not 1 (or unset) when you want a real import.
 *   4. Or run `node scripts/import-sor-xlsx.mjs --list-companies` (same Supabase env) and paste one `id`.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import XLSX from "xlsx";

function applyEnvFile(path, overrideExisting) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (overrideExisting || process.env[key] === undefined) process.env[key] = val;
  }
}

/** `.env.local` overrides shell and `.env` so SOR_IMPORT_COMPANY_ID is not stuck on a stale env var. */
function loadEnvFiles() {
  applyEnvFile(resolve(process.cwd(), ".env"), false);
  applyEnvFile(resolve(process.cwd(), ".env.local"), true);
}

function inferTradeFromRow(row) {
  const haystack = `${row.category ?? ""} ${row.subcategory ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (haystack.includes("carpent") || haystack.includes("framing") || haystack.includes("millwork")) return "Carpentry";
  if (haystack.includes("roof") || haystack.includes("ladder") || haystack.includes("harness")) return "Roofing";
  if (haystack.includes("electrical") || haystack.includes("loto") || haystack.includes("power") || haystack.includes("wiring"))
    return "Electrical";
  if (haystack.includes("concrete") || haystack.includes("formwork") || haystack.includes("rebar")) return "Concrete";
  if (haystack.includes("rigging") || haystack.includes("steel") || haystack.includes("welding")) return "Steel Work";
  return "General Contractor";
}

function normalizeSeverity(raw) {
  const s = String(raw ?? "medium").toLowerCase().trim();
  if (["low", "medium", "high", "critical"].includes(s)) return s;
  return "medium";
}

function mapRow(row, { companyId, project, location }) {
  const observed = row.observed_at instanceof Date ? row.observed_at : new Date(row.observed_at);
  if (Number.isNaN(observed.getTime())) {
    throw new Error(`Bad observed_at for external_id=${row.external_id}`);
  }
  const dateStr = observed.toISOString().slice(0, 10);
  const statusRaw = String(row.status ?? "").toLowerCase();
  const status = statusRaw === "closed" ? "locked" : "submitted";

  return {
    company_id: companyId,
    date: dateStr,
    project,
    location,
    trade: inferTradeFromRow(row),
    category: String(row.category ?? "General Observation").trim() || "General Observation",
    subcategory: row.subcategory ? String(row.subcategory).trim() : null,
    description: String(row.description ?? "").trim() || "(no description)",
    severity: normalizeSeverity(row.severity),
    created_at: observed.toISOString(),
    created_by: null,
    updated_by: null,
    status,
    version_number: 1,
    previous_version_id: null,
    record_hash: null,
    previous_hash: null,
    change_reason: `Excel import; external_id=${row.external_id}; observation_type=${row.observation_type ?? ""}`,
    is_deleted: false,
  };
}

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  for (const a of argv.slice(2)) {
    if (a.startsWith("--")) flags.add(a);
    else positional.push(a);
  }
  return {
    listCompanies: flags.has("--list-companies"),
    dry: flags.has("--dry-run") || process.env.SOR_IMPORT_DRY_RUN === "1",
    filePath: resolve(positional[0] || "C:/Users/johnh/OneDrive/SOR Fixed.xlsx"),
  };
}

async function listCompanies(url, key) {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from("companies").select("id, name, team_key, status").order("name");
  if (error) {
    console.error("Failed to list companies:", error.message);
    process.exit(1);
  }
  if (!data?.length) {
    console.log("No rows in public.companies. Create a company first.");
    return;
  }
  console.log("Set SOR_IMPORT_COMPANY_ID in .env.local to one of these ids:\n");
  for (const row of data) {
    console.log(`  ${row.id}  ${row.name}  (${row.team_key}, ${row.status})`);
  }
  console.log("\nExample .env.local line:\n  SOR_IMPORT_COMPANY_ID=<paste-uuid-above>");
}

function fkHelp() {
  console.error(`
Foreign key error (company_sor_records_company_id_fkey): SOR_IMPORT_COMPANY_ID must be a real public.companies.id.

1. Supabase → Table Editor → companies → copy the id for the company that should own imported SOR rows.
2. In .env.local: SOR_IMPORT_COMPANY_ID=<that-uuid>
3. Remove SOR_IMPORT_DRY_RUN=1 (or set to 0) for a real import.
4. Run: node scripts/import-sor-xlsx.mjs --list-companies
`);
}

async function main() {
  loadEnvFiles();

  const { listCompanies: doList, dry, filePath } = parseArgs(process.argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const companyId = process.env.SOR_IMPORT_COMPANY_ID?.trim();
  const project = process.env.SOR_IMPORT_PROJECT?.trim() || "Imported workbook";
  const location = process.env.SOR_IMPORT_LOCATION?.trim() || "Field";

  if (doList) {
    if (!url || !key) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
      process.exit(1);
    }
    await listCompanies(url, key);
    return;
  }

  if (!existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }
  if (!companyId) {
    console.error("Set SOR_IMPORT_COMPANY_ID to your companies.id UUID, or run: node scripts/import-sor-xlsx.mjs --list-companies");
    process.exit(1);
  }
  if (!dry && (!url || !key)) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for import.");
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames.includes("Keyword Reworked") ? "Keyword Reworked" : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet).filter((row) => {
    const id = row.external_id;
    const hasId = id !== undefined && id !== null && String(id).trim() !== "";
    const hasObs = row.observed_at !== undefined && row.observed_at !== null && row.observed_at !== "";
    return hasId && hasObs;
  });
  console.log("Sheet:", sheetName, "data rows (after filter):", rows.length);

  const payloads = rows.map((row) => mapRow(row, { companyId, project, location }));

  if (dry) {
    console.log("Dry run — first row:", JSON.stringify(payloads[0], null, 2));
    console.log("Dry run — last row:", JSON.stringify(payloads[payloads.length - 1], null, 2));
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const companyCheck = await supabase.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (companyCheck.error) {
    console.error("Could not verify company:", companyCheck.error.message);
    process.exit(1);
  }
  if (!companyCheck.data) {
    console.error(`No row in public.companies with id=${companyId}.`);
    fkHelp();
    process.exit(1);
  }

  const batchSize = 150;
  let inserted = 0;
  for (let i = 0; i < payloads.length; i += batchSize) {
    const chunk = payloads.slice(i, i + batchSize);
    const { data, error } = await supabase.from("company_sor_records").insert(chunk).select("id");
    if (error) {
      console.error("Insert failed at offset", i, error.message);
      if (error.message?.includes("company_sor_records_company_id_fkey") || error.code === "23503") {
        fkHelp();
      }
      process.exit(1);
    }
    inserted += data?.length ?? 0;
    console.log("Inserted", inserted, "/", payloads.length);
  }

  console.log("Done. Total rows inserted:", inserted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
