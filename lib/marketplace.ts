const DEFAULT_DOCUMENT_CREDIT_COST = 5;

type MarketplaceNotes = {
  marketplace?: {
    enabled?: boolean;
    creditCost?: number;
  };
  creditCost?: number;
  legacyText?: string;
};

export function parseMarketplaceNotes(notes?: string | null): MarketplaceNotes {
  if (!notes) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes) as MarketplaceNotes;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getDocumentCreditCost(notes?: string | null) {
  const parsed = parseMarketplaceNotes(notes);
  const nested = parsed.marketplace?.creditCost;
  const topLevel = parsed.creditCost;
  const cost = typeof nested === "number" ? nested : topLevel;

  return typeof cost === "number" && cost > 0
    ? Math.round(cost)
    : DEFAULT_DOCUMENT_CREDIT_COST;
}

export function isMarketplaceEnabled(notes?: string | null) {
  const parsed = parseMarketplaceNotes(notes);

  if (typeof parsed.marketplace?.enabled === "boolean") {
    return parsed.marketplace.enabled;
  }

  return true;
}

export function buildMarketplaceNotes(
  existingNotes: string | null | undefined,
  settings: { enabled: boolean; creditCost: number }
) {
  const parsed = parseMarketplaceNotes(existingNotes);
  const next: MarketplaceNotes = {
    ...parsed,
    marketplace: {
      ...(parsed.marketplace ?? {}),
      enabled: settings.enabled,
      creditCost: Math.max(1, Math.round(settings.creditCost)),
    },
  };

  if ((!parsed || Object.keys(parsed).length === 0) && existingNotes?.trim()) {
    next.legacyText = existingNotes.trim();
  }

  return JSON.stringify(next);
}

export function normalizePurchasedIds(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return input.filter((value): value is string => typeof value === "string");
}

export const DEFAULT_DOCUMENT_CREDITS = 10;
