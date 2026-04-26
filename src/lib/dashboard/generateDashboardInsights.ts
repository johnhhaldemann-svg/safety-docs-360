import type {
  DashboardAiInsight,
  DashboardOverview,
  ObservationCategoryCount,
  TrendPoint,
} from "@/src/lib/dashboard/types";

/** Direction of change for narrative copy (not the same as chart TrendDirection). */
export type InsightTrend = "improving" | "worsening" | "stable";

export type DashboardRulesInsight = {
  id: string;
  /** Higher runs first; capped when converting to panel items. */
  priority: number;
  headline: string;
  whatChanged: string;
  whyItMatters: string;
  whoIsAffected: string;
  whatShouldBeDone: string;
  trend: InsightTrend;
  href?: string;
};

export type DashboardInsightsContext = {
  /** Tables that failed to load (schema/RLS); passed from the overview builder only. */
  missingTables?: string[];
  /** Count of SOR rows in the selected window (from overview query; not stored on {@link DashboardOverview}). */
  sorCountInWindow?: number;
};

function seriesHalfCompare(points: TrendPoint[]): "up" | "down" | "flat" {
  if (points.length < 2) return "flat";
  const mid = Math.floor(points.length / 2);
  const first = points.slice(0, mid);
  const second = points.slice(mid);
  const a = first.reduce((s, p) => s + p.value, 0) / Math.max(1, first.length);
  const b = second.reduce((s, p) => s + p.value, 0) / Math.max(1, second.length);
  if (b > a * 1.05) return "up";
  if (b < a * 0.95) return "down";
  return "flat";
}

function trendForCountSeries(dir: "up" | "down" | "flat"): InsightTrend {
  if (dir === "up") return "worsening";
  if (dir === "down") return "improving";
  return "stable";
}

function trendForRateSnapshot(rate: number, warnBelow: number, badBelow: number): InsightTrend {
  if (rate <= badBelow) return "worsening";
  if (rate < warnBelow) return "worsening";
  if (rate >= warnBelow + 10) return "improving";
  return "stable";
}

function trendPhrase(t: InsightTrend): string {
  if (t === "improving") return "improving compared with earlier buckets in the selected period";
  if (t === "worsening") return "worsening compared with earlier buckets in the selected period";
  return "stable across the selected window";
}

function pickObservationTheme(categories: ObservationCategoryCount[] | undefined): string | null {
  if (!categories?.length) return null;
  const fallish = categories.find((c) => /fall|tie[- ]?off|height|elevat|ladder|roof|scaffold/i.test(c.name));
  if (fallish && fallish.count >= 1) return fallish.name;
  return categories[0]?.name ?? null;
}

/**
 * Deterministic, rules-only insights from dashboard metrics.
 * Does not call any AI or external routes.
 */
export function generateDashboardInsights(
  overview: DashboardOverview,
  context?: DashboardInsightsContext
): DashboardRulesInsight[] {
  const out: DashboardRulesInsight[] = [];
  const missing = context?.missingTables?.filter(Boolean) ?? [];
  const s = overview.summary;
  const ca = overview.correctiveActionStatus;
  const obsDir = seriesHalfCompare(overview.observationTrend);
  const incDir = seriesHalfCompare(overview.incidentTrend);
  const obsTrend = trendForCountSeries(obsDir);
  const incTrend = trendForCountSeries(incDir);
  const credentialGaps = overview.credentialGaps ?? { expiredCredentials: 0, expiringSoonCredentials: 0 };
  const categories = overview.observationCategoryTop ?? [];

  if (missing.length > 0) {
    out.push({
      id: "insight-missing-tables",
      priority: 100,
      headline: "Some data sources are not connected",
      whatChanged: `The dashboard could not load one or more expected tables: ${missing.join(", ")}.`,
      whyItMatters:
        "Gaps hide real exposure—incidents, permits, or correctives may exist in the field but not in the numbers you see here.",
      whoIsAffected:
        "Executives and safety leads relying on this overview, plus field supervisors who need consistent records.",
      whatShouldBeDone:
        "Apply pending database migrations, fix RLS policies for service reads where intended, and confirm the company scope matches live data.",
      trend: "stable",
    });
  }

  if (ca.overdue > 0) {
    out.push({
      id: "insight-overdue-correctives",
      priority: 95,
      headline: "Overdue corrective actions need attention",
      whatChanged: `${ca.overdue} corrective action(s) are past their due date in the selected filters.`,
      whyItMatters:
        "Late follow-through leaves hazards uncontrolled and weakens accountability with contractors and crews.",
      whoIsAffected:
        "Responsible owners, affected trades on the jobsite, and contractors tied to those action items.",
      whatShouldBeDone:
        "Assign owners, reset realistic due dates, and escalate items that block work or involve high-energy tasks.",
      trend: ca.overdue >= 5 || (ca.open > 0 && ca.overdue / ca.open >= 0.35) ? "worsening" : "stable",
      href: "/field-id-exchange",
    });
  }

  const openVsClosed =
    ca.closed > 0 && ca.open >= 3 && ca.open > ca.closed * 1.15 ? true : ca.closed === 0 && ca.open >= 5;
  if (openVsClosed) {
    out.push({
      id: "insight-corrective-backlog",
      priority: 82,
      headline: "Corrective backlog is growing",
      whatChanged:
        "Corrective actions are being opened faster than they are being closed during the selected period.",
      whyItMatters:
        "This creates unresolved exposure and can overwhelm supervisors, so the oldest items never get closed.",
      whoIsAffected:
        "Site supervision, safety coordinators, and contractor partners in joint safety meetings.",
      whatShouldBeDone:
        "Review the backlog during the next contractor coordination meeting, close or merge duplicates, and cap new openings until triage completes.",
      trend: "worsening",
    });
  }

  if (s.openHighRiskItems > 0) {
    out.push({
      id: "insight-high-risk-open",
      priority: 92,
      headline: "High-risk observations remain open",
      whatChanged: `${s.openHighRiskItems} observation(s) are in a high-severity or stop-work posture for the current filters.`,
      whyItMatters:
        "Open high-risk items often correlate with energy isolation, fall, or struck-by scenarios until verified.",
      whoIsAffected: "Crews on the affected jobsites and any contractors working in overlapping zones.",
      whatShouldBeDone:
        "Prioritize field verification today, document controls, and downgrade severity only after evidence of mitigation.",
      trend: "stable",
      href: "/analytics",
    });
  }

  if (overview.incidentTrend.length >= 2 && incDir === "up") {
    out.push({
      id: "insight-incident-rise",
      priority: 88,
      headline: "Incident and near-miss signal is rising",
      whatChanged: "Incidents and near misses grouped by time are trending upward in the selected window.",
      whyItMatters:
        "A rising curve can reflect new scope, staffing changes, or eroding controls before serious harm occurs.",
      whoIsAffected: "All personnel on active jobsites, especially crews in the heaviest construction phases.",
      whatShouldBeDone:
        "Review recent changes in scope, crew mix, and critical controls on the highest-risk locations.",
      trend: incTrend,
      href: "/incidents",
    });
  } else if (overview.incidentTrend.length >= 2 && incDir === "down") {
    out.push({
      id: "insight-incident-improve",
      priority: 40,
      headline: "Incident signal is improving",
      whatChanged: "Fewer incidents and near misses are landing in recent time buckets than earlier in the window.",
      whyItMatters: "Sustained improvement usually means controls and supervision are sticking when reinforced.",
      whoIsAffected: "Field crews and contractors who adopted recent process changes.",
      whatShouldBeDone: "Capture what changed (briefings, engineering controls, staffing) and standardize it across sites.",
      trend: incTrend,
      href: "/incidents",
    });
  }

  if (overview.observationTrend.length >= 2 && obsDir === "up") {
    const theme = pickObservationTheme(categories);
    const label = theme ? `${theme}` : "Safety";
    out.push({
      id: "insight-observation-rise",
      priority: 86,
      headline: `${label} observations are trending up`,
      whatChanged: `${label} observations increased during the selected period when comparing early and recent buckets.`,
      whyItMatters:
        "This may indicate elevated work exposure, weak tie-off or pre-task planning, or insufficient supervisor verification—not always bad reporting.",
      whoIsAffected:
        "Workers performing the observed tasks, their immediate supervisors, and contractors with overlapping work areas.",
      whatShouldBeDone:
        "Hold a short jobsite walk focused on the dominant category, verify training and PPE, and tie findings to specific correctives.",
      trend: obsTrend,
      href: "/analytics",
    });
  } else if (overview.observationTrend.length >= 2 && obsDir === "down") {
    out.push({
      id: "insight-observation-down",
      priority: 38,
      headline: "Observation volume is easing",
      whatChanged: "Recorded observations declined in recent buckets versus earlier in the window.",
      whyItMatters:
        "Fewer tickets can mean better controls—or weaker reporting; context from supervisors matters.",
      whoIsAffected: "Safety observers and crews whose tasks were previously over-represented.",
      whatShouldBeDone:
        "Confirm reporting quality stayed steady; if controls truly improved, document lessons learned for other sites.",
      trend: obsTrend,
    });
  }

  const permitRate = s.permitComplianceRate;
  const permitRows = overview.permitCompliance ?? [];
  const highMissingPermits = permitRows.some((p) => p.required > 0 && p.missing > Math.floor(p.required * 0.15));
  if ((permitRate > 0 && permitRate < 85) || highMissingPermits) {
    const tr =
      permitRate > 0 ? trendForRateSnapshot(permitRate, 90, 75) : highMissingPermits ? "worsening" : "stable";
    const whatChangedPermit =
      permitRate > 0 && permitRate < 85
        ? `Overall permit compliance is about ${Math.round(permitRate)}% with visible gaps in required permits for some work types.`
        : highMissingPermits
          ? "Some permit types show a material share of missing or incomplete records even where the headline rate looks acceptable."
          : "Permit metrics indicate gaps relative to your internal target.";
    out.push({
      id: "insight-permit-compliance",
      priority: 84,
      headline: "Permit compliance is below target for high-risk work",
      whatChanged: whatChangedPermit,
      whyItMatters:
        "Missing permits before hot work, crane activity, excavation, confined space, or energized work increases regulatory and serious-injury risk.",
      whoIsAffected:
        "Authorized persons, fire watch, operators, and any contractor performing permit-controlled tasks.",
      whatShouldBeDone:
        "Review missing permits before allowing those activities to proceed, and align pre-job checklists with the permit types you require.",
      trend: tr,
    });
  }

  const trainingRate = s.trainingReadinessRate;
  const credWorst = credentialGaps.expiredCredentials > 0 || credentialGaps.expiringSoonCredentials >= 5;
  if ((trainingRate > 0 && trainingRate < 82) || credWorst) {
    out.push({
      id: "insight-training-readiness",
      priority: 80,
      headline: "Training readiness is under pressure",
      whatChanged:
        trainingRate < 82
          ? `Training readiness is near ${Math.round(trainingRate)}%, with credential gaps in contractor documents.`
          : "Training credentials show multiple expired or soon-to-expire records relative to requirements.",
      whyItMatters:
        "Workers with expired credentials should be flagged before task assignment, especially for high-energy or regulated tasks.",
      whoIsAffected:
        "Qualified workers whose cards lapse, staffing coordinators assigning crews, and contractor compliance leads.",
      whatShouldBeDone:
        "Run a renewal sweep, pause assignments where the task exceeds the worker's current credential, and communicate dates clearly to contractors.",
      trend: trendForRateSnapshot(trainingRate, 88, 75),
    });
  }

  if (s.jsaCompletionRate > 0 && s.jsaCompletionRate < 75) {
    out.push({
      id: "insight-jsa-completion",
      priority: 76,
      headline: "JSA completion is trailing expectations",
      whatChanged: `JSA or daily plan completion is near ${Math.round(s.jsaCompletionRate)}% for the filtered work.`,
      whyItMatters:
        "Incomplete JSAs weaken pre-task hazard recognition and make it harder to prove diligence after an event.",
      whoIsAffected: "Crew leads preparing daily plans and anyone signing onto tasks without a documented review.",
      whatShouldBeDone:
        "Tighten the expectation for same-day JSA submission, audit the last week for missing days, and coach foremen who are out of compliance.",
      trend: trendForRateSnapshot(s.jsaCompletionRate, 85, 70),
    });
  }

  const docs = overview.documentReadiness;
  if (docs.missingRequired > 0 || docs.expiringSoon >= 8) {
    out.push({
      id: "insight-document-gaps",
      priority: 74,
      headline: "Document pipeline shows gaps",
      whatChanged: `There are ${docs.missingRequired} missing required document(s) and ${docs.expiringSoon} nearing expiry.`,
      whyItMatters:
        "Missing or expiring documents stall work acceptance and can invalidate insurance or client audits.",
      whoIsAffected: "Document owners, project managers, and contractors submitting compliance packages.",
      whatShouldBeDone:
        "Prioritize uploads for missing required items and trigger renewals before expiry windows hit critical path work.",
      trend: "stable",
    });
  }

  if (s.safetyHealthScore < 70 && s.safetyHealthScore > 0) {
    out.push({
      id: "insight-health-score",
      priority: 78,
      headline: "Overall safety health score is under target",
      whatChanged: `The blended safety health score is ${s.safetyHealthScore}/100 for this snapshot.`,
      whyItMatters:
        "The score weights overdue work, incidents, permits, training, and documents—weakness in one area drags the whole picture.",
      whoIsAffected: "Leadership reviewing portfolio risk and site teams responsible for the heaviest-weight drivers.",
      whatShouldBeDone:
        "Tackle the highest-severity drivers first (overdue correctives, open high-risk observations, permit gaps), then re-check after a week of execution.",
      trend: trendForRateSnapshot(s.safetyHealthScore, 80, 60),
      href: "/command-center",
    });
  }

  const riskyContractors = overview.contractorRiskScores.filter(
    (c) => c.riskScore >= 78 || c.overdueItems >= 3 || c.openItems >= 6
  );
  if (riskyContractors.length > 0) {
    const names = riskyContractors.slice(0, 3).map((c) => c.contractorName);
    out.push({
      id: "insight-contractor-risk",
      priority: 72,
      headline: "Contractor compliance needs coordinated follow-up",
      whatChanged: `${riskyContractors.length} contractor(s) show elevated risk scores or overdue documentation, including ${names.join(", ")}${riskyContractors.length > 3 ? ", and others" : ""}.`,
      whyItMatters:
        "Documentation and evaluation gaps concentrate exposure where multiple employers share the same workface.",
      whoIsAffected:
        "Prime contractor safety staff, affected subcontractors, and jobsite gatekeepers verifying credentials.",
      whatShouldBeDone:
        "Schedule a short compliance touchpoint per flagged contractor, track expiries, and align on stop-work criteria for missing items.",
      trend: "worsening",
    });
  }

  const criticalRisks = overview.topRisks.filter((r) => r.severity === "critical" || r.severity === "high");
  if (criticalRisks.length > 0) {
    const top = criticalRisks[0];
    out.push({
      id: "insight-top-risk-category",
      priority: 70,
      headline: `Top risk theme: ${top.name}`,
      whatChanged: `${top.name} remains in the top risk list with ${top.count} related signal(s) in the window.`,
      whyItMatters:
        top.recommendation?.trim() ||
        "Sustained concentration in one theme usually means controls are not fully institutionalized.",
      whoIsAffected: "Crews performing work tied to this theme and supervisors signing off on related permits and JSAs.",
      whatShouldBeDone:
        "Use the built-in recommendation for this category in your safety plan, assign a single owner, and verify closure in the next inspection round.",
      trend: top.trend === "up" ? "worsening" : top.trend === "down" ? "improving" : "stable",
    });
  }

  const sorN = context?.sorCountInWindow ?? 0;
  if (sorN > 0 && out.length < 12) {
    out.push({
      id: "insight-sor-activity",
      priority: 35,
      headline: "Safety observation reports are being logged",
      whatChanged: `${sorN} safety observation report row(s) landed in the selected window.`,
      whyItMatters:
        "Leading indicators only help when they connect to correctives and briefings—volume without follow-up adds noise.",
      whoIsAffected: "Observers documenting findings and supervisors responsible for closure.",
      whatShouldBeDone:
        "Pair qualitative context from SORs with corrective follow-up and mention repeat themes in toolbox talks.",
      trend: "stable",
      href: "/analytics",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "insight-all-clear",
      priority: 10,
      headline: "No major alerts in the current window",
      whatChanged: "Key metrics are within expected ranges or data volume is still light for stronger signals.",
      whyItMatters: "Quiet dashboards still need discipline so leading indicators do not decay when attention moves elsewhere.",
      whoIsAffected: "Everyone on active sites—complacency is the hidden risk when numbers look good.",
      whatShouldBeDone:
        "Keep routine inspections, training renewals, and document reviews on calendar; spot-check a few JSAs and permits weekly.",
      trend: "stable",
      href: "/dashboard",
    });
  }

  out.sort((a, b) => b.priority - a.priority);
  return out.slice(0, 12);
}

/**
 * Maps structured rules insights into the compact shape consumed by {@link AiInsightsPanel}.
 */
export function rulesInsightsToAiInsights(insights: DashboardRulesInsight[]): DashboardAiInsight[] {
  return insights.map((r) => ({
    id: r.id,
    title: r.headline,
    body: `${r.whatChanged} ${r.whyItMatters} ${r.whoIsAffected} ${r.whatShouldBeDone} Trend: ${trendPhrase(r.trend)}.`,
    href: r.href,
  }));
}
