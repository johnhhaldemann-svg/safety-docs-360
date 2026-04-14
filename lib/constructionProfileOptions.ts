/**
 * Canonical lists for construction profile trade + site position.
 * Profile and training requirements both use these so matrix scoping lines up with user picks.
 */
import {
  CONSTRUCTION_TRADE_LABELS,
  LEGACY_CONSTRUCTION_TRADE_LABELS,
} from "@/lib/sharedTradeTaxonomy";

export const CONSTRUCTION_TRADES = [...CONSTRUCTION_TRADE_LABELS] as unknown as readonly string[];

export const CONSTRUCTION_POSITIONS = [
  "Superintendent",
  "Assistant Superintendent",
  "General Foreman",
  "Foreman",
  "Working Foreman",
  "Project Manager",
  "Project Engineer",
  "Site Safety Manager",
  "Safety Coordinator",
  "QC / QA Inspector",
  "Trade Lead / Crew Lead",
  "Journeyman",
  "Apprentice",
  "Laborer",
  "Equipment Operator",
  "Warehouse / Logistics",
  "Office / Field Engineer",
  "Estimator / Preconstruction",
] as const;

export type ConstructionTrade = (typeof CONSTRUCTION_TRADES)[number];
export type ConstructionPosition = (typeof CONSTRUCTION_POSITIONS)[number];

const TRADE_SET = new Set<string>([...CONSTRUCTION_TRADE_LABELS, ...LEGACY_CONSTRUCTION_TRADE_LABELS]);
const POSITION_SET = new Set<string>(CONSTRUCTION_POSITIONS);

export function isAllowedConstructionTrade(value: string): boolean {
  return TRADE_SET.has(value.trim());
}

export function isAllowedConstructionPosition(value: string): boolean {
  return POSITION_SET.has(value.trim());
}

export function filterAllowedTrades(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const s = String(v).trim();
    if (s && TRADE_SET.has(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

export function filterAllowedPositions(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const s = String(v).trim();
    if (s && POSITION_SET.has(s) && !out.includes(s)) out.push(s);
  }
  return out;
}
