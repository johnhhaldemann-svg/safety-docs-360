/**
 * Stable R-number index for CSEP regulatory citations (Appendix G).
 * Maps common OSHA / CFR phrasing used in program definitions to one code each.
 */

export type CsepRegulatoryReferenceEntry = {
  code: string;
  citation: string;
};

/** Canonical R-index rows (R1–R9 per product spec; R10+ for other frequent program cites). */
export const CSEP_REGULATORY_REFERENCE_INDEX: readonly CsepRegulatoryReferenceEntry[] = [
  { code: "R1", citation: "OSHA 29 CFR 1926 Subpart C - General Safety and Health Provisions" },
  { code: "R2", citation: "OSHA 29 CFR 1926 Subpart M - Fall Protection" },
  { code: "R3", citation: "OSHA 29 CFR 1926 Subpart R - Steel Erection" },
  { code: "R4", citation: "OSHA 29 CFR 1926 Subpart CC - Cranes and Derricks in Construction" },
  { code: "R5", citation: "OSHA 29 CFR 1926 Subpart J - Welding and Cutting" },
  { code: "R6", citation: "OSHA 29 CFR 1926 Subpart X - Stairways and Ladders" },
  { code: "R7", citation: "OSHA 29 CFR 1926 Subpart L - Scaffolds" },
  { code: "R8", citation: "OSHA 29 CFR 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations" },
  { code: "R9", citation: "OSHA 29 CFR 1926.59 / 1910.1200 - Hazard Communication" },
  { code: "R10", citation: "OSHA 29 CFR 1926 Subpart E - Personal Protective and Life Saving Equipment" },
  { code: "R11", citation: "OSHA 29 CFR 1926 Subpart K - Electrical Standards" },
  { code: "R12", citation: "OSHA 29 CFR 1926 Subpart AA - Confined Spaces in Construction" },
  { code: "R13", citation: "OSHA 29 CFR 1926 Subpart P - Excavations and Trenches" },
  { code: "R14", citation: "OSHA 29 CFR 1926 Subpart D - Occupational Health and Environmental Controls" },
  { code: "R15", citation: "OSHA 29 CFR 1926.1153 - Respirable Crystalline Silica" },
] as const;

const CODE_ORDER = new Map(CSEP_REGULATORY_REFERENCE_INDEX.map((e, i) => [e.code, i]));

export const CSEP_REGULATORY_R_CODE_TO_CITATION: Readonly<Record<string, string>> = Object.fromEntries(
  CSEP_REGULATORY_REFERENCE_INDEX.map((e) => [e.code, e.citation])
) as Record<string, string>;

function normRef(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstMatchCode(normalized: string): string | null {
  if (/\b1926\s*59\b|\b1910\s*1200\b|\bhazard\s+communication\b|\bhazcom\b|\bghs\b/.test(normalized)) {
    return "R9";
  }
  if (/\b1153\b|\bcrystalline\s+silica\b/.test(normalized)) {
    return "R15";
  }
  if (/\bsubpart\s+c\b|\bgeneral\s+safety\s+and\s+health\b/.test(normalized)) {
    return "R1";
  }
  if (/\bsubpart\s+m\b|\bfall\s+protection\b/.test(normalized) && !/\b1926\s*759\b/.test(normalized)) {
    return "R2";
  }
  if (/\bsubpart\s+r\b|\bsteel\s+erection\b/.test(normalized)) {
    return "R3";
  }
  if (/\bsubpart\s+cc\b|\bcranes\s+and\s+derricks\b|\bderrick\b/.test(normalized)) {
    return "R4";
  }
  if (/\bsubpart\s+j\b|\bwelding\b|\bcutting\b|\bfire\s+protection\s+and\s+prevention\b/.test(normalized)) {
    return "R5";
  }
  if (/\bsubpart\s+x\b|\bladder\b|\bstairway\b/.test(normalized)) {
    return "R6";
  }
  if (/\bsubpart\s+l\b|\bscaffold\b/.test(normalized)) {
    return "R7";
  }
  if (/\bsubpart\s+o\b|\bmotor\s+vehicle\b|\bmechanized\s+equipment\b|\bmarine\s+operations\b/.test(normalized)) {
    return "R8";
  }
  if (/\bsubpart\s+e\b|\bpersonal\s+protective\b|\blife\s+saving\b|\bppe\b/.test(normalized)) {
    return "R10";
  }
  if (/\bsubpart\s+k\b|\belectrical\b/.test(normalized)) {
    return "R11";
  }
  if (/\bsubpart\s+aa\b|\bconfined\s+space\b/.test(normalized)) {
    return "R12";
  }
  if (/\bsubpart\s+p\b|\bexcavat\b|\btrench\b/.test(normalized)) {
    return "R13";
  }
  if (/\bsubpart\s+d\b|\boccupational\s+health\s+and\s+environmental\b/.test(normalized)) {
    return "R14";
  }
  return null;
}

/** Map a single free-text OSHA / CFR line to a stable R-code, or null if unknown. */
export function mapOshaRefLineToRCode(line: string): string | null {
  const t = line.trim();
  if (!t) return null;
  const stripped = t.replace(/^R\d+\s+/i, "").trim();
  const n = normRef(stripped);
  if (!n) return null;

  const explicit = stripped.match(/^R(\d+)\b/i);
  if (explicit) {
    const code = `R${explicit[1]}`;
    return CSEP_REGULATORY_R_CODE_TO_CITATION[code] ? code : null;
  }

  return firstMatchCode(n);
}

/** Dedupe and sort R1, R2, … for display. */
export function dedupeSortedRCodes(codes: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const c of codes) {
    const t = c.trim().toUpperCase();
    if (/^R\d+$/.test(t) && CSEP_REGULATORY_R_CODE_TO_CITATION[t]) out.add(t);
  }
  return [...out].sort((a, b) => (CODE_ORDER.get(a) ?? 999) - (CODE_ORDER.get(b) ?? 999));
}

/** Map many OSHA reference strings to sorted unique R-codes. */
export function mapOshaRefStringsToSortedRCodes(refs: readonly string[]): string[] {
  const codes: string[] = [];
  for (const r of refs) {
    const c = mapOshaRefLineToRCode(r);
    if (c) codes.push(c);
  }
  return dedupeSortedRCodes(codes);
}

/** One bullet per R-code for Applicable References subsections. */
export function formatApplicableReferenceBullets(refs: readonly string[]): string[] {
  const codes = mapOshaRefStringsToSortedRCodes(refs);
  if (!codes.length) {
    return ["No indexed OSHA citations were mapped for this program; confirm requirements with the project regulatory register."];
  }
  return codes;
}

/** Merge jurisdiction or other additions into Applicable References bullets as stable R-codes. */
export function mergeApplicableReferenceRCodeBullets(existing: string[] | undefined, additions: string[]) {
  const combined = [...(existing ?? []), ...additions];
  const fromCodes = combined
    .filter((line) => /^R\d+$/i.test(line.trim()))
    .map((line) => line.trim().toUpperCase());
  const fromText = combined
    .filter((line) => !/^R\d+$/i.test(line.trim()))
    .flatMap((line) => {
      const c = mapOshaRefLineToRCode(line);
      return c ? [c] : [];
    });
  return dedupeSortedRCodes([...fromCodes, ...fromText]);
}

/** Short inline list for compact program bodies / suffix lines. */
export function formatApplicableReferencesInline(refs: readonly string[]): string {
  const codes = mapOshaRefStringsToSortedRCodes(refs);
  if (!codes.length) return "";
  return `Applicable references: ${codes.join(", ")} (see Appendix G).`;
}

/** Replace long OSHA citation phrases in narrative text with R-codes where unambiguous. */
export function substituteOshaCitationsWithRCodes(text: string): string {
  if (!text.trim()) return text;
  // Appendix G / References lines use "R2 OSHA 29 CFR …" — do not replace the citation span again (would yield "R2 R2").
  if (/^\s*R\d+\s+OSHA\b/i.test(text)) return text;
  let out = text;

  const replacements: Array<{ pattern: RegExp; code: string }> = [
    { pattern: /\bOSHA\s+29\s+CFR\s+1926\.59\b[^.]*(?:1910\.1200[^.]*)?\.?/gi, code: "R9" },
    { pattern: /\bOSHA\s+1926\.59\b[^.]*\.?/gi, code: "R9" },
    {
      pattern:
        /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+C\b[^.]*(?:General\s+Safety\s+and\s+Health\s+Provisions)?\.?/gi,
      code: "R1",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+C\b[^.]*\.?/gi, code: "R1" },
    {
      pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+M\b[^.]*(?:Fall\s+Protection)?\.?/gi,
      code: "R2",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+M\b[^.]*\.?/gi, code: "R2" },
    {
      pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+R\b[^.]*(?:Steel\s+Erection)?\.?/gi,
      code: "R3",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+R\b[^.]*\.?/gi, code: "R3" },
    {
      pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+CC\b[^.]*(?:Cranes\s+and\s+Derricks)?\.?/gi,
      code: "R4",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+CC\b[^.]*\.?/gi, code: "R4" },
    {
      pattern:
        /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+J\b[^.]*(?:Welding|Cutting|Fire\s+Protection\s+and\s+Prevention)?\.?/gi,
      code: "R5",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+J\b[^.]*\.?/gi, code: "R5" },
    {
      pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+X\b[^.]*(?:Stairways|Ladders)?\.?/gi,
      code: "R6",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+X\b[^.]*\.?/gi, code: "R6" },
    { pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+L\b[^.]*(?:Scaffold)?\.?/gi, code: "R7" },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+L\b[^.]*\.?/gi, code: "R7" },
    {
      pattern:
        /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+O\b[^.]*(?:Motor\s+Vehicles|Mechanized\s+Equipment|Marine)?\.?/gi,
      code: "R8",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+O\b[^.]*\.?/gi, code: "R8" },
    {
      pattern:
        /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+E\b[^.]*(?:Personal\s+Protective|PPE|Life\s+Saving)?\.?/gi,
      code: "R10",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+E\b[^.]*\.?/gi, code: "R10" },
    { pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+K\b[^.]*(?:Electrical)?\.?/gi, code: "R11" },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+K\b[^.]*\.?/gi, code: "R11" },
    {
      pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+AA\b[^.]*(?:Confined\s+Space)?\.?/gi,
      code: "R12",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+AA\b[^.]*\.?/gi, code: "R12" },
    { pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+P\b[^.]*(?:Excavat|Trench)?\.?/gi, code: "R13" },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+P\b[^.]*\.?/gi, code: "R13" },
    {
      pattern: /\bOSHA\s+29\s+CFR\s+1926\s+Subpart\s+D\b[^.]*(?:Occupational\s+Health|Environmental\s+Controls)?\.?/gi,
      code: "R14",
    },
    { pattern: /\bOSHA\s+1926\s+Subpart\s+D\b[^.]*\.?/gi, code: "R14" },
    { pattern: /\bOSHA\s+29\s+CFR\s+1926\.1153\b[^.]*\.?/gi, code: "R15" },
  ];

  for (const { pattern, code } of replacements) {
    out = out.replace(pattern, () => code);
  }

  return out
    .replace(/\b(R\d+)\s*,\s*\1\b/gi, "$1")
    .replace(/\b(R\d+)(?:\s*,\s*\1)+\b/gi, "$1");
}

export const CSEP_APPENDIX_REGULATORY_REFERENCES_KEY = "appendix_g_regulatory_references_r_index";
