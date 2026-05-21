#!/usr/bin/env node
/**
 * Reads the same layout as the user's BLS export xlsx files and prints JSON
 * suitable for updating `lib/benchmarking/oshaConstructionNationalReference.ts`.
 *
 * Usage:
 *   node scripts/extract-osha-construction-xlsx.mjs "C:/path/2023 Const.xlsx" "C:/path/2023 fatal.xlsx"
 */
import XLSX from "xlsx";
function num(v) {
  if (v === "–" || v === "-" || v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findRow(matrix, pred) {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (pred(row, i)) return { row, i };
  }
  return null;
}

const [,, constPath, fatalPath] = process.argv;
if (!constPath || !fatalPath) {
  console.error('Usage: node scripts/extract-osha-construction-xlsx.mjs "<const.xlsx>" "<fatal.xlsx>"');
  process.exit(1);
}

const wbC = XLSX.readFile(constPath);
const shC = wbC.Sheets[wbC.SheetNames[0]];
const mC = XLSX.utils.sheet_to_json(shC, { header: 1, defval: "" });

const totalC = findRow(mC, (r) => String(r[0] ?? "").trim().toLowerCase() === "total:");
if (!totalC) throw new Error("Could not find Total row in construction DAFW file");
const allPriv = num(totalC.row[1]);
const cons = num(totalC.row[2]);

const med = findRow(mC, (r) => String(r[0] ?? "").toLowerCase().includes("median days away"));
const medianCons = med ? num(med.row[2]) : null;

function consCount(labelSubstring) {
  const hit = findRow(mC, (r) => String(r[0] ?? "").toLowerCase().includes(labelSubstring.toLowerCase()));
  return hit ? num(hit.row[2]) : null;
}

const wbF = XLSX.readFile(fatalPath);
const shF = wbF.Sheets[wbF.SheetNames[0]];
const mF = XLSX.utils.sheet_to_json(shF, { header: 1, defval: "" });
const totalF = findRow(mF, (r) => String(r[0] ?? "").trim().toLowerCase() === "total:");
if (!totalF) throw new Error("Could not find Total row in fatal file");
const fat23 = num(totalF.row[1]);
const fat24 = num(totalF.row[2]);

function fatal23(labelSubstring) {
  const hit = findRow(mF, (r) => String(r[0] ?? "").toLowerCase().includes(labelSubstring.toLowerCase()));
  return hit ? num(hit.row[1]) : null;
}

const out = {
  nonfatalDaysAwayFromWork: {
    allPrivateIndustryCases: allPriv,
    constructionCases: cons,
    medianDaysAwayConstruction: medianCons,
  },
  fatalitiesInConstruction: { year2023: fat23, year2024: fat24 },
  spotCheckNonfatal: {
    fallsSlipsTrips: consCount("falls, slips, trips"),
    contactIncidents: consCount("contact incidents"),
  },
  spotCheckFatal2023: {
    fallsSlipsTrips: fatal23("falls, slips, trips"),
    transportation: fatal23("transportation incidents"),
  },
};

console.log(JSON.stringify(out, null, 2));
