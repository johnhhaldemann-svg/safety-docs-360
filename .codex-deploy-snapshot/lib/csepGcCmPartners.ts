import { normalizeFinalExportText } from "@/lib/csepFinalization";

/**
 * Parses GC / CM / program partner entries from builder form data or draft JSON.
 * Accepts a string (legacy or textarea), a JSON array of strings, or a single-item array.
 * Preserves user order; trims entries; drops empty lines. Does not merge distinct partners.
 */
export function normalizeGcCmPartnerEntries(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.replace(/^\s*[-*•]\s*/, "").trim() : ""))
      .filter(Boolean);
  }
  const raw = typeof value === "string" ? value : "";
  const parts = raw
    .replace(/\r\n?/g, "\n")
    .split(/\n|;/)
    .map((item) => item.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

  return parts;
}

/**
 * One partner → plain text. Several → leading-dash lines (Word line breaks via `\n`).
 * Empty → `"N/A"`.
 */
export function formatGcCmPartnersForExport(entries: readonly string[]): string {
  const cleaned = entries
    .map((entry) => normalizeFinalExportText(entry)?.trim() ?? "")
    .filter(Boolean);
  if (!cleaned.length) return "N/A";
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.map((line) => `- ${line}`).join("\n");
}

export function gcCmPartnersHaystack(entries: readonly string[] | string | null | undefined): string {
  if (Array.isArray(entries)) {
    return entries.join(" ");
  }
  return typeof entries === "string" ? entries : "";
}
