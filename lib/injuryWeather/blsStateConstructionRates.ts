import blsDataset from "@/lib/injuryWeather/datasets/blsStateConstructionRates.json";
import {
  effectiveTradeWeatherWeightFromByTrade,
  getTradeWeatherWeight,
} from "@/lib/injuryWeather/locationWeather";
import { INJURY_WEATHER_MODEL } from "@/lib/injuryWeather/riskModel";

export type BlsConstructionRateRow = {
  y: number;
  sc: string;
  ind: string;
  naics?: string;
  trc: number;
  dart?: number;
  url?: string;
};

export type BlsConstructionRatesDataset = {
  meta: {
    source: string;
    sourceWorkbook: string;
    sheet: string;
    generatedAt: string;
    coveredStates: string[];
    rowCount: number;
  };
  rows: BlsConstructionRateRow[];
};

type IndustryMatcher =
  | { kind: "exact"; ind: string; naics?: string }
  | { kind: "includes"; sub: string };

/**
 * Map dashboard / SOR trade labels to BLS `Industry_or_Trade` rows (exact or substring).
 * More specific matchers first.
 */
const TRADE_INDUSTRY_MATCHERS: Record<string, IndustryMatcher[]> = {
  "General Contractor": [
    { kind: "exact", ind: "Construction", naics: "23" },
    { kind: "exact", ind: "Construction" },
  ],
  "Steel Work": [
    { kind: "includes", sub: "Foundation, structure, and building exterior" },
    { kind: "includes", sub: "Building equipment contractors" },
  ],
  Electrical: [
    { kind: "includes", sub: "Electrical contractors and other wiring installation contractors" },
    { kind: "includes", sub: "Electrical contractors" },
  ],
  Roofing: [{ kind: "includes", sub: "Roofing contractors" }],
  Concrete: [
    { kind: "includes", sub: "Building equipment contractors" },
    { kind: "includes", sub: "Nonresidential building construction" },
  ],
  Carpentry: [
    { kind: "includes", sub: "Building finishing contractors" },
    { kind: "includes", sub: "Nonresidential building construction" },
  ],
  Plumbing: [{ kind: "includes", sub: "Plumbing, heating, and air-conditioning contractors" }],
  HVAC: [{ kind: "includes", sub: "Plumbing, heating, and air-conditioning contractors" }],
  Masonry: [
    { kind: "includes", sub: "Foundation, structure, and building exterior" },
    { kind: "includes", sub: "Specialty trade contractors" },
  ],
  Earthworks: [
    { kind: "includes", sub: "Site preparation contractors" },
    { kind: "includes", sub: "Heavy and civil engineering construction" },
  ],
  Demolition: [
    { kind: "includes", sub: "Other specialty trade contractors" },
    { kind: "includes", sub: "Building demolition" },
  ],
  Glazing: [{ kind: "includes", sub: "Building finishing contractors" }],
  Scaffolding: [{ kind: "includes", sub: "Building equipment contractors" }],
  Roadwork: [
    { kind: "includes", sub: "Highway, street, and bridge construction" },
    { kind: "includes", sub: "Utility system construction" },
  ],
  Landscaping: [
    { kind: "includes", sub: "Site preparation contractors" },
    { kind: "includes", sub: "Other specialty trade contractors" },
  ],
  Drywall: [{ kind: "includes", sub: "Drywall and insulation contractors" }],
  Painting: [{ kind: "includes", sub: "Building finishing contractors" }],
};

const BLS_RATIO_SENSITIVITY = 0.4;

function rowMatchesMatcher(m: IndustryMatcher, r: BlsConstructionRateRow): boolean {
  if (m.kind === "exact") {
    if (r.ind !== m.ind) return false;
    if (m.naics != null && r.naics !== m.naics) return false;
    return true;
  }
  return r.ind.toLowerCase().includes(m.sub.toLowerCase());
}

function findBlsRowForTrade(
  stateCode: string,
  year: number,
  tradeLabel: string,
  rows: BlsConstructionRateRow[]
): BlsConstructionRateRow | null {
  const matchers = TRADE_INDUSTRY_MATCHERS[tradeLabel.trim()];
  if (!matchers?.length) return null;
  const pool = rows.filter((r) => r.sc === stateCode && r.y === year);
  for (const m of matchers) {
    const hit = pool.find((r) => rowMatchesMatcher(m, r));
    if (hit) return hit;
  }
  return null;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** One TRC per state: BLS "Construction" NAICS 23 aggregate when present. */
function constructionAggregateReferenceTrc(year: number, rows: BlsConstructionRateRow[]): number | null {
  const perState = new Map<string, number>();
  for (const r of rows) {
    if (r.y !== year) continue;
    if (r.ind === "Construction" && r.naics === "23" && !perState.has(r.sc)) {
      perState.set(r.sc, r.trc);
    }
  }
  const vals = [...perState.values()];
  if (vals.length === 0) return null;
  return median(vals);
}

function referenceTrcForIndustry(
  year: number,
  industryLabel: string,
  rows: BlsConstructionRateRow[]
): number | null {
  const sameIndustry = rows.filter((r) => r.y === year && r.ind === industryLabel).map((r) => r.trc);
  if (sameIndustry.length >= 2) return median(sameIndustry);
  return constructionAggregateReferenceTrc(year, rows);
}

function trcToTradeWeatherWeight(trc: number, referenceTrc: number): number {
  const lo = INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MIN;
  const hi = INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MAX;
  const ratio = trc / Math.max(0.05, referenceTrc);
  const w = 1 + (ratio - 1) * BLS_RATIO_SENSITIVITY;
  return Math.min(hi, Math.max(lo, w));
}

function calendarYearFromMonthLabel(monthLabel: string): number {
  const d = new Date(monthLabel.trim());
  if (!Number.isNaN(d.getTime())) return d.getFullYear();
  return new Date().getFullYear();
}

/** Pick BLS table year: forecast month year if present for state, else latest year in dataset for that state. */
export function resolveBlsYearForState(
  monthLabel: string,
  stateCode: string,
  rows: BlsConstructionRateRow[]
): number | null {
  const code = stateCode.trim().toUpperCase();
  const want = calendarYearFromMonthLabel(monthLabel);
  const stateYears = [...new Set(rows.filter((r) => r.sc === code).map((r) => r.y))].sort((a, b) => b - a);
  if (stateYears.length === 0) return null;
  if (stateYears.includes(want)) return want;
  return stateYears[0];
}

export function blsTradeRateDisclosureForDataset(dataset: BlsConstructionRatesDataset): string {
  const cs = dataset.meta.coveredStates.join(", ");
  return `Trade mix weight blends BLS state SOII construction total recordable case rates when an industry row matches your signal trades. The ingested dataset covers ${cs} only; other states use heuristic trade weights until more state tables are added.`;
}

function weightForTradeLabel(
  tradeLabel: string,
  stateCode: string,
  year: number,
  rows: BlsConstructionRateRow[]
): number {
  const blsRow = findBlsRowForTrade(stateCode, year, tradeLabel, rows);
  if (!blsRow) return getTradeWeatherWeight(tradeLabel);
  const ref = referenceTrcForIndustry(year, blsRow.ind, rows);
  if (ref == null || ref <= 0) return getTradeWeatherWeight(tradeLabel);
  return trcToTradeWeatherWeight(blsRow.trc, ref);
}

/**
 * Signal-count weighted trade weather weight: BLS TRC-based weights when state is in the dataset,
 * otherwise identical to `effectiveTradeWeatherWeightFromByTrade`.
 */
export function effectiveTradeWeatherWeightFromByTradeWithBls(
  stateCode: string | undefined | null,
  byTrade: Map<string, Map<string, number>>,
  monthLabel: string,
  dataset: BlsConstructionRatesDataset = blsDataset as BlsConstructionRatesDataset
): { weight: number; blsTradeRateNote?: string } {
  const heuristic = effectiveTradeWeatherWeightFromByTrade(byTrade);
  const code = (stateCode ?? "").trim().toUpperCase();
  if (!code || !dataset.meta.coveredStates.includes(code)) {
    return { weight: heuristic };
  }
  const year = resolveBlsYearForState(monthLabel, code, dataset.rows);
  if (year == null) return { weight: heuristic };

  let sum = 0;
  let total = 0;
  for (const [tradeLabel, cats] of byTrade.entries()) {
    const rowCount = [...cats.values()].reduce((a, b) => a + b, 0);
    const w = weightForTradeLabel(tradeLabel, code, year, dataset.rows);
    sum += rowCount * w;
    total += rowCount;
  }
  const note = blsTradeRateDisclosureForDataset(dataset);
  if (total <= 0) {
    return { weight: 1, blsTradeRateNote: note };
  }
  return { weight: sum / total, blsTradeRateNote: note };
}
