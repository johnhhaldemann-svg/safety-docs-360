/**
 * Canonical trade IDs + labels + lowercase aliases for exact resolution after normalization.
 * SOR `trade` is primary; category-text inference is fallback only (see `resolveTradeForRow`).
 */

export type TradeCanonical = {
  id: string;
  label: string;
  aliases: string[];
};

/** CONFIG: extend aliases to match your org’s vocabulary. */
export const TRADE_CANONICAL: TradeCanonical[] = [
  { id: "general_contractor", label: "General Contractor", aliases: ["general contractor", "gc", "general"] },
  { id: "steel_work", label: "Steel Work", aliases: ["steel work", "steel", "structural steel", "ironwork", "iron worker", "rebar"] },
  { id: "electrical", label: "Electrical", aliases: ["electrical", "electric", "electrician"] },
  { id: "roofing", label: "Roofing", aliases: ["roofing", "roofer", "roof"] },
  { id: "concrete", label: "Concrete", aliases: ["concrete", "cement", "formwork", "rebar placement"] },
  { id: "carpentry", label: "Carpentry", aliases: ["carpentry", "carpenter", "framing", "millwork"] },
  { id: "plumbing", label: "Plumbing", aliases: ["plumbing", "plumber"] },
  { id: "hvac", label: "HVAC", aliases: ["hvac", "mechanical"] },
  { id: "masonry", label: "Masonry", aliases: ["masonry", "mason", "brick"] },
  { id: "earthworks", label: "Earthworks", aliases: ["earthworks", "excavation", "grading"] },
  { id: "demolition", label: "Demolition", aliases: ["demolition", "demo"] },
  { id: "glazing", label: "Glazing", aliases: ["glazing", "glass"] },
  { id: "scaffolding", label: "Scaffolding", aliases: ["scaffolding", "scaffold"] },
  { id: "roadwork", label: "Roadwork", aliases: ["roadwork", "paving", "asphalt"] },
  { id: "landscaping", label: "Landscaping", aliases: ["landscaping", "landscape"] },
  { id: "drywall", label: "Drywall", aliases: ["drywall", "gypsum"] },
  { id: "painting", label: "Painting", aliases: ["painting", "painter"] },
];

const ALIAS_TO_ID = new Map<string, { id: string; label: string }>();
for (const t of TRADE_CANONICAL) {
  const register = (s: string) => ALIAS_TO_ID.set(s.trim().toLowerCase(), { id: t.id, label: t.label });
  register(t.label);
  for (const a of t.aliases) register(a);
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
    return { id: "carpentry", label: "Carpentry" };
  if (haystack.includes("roof")) return { id: "roofing", label: "Roofing" };
  if (haystack.includes("electrical") || haystack.includes("loto") || haystack.includes("arc flash") || haystack.includes("temporary power"))
    return { id: "electrical", label: "Electrical" };
  if (haystack.includes("concrete") || haystack.includes("formwork") || haystack.includes("rebar")) return { id: "concrete", label: "Concrete" };
  if (haystack.includes("rigging") || haystack.includes("steel") || haystack.includes("welding") || haystack.includes("crane"))
    return { id: "steel_work", label: "Steel Work" };
  return { id: "general_contractor", label: "General Contractor" };
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
