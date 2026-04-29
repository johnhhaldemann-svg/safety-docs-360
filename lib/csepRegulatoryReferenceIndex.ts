export type CsepRegulatoryReferenceEntry = {
  code: string;
  citation: string;
};

export const CSEP_REGULATORY_REFERENCE_INDEX: readonly CsepRegulatoryReferenceEntry[] = [
  { code: "R1", citation: "OSHA 29 CFR 1926 Subpart R - Steel Erection" },
  { code: "R2", citation: "OSHA 29 CFR 1926 Subpart M - Fall Protection" },
  { code: "R3", citation: "OSHA 29 CFR 1926.502(d)(20) - Fall Rescue / Prompt Rescue" },
  { code: "R4", citation: "OSHA 29 CFR 1926 Subpart J - Welding, Cutting, Fire Protection, and Prevention" },
  { code: "R5", citation: "OSHA 29 CFR 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations" },
  { code: "R6", citation: "OSHA 29 CFR 1926 Subpart CC - Cranes, Derricks, Rigging, and Signal Requirements" },
  { code: "R7", citation: "OSHA 29 CFR 1926.453 - Aerial Lifts / MEWPs" },
  { code: "R8", citation: "OSHA 29 CFR 1926 Subpart X - Stairways and Ladders" },
  { code: "R9", citation: "OSHA 29 CFR 1926 Subpart L - Scaffolds" },
  { code: "R10", citation: "OSHA 29 CFR 1926.59 / 1910.1200 - Hazard Communication" },
  { code: "R11", citation: "OSHA 29 CFR 1926 Subpart E - Personal Protective and Life Saving Equipment" },
  { code: "R12", citation: "Project-specific owner, GC / CM, contract, permit, access, and site safety requirements" },
  { code: "R13", citation: "Manufacturer instructions, equipment manuals, engineered drawings, and approved lift / access plans" },
  { code: "R14", citation: "OSHA 29 CFR 1926 Subpart I - Tools, Hand and Power" },
  { code: "R15", citation: "OSHA 29 CFR 1926 Subpart P - Excavations" },
  { code: "R16", citation: "OSHA 29 CFR 1904 and project recordkeeping / retention requirements" },
  { code: "R17", citation: "OSHA severe weather, heat, cold, lightning, emergency action, and project weather requirements" },
] as const;

const CODE_ORDER = new Map(CSEP_REGULATORY_REFERENCE_INDEX.map((entry, index) => [entry.code, index]));

export const CSEP_REGULATORY_R_CODE_TO_CITATION: Readonly<Record<string, string>> = Object.fromEntries(
  CSEP_REGULATORY_REFERENCE_INDEX.map((entry) => [entry.code, entry.citation])
) as Record<string, string>;

function normRef(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstMatchCode(normalized: string): string | null {
  if (/\bsubpart\s+r\b|\bsteel\s+erection\b/.test(normalized)) return "R1";
  if (/\bsubpart\s+m\b|\bfall\s+protection\b/.test(normalized) && !/\b1926\s*502\s*d\s*20\b/.test(normalized)) return "R2";
  if (/\b1926\s*502\s*d\s*20\b|\bprompt\s+rescue\b|\bfall\s+rescue\b/.test(normalized)) return "R3";
  if (/\bsubpart\s+j\b|\bwelding\b|\bcutting\b|\bhot\s+work\b|\bfire\s+protection\b|\bfire\s+prevention\b/.test(normalized)) return "R4";
  if (/\bsubpart\s+o\b|\bmotor\s+vehicle\b|\bmechanized\s+equipment\b|\bmarine\s+operations\b|\btraffic\b/.test(normalized)) return "R5";
  if (/\bsubpart\s+cc\b|\bcranes?\b|\bderricks?\b|\brigging\b|\bsignal\b/.test(normalized)) return "R6";
  if (/\b1926\s*453\b|\baerial\s+lifts?\b|\bmewp\b|\bmobile\s+elevating\b/.test(normalized)) return "R7";
  if (/\bsubpart\s+x\b|\bstairways?\b|\bladders?\b/.test(normalized)) return "R8";
  if (/\bsubpart\s+l\b|\bscaffolds?\b/.test(normalized)) return "R9";
  if (/\b1926\s*59\b|\b1910\s*1200\b|\bhazard\s+communication\b|\bhazcom\b/.test(normalized)) return "R10";
  if (/\bsubpart\s+e\b|\bpersonal\s+protective\b|\blife\s+saving\b|\bppe\b/.test(normalized)) return "R11";
  if (/\bproject\b|\bgc\b|\bcm\b|\bowner\b|\bpermit\b|\bsite\s+safety\b|\baccess\b/.test(normalized)) return "R12";
  if (/\bmanufacturer\b|\bmanual\b|\binstructions?\b|\bengineered\b|\bapproved\s+plan\b/.test(normalized)) return "R13";
  if (/\bsubpart\s+i\b|\bhand\s+tools?\b|\bpower\s+tools?\b|\btools?\b/.test(normalized)) return "R14";
  if (/\bsubpart\s+p\b|\bexcavat|\btrench/.test(normalized)) return "R15";
  if (/\b1904\b|\brecordkeeping\b|\brecords?\b|\bretention\b/.test(normalized)) return "R16";
  if (/\bweather\b|\blightning\b|\bheat\b|\bcold\b|\bwind\b|\btornado\b|\bstorm\b/.test(normalized)) return "R17";
  return null;
}

export function mapOshaRefLineToRCode(line: string): string | null {
  const stripped = line.trim().replace(/^R\d+\s+/i, "").trim();
  if (!stripped) return null;

  const explicit = stripped.match(/^R(\d+)\b/i);
  if (explicit) {
    const code = `R${explicit[1]}`;
    return CSEP_REGULATORY_R_CODE_TO_CITATION[code] ? code : null;
  }

  return firstMatchCode(normRef(stripped));
}

export function dedupeSortedRCodes(codes: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    const normalized = code.trim().toUpperCase();
    if (/^R\d+$/.test(normalized) && CSEP_REGULATORY_R_CODE_TO_CITATION[normalized]) {
      out.add(normalized);
    }
  }
  return [...out].sort((a, b) => (CODE_ORDER.get(a) ?? 999) - (CODE_ORDER.get(b) ?? 999));
}

export function mapOshaRefStringsToSortedRCodes(refs: readonly string[]): string[] {
  return dedupeSortedRCodes(refs.flatMap((ref) => {
    const code = mapOshaRefLineToRCode(ref);
    return code ? [code] : [];
  }));
}

export function formatApplicableReferenceBullets(refs: readonly string[]): string[] {
  const codes = mapOshaRefStringsToSortedRCodes(refs);
  return codes.length ? codes : ["Confirm applicable OSHA references against the project regulatory register."];
}

export function mergeApplicableReferenceRCodeBullets(existing: string[] | undefined, additions: string[]) {
  return dedupeSortedRCodes([
    ...(existing ?? []).flatMap((line) => mapOshaRefLineToRCode(line) ?? []),
    ...additions.flatMap((line) => mapOshaRefLineToRCode(line) ?? []),
  ]);
}

export function formatApplicableReferencesInline(refs: readonly string[]): string {
  const codes = mapOshaRefStringsToSortedRCodes(refs);
  return codes.length ? `Applicable references: ${codes.join(", ")}.` : "";
}

export function substituteOshaCitationsWithRCodes(text: string): string {
  if (!text.trim() || /^\s*R\d+\s+OSHA\b/i.test(text)) return text;
  const code = mapOshaRefLineToRCode(text);
  return code ? text.replace(/\bOSHA\b.*$/i, code).replace(/\b(R\d+)\s*,\s*\1\b/gi, "$1") : text;
}

export const CSEP_APPENDIX_REGULATORY_REFERENCES_KEY = "regulatory_basis_and_references";
