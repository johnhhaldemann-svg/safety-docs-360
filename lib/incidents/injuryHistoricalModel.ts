import type { ExposureEventType } from "@/lib/incidents/exposureEventType";
import { normalizeExposureEventType } from "@/lib/incidents/exposureEventType";
import type { InjuryType } from "@/lib/incidents/injuryType";
import { normalizeInjuryType } from "@/lib/incidents/injuryType";
import { blendInjuryDistribution } from "@/lib/incidents/exposureInjuryCorrelations";

export type IncidentAnalyticsRow = {
  category?: string | null;
  exposure_event_type?: string | null;
  injury_type?: string | null;
};

/** Count injury incidents (category incident) with both exposure and injury type set. */
export function buildEventToInjuryCounts(rows: IncidentAnalyticsRow[]): Map<ExposureEventType, Map<InjuryType, number>> {
  const out = new Map<ExposureEventType, Map<InjuryType, number>>();
  for (const row of rows) {
    if (String(row.category ?? "").toLowerCase() !== "incident") continue;
    const ev = normalizeExposureEventType(row.exposure_event_type);
    const inj = normalizeInjuryType(row.injury_type);
    if (!ev || !inj) continue;
    const eventKey = ev;
    const injKey = inj;
    if (!out.has(eventKey)) out.set(eventKey, new Map());
    const m = out.get(eventKey)!;
    m.set(injKey, (m.get(injKey) ?? 0) + 1);
  }
  return out;
}

export function eventToInjuryLikelihoodTable(
  rows: IncidentAnalyticsRow[],
  alpha = 4
): {
  exposureEventType: ExposureEventType;
  totalCases: number;
  topInjuryPredictions: { injuryType: InjuryType; probability: number }[];
}[] {
  const counts = buildEventToInjuryCounts(rows);
  const events = [...counts.keys()];
  const result: {
    exposureEventType: ExposureEventType;
    totalCases: number;
    topInjuryPredictions: { injuryType: InjuryType; probability: number }[];
  }[] = [];
  for (const ev of events) {
    const m = counts.get(ev)!;
    let total = 0;
    const emp: Partial<Record<InjuryType, number>> = {};
    for (const [inj, c] of m) {
      emp[inj] = c;
      total += c;
    }
    const blended = blendInjuryDistribution(emp, ev, alpha);
    result.push({
      exposureEventType: ev,
      totalCases: total,
      topInjuryPredictions: blended.slice(0, 5),
    });
  }
  return result.sort((a, b) => b.totalCases - a.totalCases);
}
