/**
 * Internal normalized priors when company-specific signals are thin or absent.
 * Not published injury rates — configurable starting points for the fallback path only.
 */

import { DYNAMIC_INJURY_FORECAST } from "./constants";

/** When no trade can be resolved. */
export const DEFAULT_GENERAL_RISK_BASELINE = 0.3;

/**
 * Default trade baseline (0–1 scale) — drives fallback λ before context multipliers.
 * Keys are lowercase slugs; match via `tradeLabelToDefaultKey`.
 */
export const TRADE_DEFAULT_RISK: Record<string, number> = {
  general_construction: 0.32,
  electrical: 0.28,
  plumbing: 0.24,
  steel_erection: 0.48,
  steel_work: 0.45,
  concrete: 0.42,
  excavation: 0.46,
  roofing: 0.52,
  interiors: 0.22,
  mechanical: 0.27,
  equipment_ops: 0.38,
  general_contractor: 0.32,
  demolition: 0.44,
  painting: 0.2,
  glazing: 0.26,
  flooring: 0.21,
  hvac: 0.27,
  fire_protection: 0.25,
};

/** Multipliers by calendar month (0 = Jan). Peaks in mid-year outdoor work. */
export const MONTH_SEASON_MULTIPLIER: readonly number[] = [
  1.05, 1.02, 1.0, 0.98, 1.02, 1.08, 1.12, 1.12, 1.06, 1.0, 1.0, 1.06,
];

export type ProjectPhaseKey = "preconstruction" | "mobilization" | "peak" | "closeout" | "unknown";

export const PROJECT_PHASE_MULTIPLIER: Record<ProjectPhaseKey, number> = {
  preconstruction: 0.92,
  mobilization: 1.08,
  peak: 1.15,
  closeout: 1.06,
  unknown: 1.0,
};

/** High-risk task tags from UI / future structured inputs. */
export const TASK_HAZARD_MULTIPLIER: Record<string, number> = {
  crane_pick: 1.18,
  rigging: 1.15,
  excavation_trench: 1.14,
  hot_work: 1.1,
  energized_work: 1.16,
  work_at_height: 1.12,
  temporary_power: 1.08,
  confined_space: 1.12,
  heavy_equipment: 1.1,
  default: 1.0,
};

function clampPositive(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Map dashboard trade label to `TRADE_DEFAULT_RISK` key. */
export function tradeLabelToDefaultKey(label: string): string | null {
  const s = label.trim().toLowerCase();
  if (!s) return null;
  const compact = s.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (TRADE_DEFAULT_RISK[compact] != null) return compact;
  if (/roof/.test(s)) return "roofing";
  if (/electric|wire|loto/.test(s)) return "electrical";
  if (/plumb|pipe/.test(s)) return "plumbing";
  if (/steel|iron|rebar|structural/.test(s)) return "steel_work";
  if (/concrete|pour|form/.test(s)) return "concrete";
  if (/excavat|trench|earth/.test(s)) return "excavation";
  if (/demo|demolition/.test(s)) return "demolition";
  if (/hvac|mechanical|sheet\s*metal/.test(s)) return "mechanical";
  if (/floor|interior|drywall|finish/.test(s)) return "interiors";
  if (/paint|coat/.test(s)) return "painting";
  if (/glaz|window/.test(s)) return "glazing";
  if (/fork|crane|rigg|lift|hoist|equipment/.test(s)) return "equipment_ops";
  if (/general|gc|contractor|construction manager/.test(s)) return "general_construction";
  if (/foundation|pile|forming|concrete/.test(s)) return "concrete";
  if (/grading|earthwork|site preparation|clearing/.test(s)) return "excavation";
  if (/road|highway|bridge|asphalt|utility|underground|landscape|irrigation/.test(s)) return "excavation";
  if (/masonry|brick|block|stucco|plaster/.test(s)) return "concrete";
  if (/wood framing|metal stud|drywall|ceiling|interior trim|flooring|tile|paint/.test(s)) return "interiors";
  if (/siding|cladding|waterproof|exterior trim|insulation/.test(s)) return "interiors";
  if (/glass|glazing|curtain|storefront|elevator|escalator|scaffold|hoist|rigg|weld/.test(s)) return "steel_work";
  if (/sheet metal|safety|environmental/.test(s)) return "general_construction";
  return null;
}

/**
 * Single trade baseline: max of matched defaults (conservative when multiple trades).
 */
export function resolveDefaultTradeBaseline(tradeLabels: string[]): number {
  if (!tradeLabels.length) return DEFAULT_GENERAL_RISK_BASELINE;
  let best = DEFAULT_GENERAL_RISK_BASELINE;
  for (const raw of tradeLabels) {
    const k = tradeLabelToDefaultKey(raw);
    if (k && TRADE_DEFAULT_RISK[k] != null) {
      best = Math.max(best, TRADE_DEFAULT_RISK[k]!);
    }
  }
  return clampPositive(best, 0.18, 0.65);
}

export function seasonMultiplierForMonth(monthIndex0: number): number {
  const i = Math.min(11, Math.max(0, monthIndex0));
  return MONTH_SEASON_MULTIPLIER[i] ?? 1;
}

export function projectPhaseMultiplier(phase: ProjectPhaseKey | null | undefined): number {
  if (!phase) return PROJECT_PHASE_MULTIPLIER.unknown;
  return PROJECT_PHASE_MULTIPLIER[phase] ?? 1;
}

export function taskHazardMultiplierFromTags(tags: string[] | undefined): number {
  if (!tags?.length) return 1;
  let m = 1;
  for (const t of tags) {
    const key = t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const u = TASK_HAZARD_MULTIPLIER[key] ?? TASK_HAZARD_MULTIPLIER.default;
    m *= u;
  }
  return clampPositive(m, 1, 1.45);
}

/**
 * State adjustment from climate/risk index (typically ~0.9–1.15).
 */
export function stateContextMultiplier(stateRateIndex: number | null | undefined): number {
  if (stateRateIndex == null || !Number.isFinite(stateRateIndex)) return 1;
  return clampPositive(0.88 + 0.12 * Math.min(1.2, Math.max(0.85, stateRateIndex)), 0.85, 1.18);
}

/**
 * Build fallback λ₃₀ (before global scale) from benchmark tables + context.
 * Always returns a positive finite value.
 */
export function computeFallbackLambdaCore(params: {
  tradeLabels: string[];
  monthIndex0: number;
  /** Engine weather layer multiplier (≥ 1 typically). */
  weatherMultiplier: number;
  stateRateIndex: number | null | undefined;
  projectPhase: ProjectPhaseKey | null | undefined;
  taskTags: string[] | undefined;
}): { lambdaCore: number; components: Record<string, number> } {
  const tradeBase = resolveDefaultTradeBaseline(params.tradeLabels);
  const seasonM = seasonMultiplierForMonth(params.monthIndex0);
  const weatherM = clampPositive(Number.isFinite(params.weatherMultiplier) ? params.weatherMultiplier : 1, 1, DYNAMIC_INJURY_FORECAST.WEATHER.MAX_MULTIPLIER);
  const phaseM = projectPhaseMultiplier(params.projectPhase);
  const taskM = taskHazardMultiplierFromTags(params.taskTags);
  const stateM = stateContextMultiplier(params.stateRateIndex);

  const exposureFloor = 1.08;
  const lambdaCore = tradeBase * seasonM * weatherM * phaseM * taskM * stateM * exposureFloor;

  return {
    lambdaCore: clampPositive(lambdaCore, 0.12, 2.8),
    components: { tradeBase, seasonM, weatherM, phaseM, taskM, stateM, exposureFloor },
  };
}
