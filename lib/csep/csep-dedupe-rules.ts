type DedupeSubsection = {
  paragraphs?: string[];
  items?: string[];
  table?: {
    rows: string[][];
  } | null;
};

export const CSEP_SECTION_OWNERSHIP_PATTERNS = {
  trade_interaction_info:
    /\b(overlap|overlapping trades|shared work|shared area|interface|coordination|handoff|trade interaction|trade-specific access|definition)\b/i,
  security_at_site:
    /\b(worker access|site entry|badge|visitor|delivery|deliveries|truck|trucking|traffic control|laydown|staging|restricted area|caz|cdz|access control|end[-\s]?of[-\s]?shift|security)\b/i,
  hazcom:
    /\b(hazcom|hazard communication|sds|safety data sheet|label|labels|chemical inventory|ghs|nfpa|secondary container|chemical communication)\b/i,
  iipp_emergency_response:
    /\b(emergency response|incident reporting|rescue|fit[-\s]?for[-\s]?duty|drug|alcohol|corrective action|medical response|restart)\b/i,
  hazards_and_controls:
    /\b(hazard|exposure|required controls?|verify|verification|stop[-\s]?work|trigger|field control|R\d+|OSHA|29\s*CFR|subpart)\b/i,
} as const;

export const CSEP_HAZARD_NON_OWNER_POLICY_PATTERN =
  /\b(visitor|badge|site entry|delivery|trucking|traffic control|laydown|staging|chemical inventory|ghs|nfpa|secondary container|fit[-\s]?for[-\s]?duty|drug|alcohol)\b/i;

export function sectionHasContent(subsection: DedupeSubsection): boolean {
  return Boolean(
    subsection.paragraphs?.some((p) => p.trim()) ||
      subsection.items?.some((i) => i.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => (cell ?? "").trim()))
  );
}

