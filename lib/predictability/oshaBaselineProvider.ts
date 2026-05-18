import { getOshaNationalConstructionReference } from "@/lib/benchmarking/oshaConstructionNationalReference";
import type { NormalizedLiveSignalRow } from "@/lib/injuryWeather/types";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "osha_baseline";
}

function severityForIndex(index: number): NormalizedLiveSignalRow["severity"] {
  if (index === 0) return "critical";
  if (index <= 2) return "high";
  return "medium";
}

function sourceForLabel(label: string): NormalizedLiveSignalRow["source"] {
  return /fatal|incident|contact|transportation|fall/i.test(label) ? "incident" : "sor";
}

export function getOshaBaselinePrediction(input?: {
  monthLabel?: string;
  maxRows?: number;
}): { rows: NormalizedLiveSignalRow[]; citation: string; periodLabel: string } {
  const ref = getOshaNationalConstructionReference();
  const createdAt = input?.monthLabel ? new Date(input.monthLabel) : new Date();
  const baseDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  const highlights = [
    ...ref.nonfatalEventHighlights.map((row) => ({ label: row.label, count: row.constructionCases })),
    ...ref.fatalEventHighlights2023.map((row) => ({ label: row.label, count: row.count2023 })),
  ].sort((a, b) => b.count - a.count);

  const rows: NormalizedLiveSignalRow[] = [];
  const maxRows = Math.max(1, Math.min(80, input?.maxRows ?? 36));
  for (const [idx, highlight] of highlights.entries()) {
    const copies = Math.max(1, Math.min(8, Math.round(highlight.count / Math.max(1, highlights[0]?.count ?? 1) * 8)));
    for (let i = 0; i < copies && rows.length < maxRows; i += 1) {
      rows.push({
        tradeId: "osha_public_baseline",
        tradeLabel: "Construction OSHA public baseline",
        categoryId: slug(highlight.label),
        categoryLabel: highlight.label,
        severity: severityForIndex(idx),
        created_at: new Date(baseDate.getFullYear(), Math.max(0, baseDate.getMonth() - i), 1).toISOString(),
        source: sourceForLabel(highlight.label),
      });
    }
  }

  return {
    rows,
    citation: ref.citation,
    periodLabel: ref.nonfatalDaysAwayFromWork.periodLabel,
  };
}
