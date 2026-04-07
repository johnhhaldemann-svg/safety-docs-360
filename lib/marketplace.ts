import { normalizeDocumentsBucketObjectPath } from "@/lib/documentsBucketPath";

const DEFAULT_DOCUMENT_CREDIT_COST = 5;

export type SubmitterPreviewStatus = "pending" | "approved" | "rejected";

type MarketplaceNotes = {
  marketplace?: {
    enabled?: boolean;
    creditCost?: number;
    previewFilePath?: string;
    /** Owner of the document must approve auto-generated preview before buyers see it. */
    submitterPreviewStatus?: SubmitterPreviewStatus;
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

export function getMarketplacePreviewPath(notes?: string | null): string | null {
  const parsed = parseMarketplaceNotes(notes);
  const path = parsed.marketplace?.previewFilePath?.trim();
  return path ? path : null;
}

export function getSubmitterPreviewStatus(
  notes?: string | null
): SubmitterPreviewStatus | undefined {
  const parsed = parseMarketplaceNotes(notes);
  const s = parsed.marketplace?.submitterPreviewStatus;
  if (s === "pending" || s === "approved" || s === "rejected") {
    return s;
  }
  return undefined;
}

/** Block anonymous marketplace buyers until the document owner approves the preview (or legacy row with no status). */
export function isBuyerMarketplacePreviewBlocked(notes?: string | null) {
  const s = getSubmitterPreviewStatus(notes);
  return s === "pending" || s === "rejected";
}

/** Storage prefix for a document's marketplace preview objects. */
export function marketplacePreviewPathPrefix(documentId: string) {
  return `marketplace-preview/${documentId}/`;
}

/**
 * True when `path` points at this document's marketplace preview object.
 * Accepts raw bucket keys, `documents/...` prefixes, **and full Supabase public/sign URLs**
 * (dashboard often stores the full URL in `notes`; comparing only to `marketplace-preview/{id}/...`
 * incorrectly rejected those rows). UUID segment match is case-insensitive.
 */
export function isValidMarketplacePreviewPath(documentId: string, path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("..")) {
    return false;
  }
  const key = normalizeDocumentsBucketObjectPath(trimmed);
  if (!key || key.includes("..")) {
    return false;
  }
  const id = documentId.trim();
  if (!id) {
    return false;
  }
  const prefix = marketplacePreviewPathPrefix(id);
  return key.length > prefix.length && key.toLowerCase().startsWith(prefix.toLowerCase());
}

export function buildMarketplaceNotes(
  existingNotes: string | null | undefined,
  settings: {
    enabled: boolean;
    creditCost: number;
    previewFilePath?: string | null;
    submitterPreviewStatus?: SubmitterPreviewStatus | null;
  }
) {
  const parsed = parseMarketplaceNotes(existingNotes);
  const marketplace: NonNullable<MarketplaceNotes["marketplace"]> = {
    ...(parsed.marketplace ?? {}),
    enabled: settings.enabled,
    creditCost: Math.max(1, Math.round(settings.creditCost)),
  };

  if (settings.previewFilePath === null) {
    delete marketplace.previewFilePath;
    delete marketplace.submitterPreviewStatus;
  } else if (
    typeof settings.previewFilePath === "string" &&
    settings.previewFilePath.trim()
  ) {
    marketplace.previewFilePath = settings.previewFilePath.trim();
  }

  if (settings.submitterPreviewStatus !== undefined) {
    if (settings.submitterPreviewStatus === null) {
      delete marketplace.submitterPreviewStatus;
    } else {
      marketplace.submitterPreviewStatus = settings.submitterPreviewStatus;
    }
  }

  const next: MarketplaceNotes = {
    ...parsed,
    marketplace,
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
