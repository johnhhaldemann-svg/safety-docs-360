/**
 * Canonical trade IDs + labels + lowercase aliases for exact resolution after normalization.
 * SOR `trade` is primary; category-text inference is fallback only (see `resolveTradeForRow`).
 */

import { CONSTRUCTION_TRADE_DEFINITIONS } from "@/lib/constructionTradeTaxonomy";

export type TradeCanonical = {
  id: string;
  label: string;
  aliases: string[];
};

/** Older profile / SOR free-text values → current taxonomy slug id */
const LEGACY_TRADE_TO_SLUG: Record<string, string> = {
  "general / multi-trade": "general_contractor",
  "survey / layout": "site_preparation_clearing",
  demolition: "demolition",
  earthwork: "earthwork",
  "excavation / utilities": "utility_underground_work",
  concrete: "concrete_forming_placement",
  "steel / ironwork": "steel_framing_structural_steel",
  masonry: "masonry_brick_block_stone",
  drywall: "drywall_metal_stud_framing",
  painting: "painting_wall_covering",
  flooring: "flooring_tile_carpet_hardwood_concrete_polishing",
  roofing: "roofing",
  electrical: "electrical",
  "mechanical / hvac": "hvac_mechanical",
  plumbing: "plumbing",
  "low voltage": "low_voltage_data_communications",
  "fire protection": "fire_protection_sprinklers",
  elevator: "elevators_escalators",
  landscaping: "landscaping_irrigation",
  "asphalt / paving": "asphalt_paving",
  "traffic control": "road_highway_construction",
  scaffolding: "scaffolding_hoisting",
  insulation: "insulation",
  other: "other_not_listed",
};

function uniqAliases(base: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of base) {
    const s = a.trim().toLowerCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Canonical craft labels for Injury Weather chips (unioned with trades seen in data). */
export const TRADE_CANONICAL: TradeCanonical[] = CONSTRUCTION_TRADE_DEFINITIONS.map((d) => ({
  id: d.slug,
  label: d.label,
  aliases: uniqAliases([
    d.label,
    d.slug.replace(/_/g, " "),
    d.slug.replace(/_/g, "/"),
  ]),
}));

/** Sorted labels from `TRADE_CANONICAL` — used to offer filters before a trade appears in safety data. */
export function curatedConstructionTradeLabels(): string[] {
  return [...TRADE_CANONICAL.map((t) => t.label)].sort((a, b) => a.localeCompare(b));
}

const ALIAS_TO_ID = new Map<string, { id: string; label: string }>();
for (const t of TRADE_CANONICAL) {
  const register = (s: string) => ALIAS_TO_ID.set(s.trim().toLowerCase(), { id: t.id, label: t.label });
  register(t.label);
  for (const a of t.aliases) register(a);
}
for (const [legacy, slug] of Object.entries(LEGACY_TRADE_TO_SLUG)) {
  const row = TRADE_CANONICAL.find((c) => c.id === slug);
  if (row) ALIAS_TO_ID.set(legacy, { id: row.id, label: row.label });
}

function slugId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return s.length ? `custom_${s}` : "custom_unknown";
}

/** Category/description fallback when DB trade is missing or unknown (CAPA/incident, or unresolved SOR trade). */
export function inferTradeFromCategoryText(text: string): { id: string; label: string } {
  const haystack = text.toLowerCase();
  if (haystack.includes("carpent") || haystack.includes("framing") || haystack.includes("millwork"))
    return { id: "wood_framing", label: "Wood Framing" };
  if (haystack.includes("roof")) return { id: "roofing", label: "Roofing" };
  if (haystack.includes("electrical") || haystack.includes("loto") || haystack.includes("arc flash") || haystack.includes("temporary power"))
    return { id: "electrical", label: "Electrical" };
  if (haystack.includes("concrete") || haystack.includes("formwork") || haystack.includes("rebar"))
    return { id: "concrete_forming_placement", label: "Concrete Forming & Placement" };
  if (haystack.includes("rigging") || haystack.includes("steel") || haystack.includes("welding") || haystack.includes("crane"))
    return { id: "steel_framing_structural_steel", label: "Steel Framing / Structural Steel" };
  return { id: "general_contractor", label: "General Contractor / Construction Manager" };
}

/**
 * Resolve primary trade from SOR `trade` string; exact/alias match only.
 * Returns null id only when input empty — caller may fall back to category inference.
 */
export function resolveTradeFromSorField(tradeRaw: string | null | undefined): { tradeId: string | null; tradeLabel: string } | null {
  const t = String(tradeRaw ?? "").trim();
  if (!t) return null;
  const hit = ALIAS_TO_ID.get(t.toLowerCase());
  if (hit) return { tradeId: hit.id, tradeLabel: hit.label };
  return { tradeId: slugId(t), tradeLabel: t };
}

export function resolveTradeForRow(args: {
  source: "sor" | "corrective_action" | "incident";
  sorTradeRaw?: string | null;
  categoryLabel: string;
}): { tradeId: string; tradeLabel: string; usedCategoryInference: boolean } {
  if (args.source === "sor") {
    const primary = resolveTradeFromSorField(args.sorTradeRaw);
    if (primary?.tradeId && !primary.tradeId.startsWith("custom_")) {
      return { tradeId: primary.tradeId, tradeLabel: primary.tradeLabel, usedCategoryInference: false };
    }
    if (primary?.tradeId?.startsWith("custom_")) {
      return { tradeId: primary.tradeId, tradeLabel: primary.tradeLabel, usedCategoryInference: false };
    }
    const fb = inferTradeFromCategoryText(args.categoryLabel);
    return { tradeId: fb.id, tradeLabel: fb.label, usedCategoryInference: true };
  }
  const fb = inferTradeFromCategoryText(args.categoryLabel);
  return { tradeId: fb.id, tradeLabel: fb.label, usedCategoryInference: true };
}

/** Normalize user filter chips / query params to canonical trade IDs (exact set). */
export function tradeFilterStringsToIds(filters: string[]): Set<string> {
  const ids = new Set<string>();
  for (const raw0 of filters) {
    const raw = raw0.trim();
    if (!raw) continue;
    const hit = ALIAS_TO_ID.get(raw.toLowerCase());
    if (hit) {
      ids.add(hit.id);
      continue;
    }
    const canon = TRADE_CANONICAL.find((t) => t.label.toLowerCase() === raw.toLowerCase());
    if (canon) {
      ids.add(canon.id);
      continue;
    }
    ids.add(slugId(raw));
  }
  return ids;
}

export function categoryToId(label: string): string | null {
  const s = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return s.length ? s.slice(0, 64) : null;
}
