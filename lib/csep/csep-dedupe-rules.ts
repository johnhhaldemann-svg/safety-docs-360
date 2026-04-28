type DedupeSubsection = {
  paragraphs?: string[];
  items?: string[];
  table?: {
    rows: string[][];
  } | null;
};

export const CSEP_SECTION_OWNERSHIP_PATTERNS = {
  trade_interaction_and_coordination:
    /\b(overlap|overlapping trades|shared work|shared area|interface|coordination|handoff|trade interaction|trade-specific access|definition)\b/i,
  site_access_security_laydown_traffic_control:
    /\b(worker access|site entry|badge|visitor|delivery|deliveries|truck|trucking|traffic control|laydown|staging|restricted area|access control|end[-\s]?of[-\s]?shift|security)\b/i,
  hazard_communication_and_environmental_protection:
    /\b(hazcom|hazard communication|sds|safety data sheet|label|labels|chemical inventory|ghs|nfpa|secondary container|chemical communication|spill|waste|stormwater|drain|dust|noise|environmental)\b/i,
  emergency_response_and_rescue:
    /\b(emergency response|rescue|medical response|ems|911|evacuation|shelter|fire response|suspension trauma)\b/i,
  iipp_incident_reporting_corrective_action:
    /\b(incident reporting|near[-\s]?miss|investigation|corrective action|restart|scene protection|trend)\b/i,
  worker_conduct_fit_for_duty_disciplinary_program:
    /\b(fit[-\s]?for[-\s]?duty|drug|alcohol|disciplin|unsafe act|site removal|fatigue|wellness|impairment)\b/i,
  hazard_control_modules:
    /\b(hazard|exposure|required controls?|verify|verification|stop[-\s]?work|trigger|field control|R\d+|OSHA|29\s*CFR|subpart)\b/i,
} as const;

export const CSEP_HAZARD_NON_OWNER_POLICY_PATTERN =
  /\b(visitor|badge|site entry|delivery|trucking|traffic control|laydown|staging|chemical inventory|ghs|nfpa|secondary container|fit[-\s]?for[-\s]?duty|drug|alcohol|work attire|hard hat|safety glasses|hi[-\s]?vis)\b/i;

export function sectionHasContent(subsection: DedupeSubsection): boolean {
  return Boolean(
    subsection.paragraphs?.some((p) => p.trim()) ||
      subsection.items?.some((i) => i.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => (cell ?? "").trim()))
  );
}
