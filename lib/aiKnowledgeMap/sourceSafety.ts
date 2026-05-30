import type { ApprovedSourceRow } from "@/lib/gusLearning/types";
import { normalizeDomain } from "@/lib/gusLearning/sourceValidation";

const MAX_REDIRECTS = 3;

export type ApprovedSourceUrlValidation =
  | { ok: true; url: URL; domain: string }
  | { ok: false; reason: string };

export function validateApprovedSourceUrl(input: { sourceUrl: string; domain: string | null | undefined }): ApprovedSourceUrlValidation {
  let url: URL;
  try {
    url = new URL(input.sourceUrl);
  } catch {
    return { ok: false, reason: "source_url must be a valid URL." };
  }

  if (url.protocol !== "https:") return { ok: false, reason: "Only HTTPS approved sources are supported." };
  const approvedDomain = normalizeDomain(input.domain || url.hostname);
  const requestedDomain = normalizeDomain(url.hostname);
  if (isPrivateOrLocalHost(requestedDomain)) return { ok: false, reason: "Private, local, and metadata IP sources are not allowed." };
  if (!approvedDomain) return { ok: false, reason: "Approved source domain is required." };
  if (requestedDomain !== approvedDomain && !requestedDomain.endsWith(`.${approvedDomain}`)) {
    return { ok: false, reason: "Requested URL does not match the approved source domain." };
  }
  return { ok: true, url, domain: approvedDomain };
}

function isPrivateOrLocalHost(host: string) {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0" || host === "127.0.0.1" || host.startsWith("127.")) return true;
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("10.") || host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  return false;
}

function assertRedirectStaysAllowed(source: ApprovedSourceRow, url: URL) {
  const checked = validateApprovedSourceUrl({ sourceUrl: url.toString(), domain: source.domain || source.source_url });
  if (!checked.ok) throw new Error(checked.reason);
  const original = validateApprovedSourceUrl({ sourceUrl: source.source_url, domain: source.domain });
  if (!original.ok) throw new Error(original.reason);
  if (normalizeDomain(url.hostname) !== normalizeDomain(original.url.hostname)) {
    throw new Error("Approved source redirected to a different domain.");
  }
}

export async function fetchApprovedSourceText(source: ApprovedSourceRow, init?: RequestInit) {
  const current = validateApprovedSourceUrl({ sourceUrl: source.source_url, domain: source.domain });
  if (!current.ok) throw new Error(current.reason);
  let url = current.url;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Approved source redirected without a Location header.");
      url = new URL(location, url);
      assertRedirectStaysAllowed(source, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      url: url.toString(),
      contentType: response.headers.get("content-type"),
      text: await response.text(),
    };
  }

  throw new Error("Approved source redirected too many times.");
}
