const ACRONYMS = new Map(
  [
    "ai",
    "api",
    "csep",
    "dap",
    "gc",
    "hr",
    "jsa",
    "osha",
    "ppe",
    "sif",
    "sor",
  ].map((value) => [value, value.toUpperCase()])
);

const PLURAL_ACRONYMS = new Map(
  Array.from(ACRONYMS.entries()).map(([key, value]) => [`${key}s`, `${value}s`])
);

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "vs",
  "with",
]);

function capitalizeWord(word: string): string {
  if (!word) return word;
  if (!/[A-Za-z]/.test(word)) return word;
  const lower = word.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function formatWord(word: string, forceCapital: boolean): string {
  if (!word) return word;
  if (!/[A-Za-z]/.test(word)) return word;

  const lower = word.toLowerCase();
  const acronym = ACRONYMS.get(lower) ?? PLURAL_ACRONYMS.get(lower);
  if (acronym) return acronym;
  if (!forceCapital && SMALL_WORDS.has(lower)) return lower;
  return capitalizeWord(word);
}

function formatToken(token: string, isFirst: boolean, isLast: boolean): string {
  const wordMatches = Array.from(token.matchAll(/[A-Za-z0-9]+/g));
  if (wordMatches.length === 0) return token;

  let output = "";
  let cursor = 0;
  wordMatches.forEach((match, index) => {
    const word = match[0];
    const start = match.index ?? 0;
    output += token.slice(cursor, start);
    output += formatWord(word, isFirst || isLast || index > 0);
    cursor = start + word.length;
  });
  output += token.slice(cursor);
  return output;
}

export function formatTitleCase(value?: string | null): string {
  if (value == null) return "";

  const title = value.trim();
  if (!title) return "";

  const tokens = title.split(/(\s+)/);
  const wordTokenIndexes = tokens
    .map((token, index) => (/[A-Za-z0-9]/.test(token) ? index : -1))
    .filter((index) => index >= 0);
  const firstWordTokenIndex = wordTokenIndexes[0];
  const lastWordTokenIndex = wordTokenIndexes[wordTokenIndexes.length - 1];

  return tokens
    .map((token, index) =>
      /\s+/.test(token)
        ? token
        : formatToken(token, index === firstWordTokenIndex, index === lastWordTokenIndex)
    )
    .join("");
}
