import type { ApprovedSourceRow, GusLearningSourceType, GusLearningTrustLevel } from "@/lib/gusLearning/types";
import { SOURCE_TYPES, TRUST_LEVELS } from "@/lib/gusLearning/types";

export type SourceValidationResult =
  | { ok: true; url: URL; source: ApprovedSourceRow }
  | { ok: false; reason: string };

export function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

export function isAllowedSourceType(value: unknown): value is GusLearningSourceType {
  return typeof value === "string" && (SOURCE_TYPES as readonly string[]).includes(value);
}

export function isAllowedTrustLevel(value: unknown): value is GusLearningTrustLevel {
  return typeof value === "string" && (TRUST_LEVELS as readonly string[]).includes(value);
}

export function defaultTrustLevelForSource(sourceType: GusLearningSourceType, domain: string): GusLearningTrustLevel {
  const normalizedDomain = normalizeDomain(domain);
  if (normalizedDomain === "osha.gov" || normalizedDomain.endsWith(".osha.gov")) return "high";
  if (normalizedDomain === "cdc.gov" || normalizedDomain.endsWith(".cdc.gov")) return "high";
  if (sourceType === "NIOSH" || sourceType === "CDC") return "high";
  if (
    sourceType === "manufacturer manual" ||
    sourceType === "company policy" ||
    sourceType === "site safety plan" ||
    sourceType === "SDS"
  ) {
    return "high";
  }
  if (sourceType === "blog_article") return "low";
  return "medium";
}

export function sourceMatchesUrl(source: ApprovedSourceRow, requestedUrl: string): SourceValidationResult {
  let url: URL;
  try {
    url = new URL(requestedUrl);
  } catch {
    return { ok: false, reason: "source_url must be a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "Only HTTPS sources are supported." };
  }
  if (!source.is_active) {
    return { ok: false, reason: "Approved source is inactive." };
  }
  if (source.trust_level === "blocked") {
    return { ok: false, reason: "Approved source is blocked." };
  }

  const sourceDomain = normalizeDomain(source.domain);
  const requestedDomain = normalizeDomain(url.hostname);
  const domainMatches = requestedDomain === sourceDomain || requestedDomain.endsWith(`.${sourceDomain}`);
  if (!domainMatches) {
    return { ok: false, reason: "Requested URL does not match the approved source domain." };
  }

  try {
    const sourceUrl = new URL(source.source_url);
    const sourcePath = sourceUrl.pathname.replace(/\/+$/, "");
    const requestedPath = url.pathname.replace(/\/+$/, "");
    const hostMatches = normalizeDomain(sourceUrl.hostname) === requestedDomain || requestedDomain.endsWith(`.${normalizeDomain(sourceUrl.hostname)}`);
    const pathMatches = !sourcePath || requestedPath === sourcePath || requestedPath.startsWith(`${sourcePath}/`);
    if (!hostMatches || !pathMatches) {
      return { ok: false, reason: "Requested URL is outside the approved source URL scope." };
    }
  } catch {
    return { ok: false, reason: "Approved source has an invalid source_url." };
  }

  return { ok: true, url, source };
}
