import type { GeneratedSafetyPlanDraft, GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

/**
 * Product-required safety concepts for CSEP drafts (deterministic assembler + structured builder).
 * When cleaning, deduplicating, or compacting CSEP output, **rephrase or reorganize**—do not delete
 * these ideas from generated content. CI enforces them via `csepDraftSafetyPreservation.test.ts`.
 *
 * Covered themes: HazCom; CAZ / CDZ; ironworker–connector–decking access; suspended loads and swing;
 * laydown and delivery drivers; fall rescue / suspension trauma and 911; crane permit / pick plan;
 * drug–alcohol (including vehicle + union); end-matter document control.
 */
export const PRESERVED_CSEP_CONTENT_CHECKS: ReadonlyArray<{ id: string; pattern: RegExp; note: string }> = [
  { id: "hazcom_section", pattern: /hazard communication|\bHazCom\b/i, note: "Section 8.0 / HazCom body" },
  {
    id: "caz_definition",
    pattern: /Controlled Access Zone\s*\(CAZ\)|\bCAZ\b.*(restricted|boundary|authorized)/i,
    note: "Definitions or access text defining CAZ",
  },
  {
    id: "caz_requirements",
    pattern: /Use a CAZ|controlled access zone|CAZ (?:is|for|when)/i,
    note: "CAZ operational requirements",
  },
  {
    id: "ironworker_connector_decking_zones",
    pattern: /ironworker|connector|decking crew|Steel Erection Access Control/i,
    note: "Ironworker / connector / decking zone access",
  },
  {
    id: "controlled_decking_zone",
    pattern: /controlled decking zone|\bCDZ\b/i,
    note: "CDZ language",
  },
  {
    id: "suspended_load",
    pattern: /suspended load|under a suspended|beneath a suspended/i,
    note: "Suspended load restrictions",
  },
  {
    id: "crane_swing_load_path",
    pattern: /swing radius|load path|swing path/i,
    note: "Crane swing / load path",
  },
  {
    id: "laydown_controls",
    pattern: /laydown|Designated laydown|staging/i,
    note: "Laydown / staging controls",
  },
  {
    id: "driver_remain_in_vehicle",
    pattern: /remain-in-vehicle|stay in the cab|Drivers stay in the cab/i,
    note: "Driver remain-in-vehicle rule",
  },
  {
    id: "driver_ppe_exiting",
    pattern: /If the driver must exit|PPE if exiting|hard hat.*high-visibility.*exit/i,
    note: "Driver PPE when exiting vehicle",
  },
  {
    id: "fall_rescue_suspension_trauma",
    pattern: /Fall Rescue|fall rescue|suspension trauma|Suspension-trauma/i,
    note: "Fall rescue and suspension trauma response",
  },
  { id: "911_emergency", pattern: /\b911\b|Call 911/i, note: "911 emergency language" },
  {
    id: "crane_permit_pick_plan",
    pattern: /Crane Permit|Pick Plan|Lift Plan/i,
    note: "Crane permit / pick plan / lift plan",
  },
  {
    id: "drug_alcohol_vehicle_rule",
    pattern: /personal vehicles.*(construction site|project-controlled)|drug.*alcohol.*vehicle/i,
    note: "Drug/alcohol in vehicles on site",
  },
  {
    id: "union_drug_alcohol",
    pattern: /\bunion\b|reciprocal-body|collective bargaining/i,
    note: "Union-related drug/alcohol compliance",
  },
];

/** Flatten section map (and optional steel plan JSON) for substring / regex audits. */
export function flattenCsepSectionMapText(sections: readonly GeneratedSafetyPlanSection[]): string {
  const parts: string[] = [];
  const walk = (s: GeneratedSafetyPlanSection) => {
    parts.push(s.title, s.key);
    if (s.summary) parts.push(s.summary);
    if (s.body) parts.push(s.body);
    for (const b of s.bullets ?? []) parts.push(b);
    for (const sub of s.subsections ?? []) {
      parts.push(sub.title);
      if (sub.body) parts.push(sub.body);
      for (const b of sub.bullets ?? []) parts.push(b);
    }
    if (s.table) {
      parts.push(...s.table.columns, ...s.table.rows.flat());
    }
  };
  for (const s of sections) walk(s);
  return parts.join("\n");
}

function collectJsonStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 12) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, out, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectJsonStrings(v, out, depth + 1);
    }
  }
}

export function flattenGeneratedDraftForPreservationSearch(draft: GeneratedSafetyPlanDraft): string {
  const parts = [flattenCsepSectionMapText(draft.sectionMap)];
  if (draft.steelErectionPlan) {
    const strings: string[] = [];
    collectJsonStrings(draft.steelErectionPlan, strings);
    parts.push(strings.join("\n"));
  }
  return parts.join("\n");
}

export function findMissingPreservedCsepContent(haystack: string): string[] {
  return findMissingPreservedCsepContentInAnyHaystack([haystack]);
}

/** Each pattern must match at least one haystack (e.g. generated `sectionMap` plus structured export text). */
export function findMissingPreservedCsepContentInAnyHaystack(haystacks: readonly string[]): string[] {
  const missing: string[] = [];
  for (const { id, pattern } of PRESERVED_CSEP_CONTENT_CHECKS) {
    if (!haystacks.some((h) => pattern.test(h))) missing.push(id);
  }
  return missing;
}
