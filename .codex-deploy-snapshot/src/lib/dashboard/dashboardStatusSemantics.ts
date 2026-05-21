import type {
  ContractorRiskScore,
  DashboardSummary,
  DocumentReadiness,
  EngineHealthItem,
  PermitCompliance,
  TrafficLightStatus,
} from "@/src/lib/dashboard/types";

const RANK: Record<TrafficLightStatus, number> = { red: 0, yellow: 1, green: 2 };

/** Left accent stripe on {@link MetricCard} and similar tiles. */
export function trafficLightStripeClass(s: TrafficLightStatus): string {
  if (s === "green") return "bg-[var(--semantic-success)]";
  if (s === "yellow") return "bg-[var(--semantic-warning)]";
  return "bg-[var(--semantic-danger)]";
}

/**
 * Readiness / compliance where **higher is better** (0–100).
 * - Not measured: yellow (missing data / connected but empty).
 * - 90–100: green
 * - 70–89: yellow
 * - &lt;70: red
 */
export function readinessPercentBand(rate: number, measured: boolean): TrafficLightStatus {
  if (!measured || !Number.isFinite(rate)) return "yellow";
  const r = Math.round(Math.max(0, Math.min(100, rate)));
  if (r >= 90) return "green";
  if (r >= 70) return "yellow";
  return "red";
}

/**
 * Portfolio safety health score with escalation rules.
 * Red: score &lt;70, open high‑risk items, or SIF‑potential theme in top risks.
 * Yellow: score 70–89, overdue correctives (non‑critical backlog), or ambiguous unknowns.
 * Green: 90–100 with no overdue and no open high‑risk items.
 */
export function safetyHealthCompositeBand(
  summary: DashboardSummary,
  opts?: { sifPotentialTheme?: boolean }
): TrafficLightStatus {
  const score = Math.round(Math.max(0, Math.min(100, Number(summary.safetyHealthScore) || 0)));
  const hasHighRiskOpen = summary.openHighRiskItems > 0;
  const hasOverdue = summary.overdueCorrectiveActions > 0;
  const sif = opts?.sifPotentialTheme === true;

  if (score < 70 || hasHighRiskOpen || sif) return "red";
  if (hasOverdue) return "yellow";
  if (score >= 90) return "green";
  if (score >= 70) return "yellow";
  return "red";
}

/** Permit compliance row: missing required permit on the row forces red; else use rate bands. */
export function permitComplianceRowBand(p: PermitCompliance): TrafficLightStatus {
  if (p.required > 0 && p.missing > 0) return "red";
  return readinessPercentBand(p.complianceRate, p.required > 0 || p.completed > 0 || p.missing > 0);
}

/** Summary permit rate with portfolio missing count. */
export function permitPortfolioSummaryBand(
  rate: number,
  measured: boolean,
  missingRequiredPermitsTotal: number
): TrafficLightStatus {
  if (missingRequiredPermitsTotal > 0) return "red";
  return readinessPercentBand(rate, measured);
}

/** Training readiness: expired required credentials force red. */
export function trainingReadinessSummaryBand(
  rate: number,
  measured: boolean,
  expiredCredentials: number
): TrafficLightStatus {
  if (expiredCredentials > 0) return "red";
  return readinessPercentBand(rate, measured);
}

/** Document readiness from summary rate plus missing required documents in the pipeline. */
export function documentReadinessPortfolioBand(
  summaryRate: number,
  measured: boolean,
  readiness: DocumentReadiness
): TrafficLightStatus {
  if (readiness.missingRequired > 0) return "red";
  return readinessPercentBand(summaryRate, measured);
}

/** Contractor exposure (higher risk score is worse). */
export function contractorExposureBand(c: ContractorRiskScore): TrafficLightStatus {
  if (c.overdueItems > 0 || c.incidents > 0 || c.riskScore >= 70) return "red";
  if (c.riskScore >= 40 || c.openItems > 3) return "yellow";
  return "green";
}

/** Contractor sub‑metrics where higher compliance % is better (values are pre‑normalized 0–100). */
export function contractorCompliancePercentBand(rate: number): TrafficLightStatus {
  return readinessPercentBand(rate, true);
}

/** Pill / ring utility classes aligned with dashboard traffic semantics (green / yellow / red). */
export function trafficLightBadgeClasses(s: TrafficLightStatus): string {
  if (s === "green") return "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/30";
  if (s === "yellow") return "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/35";
  return "bg-red-500/15 text-red-900 ring-1 ring-red-500/35";
}

export function trafficLightNodeRingClass(s: TrafficLightStatus): string {
  if (s === "green") return "ring-2 ring-emerald-500/70 border-emerald-600/30";
  if (s === "yellow") return "ring-2 ring-amber-500/70 border-amber-600/30";
  return "ring-2 ring-red-500/70 border-red-600/30";
}

export function worstTrafficLight(statuses: TrafficLightStatus[]): TrafficLightStatus {
  if (statuses.length === 0) return "yellow";
  return statuses.reduce((acc, s) => (RANK[s] < RANK[acc] ? s : acc), "green" as TrafficLightStatus);
}

export function engineAggregateBand(items: EngineHealthItem[]): TrafficLightStatus {
  if (items.length === 0) return "yellow";
  return worstTrafficLight(items.map((i) => i.status));
}

/** Map superadmin / system health API statuses to dashboard traffic colors. */
export function systemHealthStatusToTrafficLight(
  s: "healthy" | "warning" | "critical" | "unknown"
): TrafficLightStatus {
  if (s === "healthy") return "green";
  if (s === "warning") return "yellow";
  if (s === "critical") return "red";
  return "yellow";
}

export function openHighRiskCountBand(count: number): TrafficLightStatus {
  return count > 0 ? "red" : "green";
}

export function overdueCorrectiveCountBand(count: number): TrafficLightStatus {
  return count > 0 ? "red" : "green";
}

/** Incidents are treated as higher severity than near misses alone. */
export function incidentCountBand(incidents: number): TrafficLightStatus {
  return incidents > 0 ? "red" : "green";
}

export function nearMissCountBand(nearMisses: number): TrafficLightStatus {
  return nearMisses > 0 ? "yellow" : "green";
}
