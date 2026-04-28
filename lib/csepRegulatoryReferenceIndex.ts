export type CsepRegulatoryReferenceEntry = {
  code: string;
  citation: string;
};

export const CSEP_REGULATORY_REFERENCE_INDEX: readonly CsepRegulatoryReferenceEntry[] = [
  { code: "R1", citation: "OSHA 29 CFR 1926 Subpart C - General Safety and Health Provisions" },
  { code: "R2", citation: "OSHA 29 CFR 1926 Subpart E - Personal Protective and Life Saving Equipment" },
  { code: "R3", citation: "OSHA 29 CFR 1926 Subpart M - Fall Protection" },
  { code: "R4", citation: "OSHA 29 CFR 1926 Subpart R - Steel Erection" },
  { code: "R5", citation: "OSHA 29 CFR 1926 Subpart CC - Cranes and Derricks in Construction" },
  { code: "R6", citation: "OSHA 29 CFR 1926 Subpart J - Welding and Cutting" },
  { code: "R7", citation: "OSHA 29 CFR 1926 Subpart F - Fire Protection and Prevention" },
  { code: "R8", citation: "OSHA 29 CFR 1926 Subpart K - Electrical" },
  { code: "R9", citation: "OSHA 29 CFR 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations" },
] as const;

const CODE_ORDER = new Map(CSEP_REGULATORY_REFERENCE_INDEX.map((entry, index) => [entry.code, index]));

export const CSEP_REGULATORY_R_CODE_TO_CITATION: Readonly<Record<string, string>> = Object.fromEntries(
  CSEP_REGULATORY_REFERENCE_INDEX.map((entry) => [entry.code, entry.citation])
) as Record<string, string>;

function normRef(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstMatchCode(normalized: string): string | null {
  if (/\bsubpart\s+c\b|\bgeneral\s+safety\s+and\s+health\b/.test(normalized)) return "R1";
  if (/\bsubpart\s+e\b|\bpersonal\s+protective\b|\blife\s+saving\b|\bppe\b/.test(normalized)) return "R2";
  if (/\bsubpart\s+m\b|\bfall\s+protection\b/.test(normalized) && !/\b1926\s*759\b/.test(normalized)) return "R3";
  if (/\bsubpart\s+r\b|\bsteel\s+erection\b/.test(normalized)) return "R4";
  if (/\bsubpart\s+cc\b|\bcranes\s+and\s+derricks\b|\bderrick\b/.test(normalized)) return "R5";
  if (/\bsubpart\s+j\b|\bwelding\b|\bcutting\b/.test(normalized)) return "R6";
  if (/\bsubpart\s+f\b|\bfire\s+protection\b|\bfire\s+prevention\b/.test(normalized)) return "R7";
  if (/\bsubpart\s+k\b|\belectrical\b/.test(normalized)) return "R8";
  if (/\bsubpart\s+o\b|\bmotor\s+vehicle\b|\bmechanized\s+equipment\b|\bmarine\s+operations\b/.test(normalized)) return "R9";
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
