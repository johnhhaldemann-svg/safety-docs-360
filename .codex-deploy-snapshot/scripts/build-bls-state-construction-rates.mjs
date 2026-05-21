/**
 * Reads BLS best-effort workbook sheet `Construction_Quick_View` and writes
 * `lib/injuryWeather/datasets/blsStateConstructionRates.json`.
 *
 * Usage:
 *   node scripts/build-bls-state-construction-rates.mjs [path/to/best_effort_state_trade_injury_rates.xlsx]
 *
 * Default input (override with first CLI arg):
 *   %USERPROFILE%/Downloads/best_effort_state_trade_injury_rates.xlsx
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "lib", "injuryWeather", "datasets", "blsStateConstructionRates.json");

/** Mirrors `US_STATE_OPTIONS` in locationWeather.ts (name → two-letter code). */
const STATE_NAME_TO_CODE = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

function parseTrc(v) {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function defaultInputPath() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return path.join(home, "Downloads", "best_effort_state_trade_injury_rates.xlsx");
}

const inputArg = process.argv[2];
const xlsxPath = inputArg ? path.resolve(inputArg) : defaultInputPath();

if (!fs.existsSync(xlsxPath)) {
  console.error("Input file not found:", xlsxPath);
  console.error("Pass path as first argument or place the workbook in Downloads with the expected name.");
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const sheetName = "Construction_Quick_View";
if (!wb.SheetNames.includes(sheetName)) {
  console.error("Missing sheet:", sheetName, "in", xlsxPath);
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
const outRows = [];

for (const r of rows) {
  const year = Number(r.Year);
  const stateName = String(r.State_or_Territory ?? "").trim();
  const industry = String(r.Industry_or_Trade ?? "").trim();
  const naics = String(r.NAICS_Code ?? "").trim();
  const trc = parseTrc(r.TRC_Rate);
  if (!Number.isFinite(year) || !stateName || !industry || trc == null) continue;
  const stateCode = STATE_NAME_TO_CODE[stateName];
  if (!stateCode) continue;
  const dart = parseTrc(r.DART_Rate);
  const url = String(r.Source_URL ?? "").trim() || undefined;
  outRows.push({
    y: year,
    sc: stateCode,
    ind: industry,
    naics: naics || undefined,
    trc,
    dart: dart ?? undefined,
    url,
  });
}

outRows.sort((a, b) => a.sc.localeCompare(b.sc) || b.y - a.y || a.ind.localeCompare(b.ind));

const coveredStates = [...new Set(outRows.map((r) => r.sc))].sort();

const payload = {
  meta: {
    source: "BLS state SOII injury/illness rates (Construction_Quick_View)",
    sourceWorkbook: path.basename(xlsxPath),
    sheet: sheetName,
    generatedAt: new Date().toISOString(),
    coveredStates,
    rowCount: outRows.length,
  },
  rows: outRows,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log("Wrote", outPath, "rows:", outRows.length, "states:", coveredStates.join(", "));
