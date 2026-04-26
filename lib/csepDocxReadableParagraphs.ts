/**
 * Estimates DOCX body line count (Calibri ~11 pt, typical CSEP indent) and splits
 * long narrative so export paragraphs stay scannable in the field (~6 lines max).
 */

const DEFAULT_CHARS_PER_LINE = 82;

function hardWrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    const next = buf ? `${buf} ${w}` : w;
    if (next.length <= maxChars) {
      buf = next;
    } else {
      if (buf) out.push(buf);
      buf = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Splits one narrative block into multiple DOCX paragraphs when estimated line
 * count exceeds `maxLines` (default 6).
 */
export function splitParagraphAtEstimatedDocxLineCount(
  text: string,
  options?: { maxLines?: number; charsPerLine?: number }
): string[] {
  const maxLines = options?.maxLines ?? 6;
  const charsPerLine = options?.charsPerLine ?? DEFAULT_CHARS_PER_LINE;
  const maxChars = maxLines * charsPerLine;
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z(0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return hardWrapWords(trimmed, maxChars);
  }

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        chunks.push(...hardWrapWords(sentence, maxChars));
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Applies line-count splitting to every paragraph string. */
export function expandParagraphsForDocxReadability(paragraphs: string[] | undefined): string[] {
  return (paragraphs ?? []).flatMap((p) => splitParagraphAtEstimatedDocxLineCount(p));
}
