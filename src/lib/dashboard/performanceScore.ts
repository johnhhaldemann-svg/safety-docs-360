import type {
  DashboardImprovementDriver,
  DashboardOverview,
  DashboardPerformanceScore,
  DashboardSummary,
  DocumentReadiness,
  EngineHealthItem,
  PermitCompliance,
  TrafficLightStatus,
  TrendDirection,
} from "@/src/lib/dashboard/types";

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function bandForScore(score: number): TrafficLightStatus {
  if (score >= 90) return "green";
  if (score >= 70) return "yellow";
  return "red";
}

function scoreLabel(score: number, band: TrafficLightStatus): string {
  if (band === "red") return "Critical attention";
  if (score >= 90) return "On target";
  return "Needs attention";
}

function docTotal(readiness: DocumentReadiness): number {
  return readiness.draft + readiness.submitted + readiness.underReview + readiness.approved + readiness.rejected;
}

function incidentTrendDirection(points: DashboardOverview["incidentTrend"]): TrendDirection {
  const values = points.map((point) => (Number.isFinite(point.value) ? point.value : 0));
  if (values.length < 2) return "flat";
  const midpoint = Math.floor(values.length / 2);
  const early = average(values.slice(0, midpoint));
  const late = average(values.slice(midpoint));
  if (late > early * 1.05) return "up";
  if (late < early * 0.95) return "down";
  return "flat";
}

function engineScore(items: EngineHealthItem[]): number {
  if (items.length === 0) return 75;
  const values = items.map((item) => {
    if (item.status === "green") return 100;
    if (item.status === "yellow") return 70;
    return 35;
  });
  return average(values);
}

function permitMissingTotal(permits: PermitCompliance[]): number {
  return permits.reduce((sum, permit) => sum + Math.max(0, permit.missing), 0);
}

function contributor(params: {
  key: string;
  label: string;
  score: number;
  weight: number;
}): DashboardPerformanceScore["contributors"][number] {
  const score = clampScore(params.score);
  return {
    key: params.key,
    label: params.label,
    score,
    weight: params.weight,
    band: bandForScore(score),
  };
}

export function buildDashboardPerformanceScore(overview: DashboardOverview): DashboardPerformanceScore {
  const summary = overview.summary;
  const missingPermits = permitMissingTotal(overview.permitCompliance);
  const documentsMeasured = docTotal(overview.documentReadiness) > 0;
  const readinessInputs = [
    overview.permitCompliance.length > 0 || missingPermits > 0 ? summary.permitComplianceRate : null,
    summary.jsaCompletionRate > 0 ? summary.jsaCompletionRate : null,
    summary.trainingReadinessRate > 0 ? summary.trainingReadinessRate : null,
    documentsMeasured ? summary.documentReadinessRate : null,
  ].filter((value): value is number => value != null);

  const closureScore = clampScore(
    100 -
      Math.min(45, summary.overdueCorrectiveActions * 12) -
      Math.min(20, overview.correctiveActionStatus.open * 2) +
      Math.min(10, overview.correctiveActionStatus.closed)
  );

  const trend = incidentTrendDirection(overview.incidentTrend);
  const trendPenalty = trend === "up" ? 18 : trend === "down" ? -8 : 0;
  const highThemePenalty = overview.topRisks.filter((risk) => risk.severity === "critical" || risk.severity === "high").length * 4;
  const trendScore = clampScore(85 - trendPenalty - Math.min(25, highThemePenalty));

  const executiveScore = clampScore(
    average([
      documentsMeasured ? summary.documentReadinessRate : 75,
      overview.contractorRiskScores.length > 0
        ? 100 - average(overview.contractorRiskScores.map((contractor) => contractor.riskScore))
        : 75,
      engineScore(overview.engineHealth),
    ])
  );

  const contributors = [
    contributor({
      key: "safety",
      label: "Safety performance",
      score: summary.openHighRiskItems > 0 ? Math.min(summary.safetyHealthScore, 65) : summary.safetyHealthScore,
      weight: 30,
    }),
    contributor({
      key: "readiness",
      label: "Operational readiness",
      score: readinessInputs.length > 0 ? average(readinessInputs) : 65,
      weight: 25,
    }),
    contributor({
      key: "closure",
      label: "Closure discipline",
      score: closureScore,
      weight: 20,
    }),
    contributor({
      key: "trend",
      label: "Trend health",
      score: trendScore,
      weight: 15,
    }),
    contributor({
      key: "executive",
      label: "Executive health",
      score: executiveScore,
      weight: 10,
    }),
  ];

  const weighted = contributors.reduce((sum, item) => sum + item.score * item.weight, 0);
  const totalWeight = contributors.reduce((sum, item) => sum + item.weight, 0);
  const rawValue = clampScore(weighted / Math.max(1, totalWeight));
  const value = summary.openHighRiskItems > 0 ? Math.min(rawValue, 69) : rawValue;
  const band = bandForScore(value);

  return {
    value,
    band,
    label: scoreLabel(value, band),
    trend,
    contributors,
  };
}

function addDriver(
  drivers: DashboardImprovementDriver[],
  driver: DashboardImprovementDriver
): void {
  drivers.push(driver);
}

function lowReadinessDriver(
  summary: DashboardSummary,
  readiness: DocumentReadiness
): DashboardImprovementDriver | null {
  const total = docTotal(readiness);
  if (total === 0 || summary.documentReadinessRate >= 70) return null;
  return {
    id: "document-readiness",
    title: "Document readiness is below target",
    detail: "Approved documents are not keeping pace with drafts and review-stage files.",
    severity: summary.documentReadinessRate < 50 ? "high" : "medium",
    metric: `${Math.round(summary.documentReadinessRate)}% ready`,
    href: "/library",
  };
}

export function buildDashboardImprovementDrivers(overview: DashboardOverview): DashboardImprovementDriver[] {
  const drivers: DashboardImprovementDriver[] = [];
  const summary = overview.summary;
  const missingPermits = permitMissingTotal(overview.permitCompliance);
  const credentials = overview.credentialGaps ?? { expiredCredentials: 0, expiringSoonCredentials: 0 };

  if (summary.openHighRiskItems > 0) {
    addDriver(drivers, {
      id: "open-high-risk",
      title: "Open high-risk items need field verification",
      detail: "High-risk work remains active until controls are verified and closed.",
      severity: "critical",
      metric: `${summary.openHighRiskItems} open`,
      href: "/field-id-exchange",
    });
  }

  if (summary.overdueCorrectiveActions > 0) {
    addDriver(drivers, {
      id: "overdue-correctives",
      title: "Corrective actions are overdue",
      detail: "Past-due corrective work is unresolved exposure and should be assigned before work continues.",
      severity: summary.overdueCorrectiveActions >= 5 ? "high" : "medium",
      metric: `${summary.overdueCorrectiveActions} overdue`,
      href: "/field-id-exchange",
    });
  }

  if (missingPermits > 0) {
    addDriver(drivers, {
      id: "missing-permits",
      title: "Permit coverage has gaps",
      detail: "Required or expired permits are blocking trustworthy work authorization.",
      severity: "high",
      metric: `${missingPermits} missing`,
      href: "/permits",
    });
  }

  if (credentials.expiredCredentials > 0) {
    addDriver(drivers, {
      id: "expired-credentials",
      title: "Expired credentials are present",
      detail: "Resolve expired contractor or worker credentials before assigning regulated work.",
      severity: "high",
      metric: `${credentials.expiredCredentials} expired`,
      href: "/training-matrix",
    });
  }

  const documentDriver = lowReadinessDriver(summary, overview.documentReadiness);
  if (documentDriver) addDriver(drivers, documentDriver);

  const redOrYellowEngines = overview.engineHealth.filter((item) => item.status !== "green");
  if (redOrYellowEngines.length > 0) {
    addDriver(drivers, {
      id: "engine-health",
      title: "Dashboard data sources need attention",
      detail: "One or more signal sources are disconnected, incomplete, or warning.",
      severity: redOrYellowEngines.some((item) => item.status === "red") ? "high" : "info",
      metric: `${redOrYellowEngines.length} source${redOrYellowEngines.length === 1 ? "" : "s"}`,
      href: "/analytics",
    });
  }

  for (const risk of overview.topRisks.slice(0, 2)) {
    if (risk.severity !== "critical" && risk.severity !== "high") continue;
    addDriver(drivers, {
      id: `risk-${risk.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${risk.name} is a leading risk theme`,
      detail: risk.recommendation,
      severity: risk.severity,
      metric: `${risk.count} signal${risk.count === 1 ? "" : "s"}`,
      href: "/analytics",
    });
  }

  if (drivers.length === 0) {
    addDriver(drivers, {
      id: "maintain-controls",
      title: "Maintain current controls",
      detail: "No major gaps are visible in this dashboard window. Keep verification cadence active.",
      severity: "info",
      metric: `${summary.safetyHealthScore} score`,
      href: "/command-center",
    });
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  return drivers.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]).slice(0, 6);
}
