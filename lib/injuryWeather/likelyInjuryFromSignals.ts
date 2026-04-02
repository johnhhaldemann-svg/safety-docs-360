import { priorInjuryMixForExposure } from "@/lib/incidents/exposureInjuryCorrelations";
import type { ExposureEventType } from "@/lib/incidents/exposureEventType";
import { isExposureEventType } from "@/lib/incidents/exposureEventType";
import { eventToInjuryLikelihoodTable, type IncidentAnalyticsRow } from "@/lib/incidents/injuryHistoricalModel";
import type { InjuryType } from "@/lib/incidents/injuryType";
import { INJURY_TYPE_LABELS, normalizeInjuryType } from "@/lib/incidents/injuryType";
import type { LikelyInjuryInsight, NormalizedLiveSignalRow } from "@/lib/injuryWeather/types";

function humanizeExposure(code: string): string {
  return code.replace(/_/g, " ");
}

/**
 * Rank likely injury types from incident rows in the supplied signal set (often all dates in company/jobsite scope).
 * Order: empirical injury_type counts → exposure+injury blend → exposure-only priors.
 */
export function likelyInjuryInsightFromSignals(rows: NormalizedLiveSignalRow[]): LikelyInjuryInsight {
  const incidents = rows.filter((r) => r.source === "incident");
  const singleIncidentDrivesView = rows.length === 1 && incidents.length === 1;
  const withType = incidents.filter((r) => r.injuryType);

  if (withType.length >= 1) {
    const counts = new Map<InjuryType, number>();
    for (const r of withType) {
      const k = r.injuryType!;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const total = withType.length;
    const [top, n] = sorted[0];
    const pct = Math.round((n / total) * 100);
    const second = sorted[1];
    const detailNote = singleIncidentDrivesView
      ? `This scope has only that one incident (${INJURY_TYPE_LABELS[top]}). The readout matches the fields you recorded; where the dashboard uses a single-event case index, that is separate from this mix.`
      : `${total} incident(s) with injury type in this scope (all dates)—${pct}% ${INJURY_TYPE_LABELS[top]}. Empirical mix from recorded injury types.`;
    return {
      headline: INJURY_TYPE_LABELS[top],
      secondaryLine: second
        ? `Also common: ${INJURY_TYPE_LABELS[second[0]]} (${Math.round((second[1] / total) * 100)}%)`
        : null,
      detailNote,
      hasData: true,
    };
  }

  const analytics: IncidentAnalyticsRow[] = incidents.map((r) => ({
    category: "incident",
    exposure_event_type: r.exposureEventType ?? null,
    injury_type: r.injuryType ?? null,
  }));
  const table = eventToInjuryLikelihoodTable(analytics, 4);
  if (table.length > 0) {
    const row = table[0];
    const top = row.topInjuryPredictions[0];
    if (top) {
      const pct = Math.round(top.probability * 100);
      return {
        headline: INJURY_TYPE_LABELS[top.injuryType],
        secondaryLine: `${pct}% blended for ${humanizeExposure(row.exposureEventType)} (${row.totalCases} case${row.totalCases === 1 ? "" : "s"})`,
        detailNote:
          "From exposure-linked incidents blended with reference priors—strengthen by recording injury type on each incident.",
        hasData: true,
      };
    }
  }

  const withExp = incidents.filter((r) => r.exposureEventType && isExposureEventType(r.exposureEventType));
  if (withExp.length >= 1) {
    const expCounts = new Map<string, number>();
    for (const r of withExp) {
      const e = r.exposureEventType!;
      expCounts.set(e, (expCounts.get(e) ?? 0) + 1);
    }
    const dominantExp = [...expCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] as ExposureEventType;
    const mix = priorInjuryMixForExposure(dominantExp);
    const ranked = (Object.entries(mix) as [InjuryType, number][]).sort((a, b) => b[1] - a[1]);
    const best = ranked[0];
    const detailNote = singleIncidentDrivesView
      ? `Only one incident is in this scope (${humanizeExposure(dominantExp)}). Showing the reference injury mix for that exposure; add injury type on the record for a direct match to what was reported.`
      : "No injury type on incidents yet—showing typical injury mix for the most common exposure type in this scope (illustrative prior).";
    return {
      headline: INJURY_TYPE_LABELS[best[0]],
      secondaryLine: `Reference pattern for ${humanizeExposure(dominantExp)} (${withExp.length} exposure${withExp.length === 1 ? "" : "s"} logged)`,
      detailNote,
      hasData: true,
    };
  }

  return {
    headline: "Not enough data",
    secondaryLine: null,
    detailNote: "Record injury type and exposure event type on incidents to rank likely injury patterns for this scope.",
    hasData: false,
  };
}

/** Demo / offline dashboard copy. */
export const DEMO_LIKELY_INJURY_INSIGHT: LikelyInjuryInsight = {
  headline: INJURY_TYPE_LABELS.contusion,
  secondaryLine: "Also common: Strain (illustrative seed)",
  detailNote: "Example only when database seed is offline—connect live incidents for your organization’s mix.",
  hasData: true,
};

/** Company injury-analytics API: same ranking from raw `company_incidents` rows. */
export function likelyInjuryInsightFromIncidentAnalyticsRows(rows: IncidentAnalyticsRow[]): LikelyInjuryInsight {
  const pseudo: NormalizedLiveSignalRow[] = rows
    .filter((r) => String(r.category ?? "").toLowerCase() === "incident")
    .map((r) => {
      const evRaw = r.exposure_event_type != null ? String(r.exposure_event_type).trim() : "";
      return {
        tradeId: "_",
        tradeLabel: "_",
        categoryId: null,
        categoryLabel: "_",
        severity: "medium" as const,
        created_at: "",
        source: "incident" as const,
        injuryType: normalizeInjuryType(r.injury_type),
        exposureEventType: evRaw && isExposureEventType(evRaw) ? evRaw : null,
      };
    });
  return likelyInjuryInsightFromSignals(pseudo);
}
