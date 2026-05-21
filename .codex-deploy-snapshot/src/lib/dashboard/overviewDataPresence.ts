import type {
  CorrectiveActionStatus,
  DashboardOverview,
  DashboardSummary,
  DocumentReadiness,
  TrendPoint,
} from "@/src/lib/dashboard/types";

export function trendHasPositiveValues(points: TrendPoint[]): boolean {
  return points.some((p) => Number.isFinite(p.value) && p.value > 0);
}

export function correctiveHasAnyActivity(status: CorrectiveActionStatus): boolean {
  return status.open > 0 || status.overdue > 0 || status.closed > 0;
}

export function documentPipelineTotal(doc: DocumentReadiness): number {
  return (
    doc.draft +
    doc.submitted +
    doc.underReview +
    doc.approved +
    doc.rejected +
    doc.missingRequired +
    doc.expiringSoon
  );
}

/** Summary numeric fields that indicate recorded operational activity (not derived rates). */
export function summaryHasRecordedCounts(s: DashboardSummary): boolean {
  return (
    s.incidentCount > 0 ||
    s.nearMissCount > 0 ||
    s.openHighRiskItems > 0 ||
    s.overdueCorrectiveActions > 0
  );
}

/**
 * True when all rolled-up rates are zero—usually means nothing to compute yet; do not present as a measured "0%".
 */
export function summaryRatesAreAllZero(s: DashboardSummary): boolean {
  return (
    s.permitComplianceRate === 0 &&
    s.jsaCompletionRate === 0 &&
    s.trainingReadinessRate === 0 &&
    s.documentReadinessRate === 0
  );
}

/** Any list, trend, or pipeline that would justify showing the overview sections. */
export function overviewHasStructuralSignals(o: DashboardOverview): boolean {
  const cred = o.credentialGaps ?? { expiredCredentials: 0, expiringSoonCredentials: 0 };
  return (
    o.permitCompliance.length > 0 ||
    documentPipelineTotal(o.documentReadiness) > 0 ||
    o.contractorRiskScores.length > 0 ||
    o.topRisks.length > 0 ||
    (o.observationCategoryTop?.length ?? 0) > 0 ||
    trendHasPositiveValues(o.observationTrend) ||
    trendHasPositiveValues(o.incidentTrend) ||
    correctiveHasAnyActivity(o.correctiveActionStatus) ||
    cred.expiredCredentials > 0 ||
    cred.expiringSoonCredentials > 0 ||
    summaryHasRecordedCounts(o.summary)
  );
}

/**
 * When false, headline KPI tiles would only show zeros and zero rates—use a single empty state instead.
 */
export function headlineKpisAreMeaningful(o: DashboardOverview): boolean {
  if (overviewHasStructuralSignals(o)) return true;
  if (summaryHasRecordedCounts(o.summary)) return true;
  if (!summaryRatesAreAllZero(o.summary)) return true;
  return o.summary.safetyHealthScore > 0 && o.summary.safetyHealthScore < 100;
}

export function workforceReadinessHasSignals(
  trainingRate: number,
  expiredCredentials: number,
  expiringSoonCredentials: number
): boolean {
  return trainingRate > 0 || expiredCredentials > 0 || expiringSoonCredentials > 0;
}

export function engineHealthAllGreen(items: { status: string }[]): boolean {
  return items.length > 0 && items.every((i) => i.status === "green");
}
