import { priorInjuryMixForExposure } from "@/lib/incidents/exposureInjuryCorrelations";
import type { ExposureEventType } from "@/lib/incidents/exposureEventType";
import { isExposureEventType } from "@/lib/incidents/exposureEventType";
import { eventToInjuryLikelihoodTable, type IncidentAnalyticsRow } from "@/lib/incidents/injuryHistoricalModel";
import type { InjuryType } from "@/lib/incidents/injuryType";
import { INJURY_TYPE_LABELS, normalizeInjuryType } from "@/lib/incidents/injuryType";
import {
  SOR_HAZARD_TO_EXPOSURE_EVENTS,
  inferSorHazardCategoryFromLabel,
  type SorHazardCategoryCode,
} from "@/lib/incidents/sorHazardCategory";
import type { LikelyInjuryInsight, NormalizedLiveSignalRow } from "@/lib/injuryWeather/types";

const WEIGHT_TYPED_INCIDENT_ORPHAN = 5;
const WEIGHT_INCIDENT_EXPOSURE_PRIOR = 2.2;
const LEADING_SIGNAL_BASE = 0.38;
const EMPIRICAL_BUCKET_BASE = 1.35;
const EMPIRICAL_BUCKET_PER_CASE = 0.32;

function severityMass(sev: NormalizedLiveSignalRow["severity"]): number {
  if (sev === "critical") return 3;
  if (sev === "high") return 2;
  if (sev === "medium") return 1.25;
  return 1;
}

function addMixScaled(scores: Map<InjuryType, number>, exposure: ExposureEventType, scale: number): void {
  if (scale <= 0) return;
  const mix = priorInjuryMixForExposure(exposure);
  for (const t of Object.keys(mix) as InjuryType[]) {
    const p = mix[t];
    if (p > 0) scores.set(t, (scores.get(t) ?? 0) + p * scale);
  }
}

function resolveLeadingHazardCode(row: NormalizedLiveSignalRow): SorHazardCategoryCode | null {
  if (row.source === "sor") {
    return row.sorHazardCategoryCode ?? inferSorHazardCategoryFromLabel(row.categoryLabel);
  }
  if (row.source === "corrective_action") {
    return inferSorHazardCategoryFromLabel(row.categoryLabel);
  }
  return null;
}

function incidentAnalyticsFromRows(rows: NormalizedLiveSignalRow[]): IncidentAnalyticsRow[] {
  return rows
    .filter((r) => r.source === "incident")
    .map((r) => ({
      category: "incident",
      exposure_event_type: r.exposureEventType ?? null,
      injury_type: r.injuryType ?? null,
    }));
}

/**
 * Rank likely injury types from the full signal set: empirical exposure→injury (when both are recorded),
 * typed incidents, exposure-only priors, and SOR / corrective-action hazards mapped to exposure priors.
 */
export function likelyInjuryInsightFromSignals(rows: NormalizedLiveSignalRow[]): LikelyInjuryInsight {
  const scores = new Map<InjuryType, number>();
  const incidents = rows.filter((r) => r.source === "incident");
  let typedOrphan = 0;
  let exposureOnly = 0;
  let leadingSignalCount = 0;

  for (const row of incidents) {
    const hasType = Boolean(row.injuryType);
    const hasExp = Boolean(row.exposureEventType && isExposureEventType(row.exposureEventType));
    if (hasType && hasExp) {
      continue;
    }
    if (hasType && row.injuryType) {
      const k = row.injuryType;
      scores.set(k, (scores.get(k) ?? 0) + WEIGHT_TYPED_INCIDENT_ORPHAN);
      typedOrphan += 1;
    } else if (hasExp && row.exposureEventType && isExposureEventType(row.exposureEventType)) {
      addMixScaled(scores, row.exposureEventType as ExposureEventType, WEIGHT_INCIDENT_EXPOSURE_PRIOR);
      exposureOnly += 1;
    }
  }

  const analytics = incidentAnalyticsFromRows(rows);
  const table = eventToInjuryLikelihoodTable(analytics, 4);
  for (const row of table) {
    const bucketW = EMPIRICAL_BUCKET_BASE + Math.min(5, row.totalCases) * EMPIRICAL_BUCKET_PER_CASE;
    for (const pred of row.topInjuryPredictions.slice(0, 4)) {
      scores.set(
        pred.injuryType,
        (scores.get(pred.injuryType) ?? 0) + pred.probability * bucketW
      );
    }
  }

  for (const row of rows) {
    if (row.source !== "sor" && row.source !== "corrective_action") continue;
    const code = resolveLeadingHazardCode(row);
    if (!code) continue;
    const exposures = SOR_HAZARD_TO_EXPOSURE_EVENTS[code];
    if (!exposures.length) continue;
    const w = (LEADING_SIGNAL_BASE * severityMass(row.severity)) / exposures.length;
    leadingSignalCount += 1;
    for (const exp of exposures) {
      addMixScaled(scores, exp, w);
    }
  }

  const total = [...scores.values()].reduce((a, v) => a + v, 0);
  if (total <= 0) {
    return {
      headline: "Not enough data",
      secondaryLine: null,
      detailNote:
        "Log SOR observations, corrective actions, or incidents (injury type and/or exposure) to estimate likely injury patterns for this scope.",
      hasData: false,
    };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topT, topS] = ranked[0];
  const second = ranked[1];
  const parts: string[] = [];
  if (table.length > 0) parts.push("incident exposure history");
  if (typedOrphan > 0) parts.push(`${typedOrphan} typed incident(s)`);
  if (exposureOnly > 0) parts.push(`${exposureOnly} exposure-only incident(s)`);
  if (leadingSignalCount > 0) parts.push(`${leadingSignalCount} SOR/CAPA hazard signal(s)`);
  const basis = parts.length > 0 ? parts.join(" · ") : "Blended signals";

  return {
    headline: INJURY_TYPE_LABELS[topT],
    secondaryLine: second
      ? `Also weighted: ${INJURY_TYPE_LABELS[second[0]]} (${Math.round((second[1] / total) * 100)}%)`
      : null,
    detailNote: `${basis}. Relative blend—not a calibrated clinical or legal forecast.`,
    hasData: true,
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
