import { KEYWORD_STOPWORDS } from "@/lib/companyMemory/stopwords";

/** Tokens from title + body for overlap / Jaccard (aligned with keyword search vocabulary). */
export function memoryContentTokenSet(text: string): Set<string> {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens = raw.filter((t) => t.length >= 2 && !KEYWORD_STOPWORDS.has(t));
  return new Set(tokens.slice(0, 80));
}

export function jaccardTokenSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

const MIN_CONTAIN_LEN = 5;

export function titlesAreMutuallyContained(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x.length < MIN_CONTAIN_LEN || y.length < MIN_CONTAIN_LEN) return false;
  return x.includes(y) || y.includes(x);
}

/** Minimum composite score to suggest replacing an existing memory row. */
export const SIMILAR_MEMORY_SHOW_THRESHOLD = 0.76;

export const SIMILAR_MEMORY_SEMANTIC_MIN = 0.775;

export const SIMILAR_MEMORY_JACCARD_MIN = 0.32;
