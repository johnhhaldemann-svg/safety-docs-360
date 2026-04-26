/**
 * DOCX-only narrative polish for CSEP export: typography, light structure, and
 * common misspellings. Does not change regulatory meaning or obligations.
 */

export type CsepDocxNarrativePolishMode = "full" | "compact";

const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bDiscplianry\b/gi, "Disciplinary"],
  [/\bcontruction\b/gi, "construction"],
  [/\boccurence\b/gi, "occurrence"],
  [/\boccured\b/gi, "occurred"],
  [/\baccomodate\b/gi, "accommodate"],
  [/\baccomodation\b/gi, "accommodation"],
  [/\bimplimentation\b/gi, "implementation"],
  [/\bmaintainance\b/gi, "maintenance"],
  [/\benviroment\b/gi, "environment"],
  [/\benviromental\b/gi, "environmental"],
  [/\bgoverened\b/gi, "governed"],
  [/\bnoticable\b/gi, "noticeable"],
  [/\bprocedue\b/gi, "procedure"],
  [/\bprocedues\b/gi, "procedures"],
];

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Short numbered outline labels (TOC, etc.) — no terminal period or clause splitting. */
function isCompactOutlineLabel(text: string): boolean {
  const t = text.trim();
  if (t.length > 120 || t.includes("\n")) return false;
  const outline = t.match(/^(\d+)\.\s+(.+)$/);
  if (!outline) return false;
  const rest = outline[2] ?? "";
  if (!rest.trim()) return false;
  // Sentence breaks inside the title (not the "13." outline delimiter).
  if (/[.!?]\s+[A-Za-z]/.test(rest)) return false;
  return true;
}

function replaceAwkwardStarts(text: string): string {
  let t = text;
  t = t.replace(/^\s*Are critical components\b/i, "Critical components");
  t = t.replace(/^\s*Are all critical\b/i, "All critical");
  t = t.replace(/^\s*Are required controls\b/i, "Required controls");
  return t;
}

function ensureTerminalPunctuation(text: string): string {
  const t = text.trim();
  if (!t) return t;
  if (/^n\/a$/i.test(t)) return t;
  if (!/\s/.test(t) && t.length <= 4) return t;
  if (/[.!?…]["')\]]?$/.test(t)) return t;
  if (/[.!?…]$/.test(t)) return t;
  if (!/[A-Za-z]$/.test(t)) return t;
  return `${t}.`;
}

function splitLongClauseSegments(text: string): string[] {
  const minTotal = 400;
  const minPart = 42;
  const t = text.trim();
  if (t.length < minTotal || !t.includes("; ")) return [t];
  const parts = t.split(/;\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.some((p) => p.length < minPart)) return [t];
  return parts;
}

export function polishCsepDocxNarrativeText(
  text: string,
  options?: { mode?: CsepDocxNarrativePolishMode; skipTerminalPunctuation?: boolean }
): string {
  const mode = options?.mode ?? "full";
  let t = collapseWhitespace(text).trim();
  if (!t) return t;

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    t = t.replace(pattern, replacement);
  }

  if (mode === "compact" || isCompactOutlineLabel(t)) {
    return t;
  }

  t = replaceAwkwardStarts(t);
  if (options?.skipTerminalPunctuation) {
    return t;
  }
  return ensureTerminalPunctuation(t);
}

/**
 * Splits builder `body` on blank lines, collapses excessive breaks, optionally
 * breaks very long semicolon-heavy clauses into separate DOCX paragraphs.
 */
export function splitCsepDocxBodyIntoSegments(body: string): string[] {
  const normalized = collapseWhitespace(body);
  return normalized
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) => {
      const chunks = splitLongClauseSegments(segment);
      return chunks.map((chunk) => polishCsepDocxNarrativeText(chunk.trim())).filter(Boolean);
    });
}
