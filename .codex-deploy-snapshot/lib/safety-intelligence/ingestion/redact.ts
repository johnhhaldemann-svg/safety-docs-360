import type { JsonObject, JsonValue } from "@/types/safety-intelligence";
import { CORPORATE_SUFFIXES, DIRECT_COMPANY_FIELD_KEYS } from "@/lib/safety-intelligence/ingestion/constants";
import { isRecord } from "@/lib/safety-intelligence/validation/common";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripCorporateSuffixes(value: string) {
  let result = normalizeWhitespace(value);
  let changed = true;

  while (changed) {
    changed = false;
    for (const suffix of CORPORATE_SUFFIXES) {
      const pattern = new RegExp(`(?:,?\\s+${escapeRegex(suffix)})$`, "i");
      if (pattern.test(result)) {
        result = result.replace(pattern, "").trim();
        changed = true;
      }
    }
  }

  return result;
}

function buildTokenVariants(rawToken: string) {
  const variants = new Set<string>();
  const normalized = normalizeWhitespace(rawToken);
  if (!normalized) return variants;

  variants.add(normalized);

  const stripped = stripCorporateSuffixes(normalized);
  if (stripped && stripped.length >= 4) {
    variants.add(stripped);
  }

  return variants;
}

function collectDirectCompanyFieldTokens(value: JsonValue, tokens: Set<string>) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectDirectCompanyFieldTokens(entry, tokens);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, current] of Object.entries(value)) {
    if (DIRECT_COMPANY_FIELD_KEYS.has(key)) {
      if (typeof current === "string" && current.trim()) {
        for (const variant of buildTokenVariants(current)) {
          tokens.add(variant);
        }
      }
      continue;
    }

    collectDirectCompanyFieldTokens(current as JsonValue, tokens);
  }
}

function buildTokenPatterns(tokens: string[]) {
  return tokens
    .filter((token) => token.length >= 3)
    .sort((left, right) => right.length - left.length)
    .map((token) => ({
      token,
      pattern: new RegExp(`(^|[^a-z0-9])(${escapeRegex(token)})(?=$|[^a-z0-9])`, "gi"),
    }));
}

function redactString(value: string, tokens: string[], removedTokens: Set<string>) {
  let next = value;

  for (const { token, pattern } of buildTokenPatterns(tokens)) {
    pattern.lastIndex = 0;
    if (!pattern.test(next)) {
      continue;
    }

    pattern.lastIndex = 0;
    next = next.replace(pattern, (_, leading) => {
      removedTokens.add(token);
      return `${leading}[REDACTED_COMPANY]`;
    });
  }

  return next;
}

function redactValue(value: JsonValue, tokens: string[], removedTokens: Set<string>): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, tokens, removedTokens));
  }

  if (isRecord(value)) {
    const next: JsonObject = {};
    for (const [key, current] of Object.entries(value)) {
      if (DIRECT_COMPANY_FIELD_KEYS.has(key)) {
        if (typeof current === "string" && current.trim()) {
          for (const variant of buildTokenVariants(current)) {
            removedTokens.add(variant);
          }
        }
        next[key] = null;
        continue;
      }

      next[key] = redactValue(current as JsonValue, tokens, removedTokens);
    }
    return next;
  }

  if (typeof value === "string") {
    return redactString(value, tokens, removedTokens);
  }

  return value;
}

export function redactCompanyNames(params: {
  payload: JsonObject;
  companyName?: string | null;
}) {
  const tokenSet = new Set<string>();

  if (params.companyName?.trim()) {
    for (const variant of buildTokenVariants(params.companyName)) {
      tokenSet.add(variant);
    }
  }

  collectDirectCompanyFieldTokens(params.payload, tokenSet);

  const removedTokens = new Set<string>();
  const tokens = [...tokenSet];
  const sanitizedPayload = redactValue(params.payload, tokens, removedTokens) as JsonObject;

  return {
    sanitizedPayload,
    removedCompanyTokens: [...removedTokens].sort((left, right) => left.localeCompare(right)),
  };
}
