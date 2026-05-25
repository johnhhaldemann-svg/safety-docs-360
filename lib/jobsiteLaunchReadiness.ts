import type { EmergencyActionPlanReadiness } from "./jobsiteEmergencyActionPlan";
import type { JobsiteTopRisk } from "./jobsiteTopRisks";

export type JobsiteLaunchStatus = "go" | "review" | "hold";
export type JobsiteLaunchStationStatus = JobsiteLaunchStatus | "no_signal";

export type JobsiteLaunchStation = {
  id: "emergency" | "risk" | "work_plan" | "permits" | "workforce" | "documents" | "incidents" | "activity";
  label: string;
  status: JobsiteLaunchStationStatus;
  summary: string;
  detail: string;
  href?: string;
};

export type JobsiteLaunchReadiness = {
  status: JobsiteLaunchStatus;
  headline: string;
  primaryBlocker: string;
  nextAction: string;
  stations: JobsiteLaunchStation[];
  criticalCount: number;
  warningCount: number;
};

export type JobsiteLaunchReadinessInput = {
  emergencyActionPlanReadiness: EmergencyActionPlanReadiness;
  emergencyActionPlanReviewStale?: boolean;
  emergencyActionPlanImmediateReviewNeeded?: boolean;
  emergencyActionPlanMissingCount: number;
  topJobsiteRisks: JobsiteTopRisk[];
  workPlannedToday: number;
  highRiskScheduleCount: number;
  permitCount: number;
  activePermitCount: number;
  permitBlockerCount: number;
  expiredPermitCount: number;
  workforceCount: number;
  documentCount: number;
  reportCount: number;
  incidentCount: number;
  recentIncidentCount: number;
  openActionCount: number;
  overdueActionCount: number;
  highRiskItemCount: number;
  sifExposureCount: number;
  activityCount: number;
  links?: Partial<Record<JobsiteLaunchStation["id"], string>>;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function station(params: JobsiteLaunchStation): JobsiteLaunchStation {
  return params;
}

function worstStationStatus(stations: JobsiteLaunchStation[]): JobsiteLaunchStatus {
  if (stations.some((item) => item.status === "hold")) return "hold";
  if (stations.some((item) => item.status === "review" || item.status === "no_signal")) return "review";
  return "go";
}

function headline(status: JobsiteLaunchStatus) {
  if (status === "hold") return "Launch hold: immediate review needed before work is released.";
  if (status === "review") return "Launch review: verify open items before work proceeds.";
  return "Launch go: no active hold signals detected.";
}

function fallbackNextAction(status: JobsiteLaunchStatus) {
  if (status === "hold") return "Resolve the hold item, document the field review, and re-check readiness before releasing work.";
  if (status === "review") return "Confirm station reviews, update missing records, and brief supervisors before the shift starts.";
  return "Maintain the pre-task review, watch for changed conditions, and keep station records current.";
}

export function buildJobsiteLaunchReadiness(input: JobsiteLaunchReadinessInput): JobsiteLaunchReadiness {
  const topRisk = input.topJobsiteRisks.find((risk) => risk.evidenceCount > 0) ?? input.topJobsiteRisks[0] ?? null;
  const hasCriticalRisk = input.topJobsiteRisks.some((risk) => risk.evidenceCount > 0 && risk.riskLevel === "critical");
  const hasHighRisk = input.topJobsiteRisks.some((risk) => risk.evidenceCount > 0 && risk.riskLevel === "high");
  const topRiskLabel = topRisk?.evidenceCount ? topRisk.title : "baseline risk watchlist";

  const stations: JobsiteLaunchStation[] = [
    station({
      id: "emergency",
      label: "Emergency",
      status:
        input.emergencyActionPlanReadiness === "missing_critical_info" || input.emergencyActionPlanImmediateReviewNeeded
          ? "hold"
          : input.emergencyActionPlanReadiness === "needs_review" || input.emergencyActionPlanReviewStale
            ? "review"
            : "go",
      summary:
        input.emergencyActionPlanReadiness === "complete"
          ? "Emergency profile ready"
          : input.emergencyActionPlanReadiness === "missing_critical_info"
            ? "Immediate review needed"
            : "Emergency profile needs review",
      detail:
        input.emergencyActionPlanMissingCount > 0
          ? `${plural(input.emergencyActionPlanMissingCount, "EAP item")} missing or stale.`
          : input.emergencyActionPlanReviewStale
            ? "Last review is stale."
            : "Emergency contacts, responder access, muster, AED, first aid, and medical resource fields are present.",
      href: input.links?.emergency,
    }),
    station({
      id: "risk",
      label: "Risk",
      status: hasCriticalRisk || input.sifExposureCount > 0 ? "hold" : hasHighRisk || input.highRiskItemCount > 0 ? "review" : "go",
      summary:
        hasCriticalRisk || input.sifExposureCount > 0
          ? "Critical risk signal active"
          : hasHighRisk || input.highRiskItemCount > 0
            ? "High-risk controls need review"
            : "No active critical risk signal",
      detail:
        input.sifExposureCount > 0
          ? `${plural(input.sifExposureCount, "SIF exposure")} needs immediate field review.`
          : topRisk?.evidenceCount
            ? `${topRiskLabel} is the leading live risk.`
            : "Top 10 risk board is using the baseline watchlist.",
      href: input.links?.risk,
    }),
    station({
      id: "work_plan",
      label: "Work Plan",
      status: input.workPlannedToday === 0 ? "no_signal" : input.highRiskScheduleCount > 0 ? "review" : "go",
      summary: input.workPlannedToday === 0 ? "No plan signal" : `${plural(input.workPlannedToday, "work item")} planned`,
      detail:
        input.workPlannedToday === 0
          ? "No daily activity plan is visible for today."
          : input.highRiskScheduleCount > 0
            ? `${plural(input.highRiskScheduleCount, "high-risk item")} needs pre-task control verification.`
            : "Visible work plan does not show high-risk schedule blockers.",
      href: input.links?.work_plan,
    }),
    station({
      id: "permits",
      label: "Permits",
      status:
        input.permitBlockerCount > 0 || input.expiredPermitCount > 0
          ? "hold"
          : input.permitCount === 0
            ? "no_signal"
            : input.activePermitCount < input.permitCount
              ? "review"
              : "go",
      summary:
        input.permitBlockerCount > 0 || input.expiredPermitCount > 0
          ? "Permit hold"
          : input.permitCount === 0
            ? "No permit records"
            : `${plural(input.activePermitCount, "active permit")} visible`,
      detail:
        input.expiredPermitCount > 0
          ? `${plural(input.expiredPermitCount, "expired permit")} must be resolved before work proceeds.`
          : input.permitBlockerCount > 0
            ? `${plural(input.permitBlockerCount, "permit blocker")} needs verification.`
            : input.permitCount === 0
              ? "No permit records are linked to this jobsite."
              : "Permit station has no active hold signal.",
      href: input.links?.permits,
    }),
    station({
      id: "workforce",
      label: "Workforce",
      status: input.workforceCount === 0 ? "no_signal" : "go",
      summary: input.workforceCount === 0 ? "No assigned users" : `${plural(input.workforceCount, "user")} in scope`,
      detail: input.workforceCount === 0 ? "No visible team assignment signal is available." : "Visible company users are in jobsite scope.",
      href: input.links?.workforce,
    }),
    station({
      id: "documents",
      label: "Documents",
      status: input.documentCount + input.reportCount === 0 ? "no_signal" : "go",
      summary: `${plural(input.documentCount, "document")} / ${plural(input.reportCount, "report")}`,
      detail:
        input.documentCount + input.reportCount === 0
          ? "No linked documents or reports are visible for this jobsite."
          : "Document and report records are linked to the jobsite.",
      href: input.links?.documents,
    }),
    station({
      id: "incidents",
      label: "Incidents",
      status: input.recentIncidentCount > 0 ? "review" : input.incidentCount > 0 ? "review" : "go",
      summary: input.incidentCount > 0 ? `${plural(input.incidentCount, "incident")} logged` : "No incidents logged",
      detail:
        input.recentIncidentCount > 0
          ? `${plural(input.recentIncidentCount, "recent incident")} should be reviewed in the launch brief.`
          : input.incidentCount > 0
            ? "Incident history is present; verify closeout status."
            : "No incident record is visible for this jobsite.",
      href: input.links?.incidents,
    }),
    station({
      id: "activity",
      label: "Activity",
      status: input.overdueActionCount > 0 ? "hold" : input.openActionCount > 0 ? "review" : input.activityCount === 0 ? "no_signal" : "go",
      summary:
        input.overdueActionCount > 0
          ? `${plural(input.overdueActionCount, "overdue action")}`
          : input.openActionCount > 0
            ? `${plural(input.openActionCount, "open action")}`
            : input.activityCount === 0
              ? "No activity signal"
              : `${plural(input.activityCount, "activity")} today`,
      detail:
        input.overdueActionCount > 0
          ? "Overdue corrective actions need owner follow-up before handoff."
          : input.openActionCount > 0
            ? "Open actions should be reviewed in the shift brief."
            : input.activityCount === 0
              ? "No activity record is visible for today."
              : "Current activity signal is visible.",
      href: input.links?.activity,
    }),
  ];

  const status = worstStationStatus(stations);
  const criticalStations = stations.filter((item) => item.status === "hold");
  const reviewStations = stations.filter((item) => item.status === "review" || item.status === "no_signal");
  const primary = criticalStations[0] ?? reviewStations[0] ?? stations[0];

  return {
    status,
    headline: headline(status),
    primaryBlocker: primary ? `${primary.label}: ${primary.summary}` : "No active blocker detected.",
    nextAction: primary?.status === "hold" || primary?.status === "review" ? primary.detail : fallbackNextAction(status),
    stations,
    criticalCount: criticalStations.length,
    warningCount: reviewStations.length,
  };
}
