/**
 * Maps audit blueprint trades to OSHA field checklist sections.
 * Adjust mappings with your safety team; `general_contractor` always sees the full template.
 */

import {
  CONSTRUCTION_TRADE_DEFINITIONS,
  type FieldAuditScopeKey,
} from "@/lib/constructionTradeTaxonomy";
import {
  type FieldAuditSection,
  OSHA_FIELD_AUDIT_SECTIONS,
  fieldItemKey,
} from "@/lib/jobsiteAudits/oshaFieldAuditTemplate";

const SCOPE_KEYS = new Set<string>(
  CONSTRUCTION_TRADE_DEFINITIONS.map((d) => d.fieldScope as string)
);

function resolveFieldScopeKey(tradeSlug: string): FieldAuditScopeKey {
  const t = tradeSlug.trim();
  if (t === "general_contractor") return "general_contractor";
  if (CONSTRUCTION_TRADE_DEFINITIONS.some((d) => d.slug === t)) {
    const d = CONSTRUCTION_TRADE_DEFINITIONS.find((x) => x.slug === t)!;
    return d.fieldScope;
  }
  if (SCOPE_KEYS.has(t)) return t as FieldAuditScopeKey;
  if (t in TRADE_EXTRA_SECTION_IDS) return t as FieldAuditScopeKey;
  return "other";
}

/** Sections most trades share (site, falls, PPE, health, emergency). */
export const CORE_FIELD_AUDIT_SECTION_IDS: readonly string[] = [
  "site-housekeeping",
  "fall-protection",
  "ppe",
  "hazcom-silica",
  "heat-emergency",
] as const;

function withCore(...extra: string[]): string[] {
  return [...new Set([...CORE_FIELD_AUDIT_SECTION_IDS, ...extra])];
}

/**
 * Extra section ids beyond CORE_FIELD_AUDIT_SECTION_IDS per trade.
 * `general_contractor` is handled separately (full checklist).
 */
const TRADE_EXTRA_SECTION_IDS: Record<string, readonly string[]> = {
  carpentry: withCore("scaffold-ladder", "hot-work", "cranes-rigging"),
  drywall: withCore("scaffold-ladder", "hot-work"),
  framing: withCore("scaffold-ladder", "steel-erection", "cranes-rigging"),
  roofing: withCore("scaffold-ladder", "cranes-rigging", "hot-work"),
  electrical: withCore("electrical", "scaffold-ladder"),
  plumbing: withCore("confined-space", "hot-work", "excavation"),
  hvac: withCore("confined-space", "cranes-rigging", "electrical", "hot-work"),
  fire_protection: withCore("hot-work", "confined-space", "electrical"),
  steel_erection: withCore("steel-erection", "cranes-rigging", "scaffold-ladder"),
  concrete: withCore("excavation", "cranes-rigging"),
  masonry: withCore("scaffold-ladder", "cranes-rigging"),
  excavation_earthwork: withCore("excavation", "electrical"),
  demolition: withCore("hot-work", "confined-space"),
  painting: withCore("hot-work", "confined-space"),
  flooring: withCore("hot-work"),
  insulation: withCore("confined-space"),
  ceiling_acoustical: withCore("scaffold-ladder", "cranes-rigging"),
  glazing: withCore("scaffold-ladder"),
  waterproofing: withCore("hot-work"),
  equipment_crane_operations: withCore("cranes-rigging", "electrical", "excavation"),
  scaffold_access: withCore("scaffold-ladder"),
  millwright_mechanical: withCore("cranes-rigging", "electrical", "confined-space", "hot-work"),
  utilities_underground: withCore("excavation", "electrical"),
  landscaping_site_work: withCore("excavation", "cranes-rigging"),
  /** Explicit core-only scope */
  other: [...CORE_FIELD_AUDIT_SECTION_IDS],
};

export function getFieldAuditSectionsForTrade(trade: string): FieldAuditSection[] {
  const scope = resolveFieldScopeKey(trade);
  if (scope === "general_contractor") {
    return OSHA_FIELD_AUDIT_SECTIONS;
  }
  const extras = TRADE_EXTRA_SECTION_IDS[scope];
  const allowed = new Set(extras ?? CORE_FIELD_AUDIT_SECTION_IDS);
  return OSHA_FIELD_AUDIT_SECTIONS.filter((s) => allowed.has(s.id));
}

export function countFieldAuditItemsInSections(sections: FieldAuditSection[]): number {
  return sections.reduce((n, s) => n + s.items.length, 0);
}

export function fieldCompliancePercentForSections(
  sections: FieldAuditSection[],
  statusMap: Record<string, string>
): number | null {
  let pass = 0;
  let fail = 0;
  for (const sec of sections) {
    for (const it of sec.items) {
      const st = statusMap[fieldItemKey(sec.id, it.id)] ?? "";
      if (st === "pass") pass += 1;
      if (st === "fail") fail += 1;
    }
  }
  if (pass + fail === 0) return null;
  return Math.round((pass / (pass + fail)) * 100);
}
