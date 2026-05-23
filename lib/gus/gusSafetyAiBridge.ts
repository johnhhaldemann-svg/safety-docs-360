import { assessSafetyRisk } from "@/lib/safety-ai/riskEngine";
import type { SafetyAiAssessment, SafetyAiSignal } from "@/lib/safety-ai/types";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusRiskLevel } from "@/lib/gus/gusTypes";
import type { SafePredictDataset, SafePredictJobsiteRecord } from "@/lib/safePredictData";
import type { DailyRiskBriefing } from "@/lib/predictiveSafetyEngine";

function toGusRiskLevel(level: SafetyAiAssessment["level"]): GusRiskLevel {
  if (level === "critical") return "severe";
  if (level === "high") return "high";
  if (level === "moderate") return "moderate";
  return "low";
}

function signalSeverity(level: string | null | undefined) {
  if (level === "critical") return 5;
  if (level === "high") return 4;
  if (level === "medium" || level === "moderate") return 3;
  if (level === "low") return 1;
  return undefined;
}

function isOpenStatus(status: string | null | undefined) {
  return !["closed", "complete", "completed", "resolved", "cancelled"].includes(String(status ?? "").toLowerCase());
}

function isOverdue(value: string | null | undefined) {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed < Date.now();
}

function scopeSites(dataset: SafePredictDataset, selectedJobsiteId: string) {
  if (!selectedJobsiteId || selectedJobsiteId === "all") return dataset.jobsites;
  return dataset.jobsites.filter((site) => site.id === selectedJobsiteId);
}

function siteIdsForScope(sites: SafePredictJobsiteRecord[]) {
  return new Set(sites.map((site) => site.id));
}

function jobsiteLocation(site: SafePredictJobsiteRecord | null | undefined) {
  return [site?.addressLine1, site?.city, site?.state].map((part) => part?.trim()).filter(Boolean).join(", ") || null;
}

function buildSignals(dataset: SafePredictDataset, siteIds: Set<string>): SafetyAiSignal[] {
  const hazardSignals = dataset.hazards
    .filter((hazard) => siteIds.has(hazard.siteId))
    .map(
      (hazard): SafetyAiSignal => ({
        id: hazard.id,
        type: "high_risk_work",
        label: hazard.title,
        hazard: hazard.title,
        severity: signalSeverity(hazard.riskLevel),
        controlGap: hazard.controlStatus === "Needs Control" ? 5 : hazard.controlStatus === "Control Planned" ? 3 : 1,
        status: hazard.controlStatus,
        highRisk: hazard.riskLevel === "critical" || hazard.riskLevel === "high",
        fatalityOrCatastrophicPotential: hazard.riskLevel === "critical",
        controls: hazard.controlStatus === "Controlled" ? ["Control marked complete"] : null,
        controlEvidence: hazard.controlStatus,
        jobsiteId: hazard.siteId,
      }),
    );

  const permitSignals = dataset.permits
    .filter((permit) => siteIds.has(permit.siteId))
    .map(
      (permit): SafetyAiSignal => ({
        id: permit.id,
        type: "permit_gap",
        label: permit.title || permit.type,
        hazard: permit.type,
        severity: signalSeverity(permit.riskLevel),
        controlGap: permit.status !== "Active" || permit.readiness !== "Ready" ? 5 : 1,
        status: permit.status,
        missingRequiredPermit: permit.status !== "Active" || permit.readiness !== "Ready",
        highRisk: permit.riskLevel === "critical" || permit.riskLevel === "high",
        jobsiteId: permit.siteId,
      }),
    );

  const actionSignals = dataset.actions
    .filter((action) => siteIds.has(action.siteId))
    .map(
      (action): SafetyAiSignal => ({
        id: action.id,
        type: "corrective_action",
        label: action.title,
        hazard: action.linkedRisk,
        severity: signalSeverity(action.priority),
        controlGap: isOpenStatus(action.status) ? 4 : 1,
        status: action.status,
        overdueCorrectiveAction: isOpenStatus(action.status) && isOverdue(action.dueDate),
        highRisk: action.priority === "critical" || action.priority === "high",
        jobsiteId: action.siteId,
      }),
    );

  const incidentSignals = dataset.incidents
    .filter((incident) => siteIds.has(incident.siteId))
    .map(
      (incident): SafetyAiSignal => ({
        id: incident.id,
        type: incident.type === "Near Miss" ? "near_miss" : "incident",
        label: incident.title,
        hazard: incident.type,
        severity: signalSeverity(incident.severity),
        controlGap: isOpenStatus(incident.status) ? 3 : 1,
        status: incident.status,
        highRisk: incident.severity === "critical" || incident.severity === "high",
        fatalityOrCatastrophicPotential: incident.severity === "critical",
        jobsiteId: incident.siteId,
      }),
    );

  const observationSignals = dataset.observations
    .filter((observation) => siteIds.has(observation.siteId))
    .map(
      (observation): SafetyAiSignal => ({
        id: observation.id,
        type: "observation",
        label: observation.title,
        hazard: observation.category,
        severity: signalSeverity(observation.riskLevel),
        controlGap: observation.status === "Open" ? 3 : 1,
        status: observation.status,
        highRisk: observation.riskLevel === "critical" || observation.riskLevel === "high",
        jobsiteId: observation.siteId,
      }),
    );

  const inspectionSignals = dataset.inspections
    .filter((inspection) => siteIds.has(inspection.siteId))
    .map(
      (inspection): SafetyAiSignal => ({
        id: inspection.id,
        type: "inspection_failure",
        label: inspection.title,
        hazard: inspection.checklist,
        severity: signalSeverity(inspection.riskLevel),
        controlGap: inspection.failedItems > 0 || inspection.status === "Overdue" || inspection.status === "Failed Check" ? 4 : 1,
        status: inspection.status,
        highRisk: inspection.riskLevel === "critical" || inspection.riskLevel === "high",
        jobsiteId: inspection.siteId,
      }),
    );

  const alertSignals = dataset.alerts
    .filter((alert) => siteIds.has(alert.siteId))
    .map(
      (alert): SafetyAiSignal => ({
        id: alert.id,
        type: "high_risk_work",
        label: alert.title,
        hazard: alert.site,
        severity: signalSeverity(alert.riskLevel),
        controlGap: alert.riskLevel === "critical" ? 5 : alert.riskLevel === "high" ? 4 : 2,
        highRisk: alert.riskLevel === "critical" || alert.riskLevel === "high",
        fatalityOrCatastrophicPotential: alert.riskLevel === "critical",
        jobsiteId: alert.siteId,
      }),
    );

  return [
    ...hazardSignals,
    ...permitSignals,
    ...actionSignals,
    ...incidentSignals,
    ...observationSignals,
    ...inspectionSignals,
    ...alertSignals,
  ];
}

export function buildSafetyAiAssessmentForSafePredict(
  dataset: SafePredictDataset,
  selectedJobsiteId: string,
): SafetyAiAssessment {
  const sites = scopeSites(dataset, selectedJobsiteId);
  const siteIds = siteIdsForScope(sites);
  const signals = buildSignals(dataset, siteIds);
  const selectedSite = selectedJobsiteId && selectedJobsiteId !== "all" ? sites[0] : null;

  return assessSafetyRisk({
    jobsiteId: selectedSite?.id ?? null,
    jobsiteName: selectedSite?.name ?? (sites.length > 1 ? "All SafePredict jobsites" : sites[0]?.name ?? null),
    location: jobsiteLocation(selectedSite ?? sites[0]),
    taskType: signals.find((signal) => signal.highRisk)?.hazard ?? null,
    trade: signals.find((signal) => signal.trade)?.trade ?? null,
    highRiskWorkCategories: signals
      .filter((signal) => signal.highRisk)
      .map((signal) => signal.hazard ?? signal.label)
      .filter(Boolean)
      .slice(0, 8) as string[],
    signals,
    controlEffectiveness:
      signals.length === 0
        ? "unknown"
        : signals.some((signal) => signal.controlGap === 5)
          ? "missing"
          : signals.some((signal) => Number(signal.controlGap ?? 0) >= 3)
            ? "partial"
            : "effective",
    dataCompleteness: Math.min(1, Math.max(0.15, new Set(signals.map((signal) => signal.type)).size / 5)),
    missingData: dataset.forecasts.length > 0 ? [] : ["work schedule forecast"],
    missingRequiredPermit: signals.some((signal) => signal.missingRequiredPermit),
    missingRequiredTraining: signals.some((signal) => signal.missingRequiredTraining),
    missingCompetentPersonReview: signals.some((signal) => signal.missingCompetentPersonReview),
    overdueCorrectiveActionForHazard: signals.some((signal) => signal.overdueCorrectiveAction),
    fatalityOrCatastrophicPotential: signals.some((signal) => signal.fatalityOrCatastrophicPotential),
    imminentDanger: signals.some((signal) => signal.imminentDanger),
  });
}

export function buildGusContextFromSafetyAiAssessment(assessment: SafetyAiAssessment): Partial<GusContext> {
  const topDrivers = assessment.topDrivers.map((driver) => driver.label);
  const recommendations = assessment.recommendations.map((recommendation) => recommendation.title);

  return {
    aiEngineLinked: true,
    safetyAiAssessment: assessment,
    aiEngineCriticalControlGaps: assessment.criticalControlGaps,
    aiEngineReviewTriggers: assessment.reviewTriggers,
    aiEngineActionTimeframe: assessment.actionTimeframe,
    aiEngineRecommendations: recommendations,
    riskLevel: toGusRiskLevel(assessment.level),
    riskDrivers: [
      ...assessment.criticalControlGaps,
      ...assessment.reviewTriggers,
      ...topDrivers,
    ].slice(0, 8),
  };
}

export function buildGusContextFromDailyRiskBriefing(briefing: DailyRiskBriefing): Partial<GusContext> {
  const topWork = briefing.highRiskWork[0];
  const missingPermits = briefing.readinessBlockers
    .filter((blocker) => blocker.type === "permit")
    .map((blocker) => blocker.detail || blocker.label)
    .slice(0, 5);
  const trainingGapCount = briefing.readinessBlockers.filter((blocker) => blocker.type === "training").length;
  const controlGaps = briefing.readinessBlockers
    .filter((blocker) => blocker.type === "control" || blocker.type === "competent_person")
    .map((blocker) => blocker.label)
    .slice(0, 5);
  const nextControl = briefing.controlsToVerify[0];
  const topAssessment = topWork?.assessment;

  return {
    aiEngineLinked: true,
    ...(topAssessment ? { safetyAiAssessment: topAssessment } : {}),
    aiEngineHighestDailyRiskLevel: topWork?.riskLevel,
    aiEngineTopHighRiskWork: topWork ? `${topWork.title} at ${topWork.jobsiteName}` : undefined,
    aiEngineCriticalControlGaps: controlGaps.length > 0 ? controlGaps : topAssessment?.criticalControlGaps ?? [],
    aiEngineReviewTriggers: [
      ...briefing.readinessBlockers.slice(0, 4).map((blocker) => blocker.label),
      ...(topAssessment?.reviewTriggers ?? []),
    ].slice(0, 8),
    aiEngineActionTimeframe: topAssessment?.actionTimeframe,
    aiEngineRecommendations: briefing.controlsToVerify.slice(0, 5).map((control) => control.text),
    aiEngineRecommendedNextAction: nextControl?.text ?? topAssessment?.recommendations[0]?.title,
    aiEngineStopWorkReviewRecommended: briefing.stopWorkReviewRecommended,
    riskLevel: topWork ? toGusRiskLevel(topWork.riskLevel) : undefined,
    riskDrivers: [
      ...(topWork?.drivers ?? []),
      ...briefing.readinessBlockers.slice(0, 4).map((blocker) => blocker.label),
    ].slice(0, 8),
    missingPermitTypes: missingPermits,
    expiredTrainingCount: trainingGapCount || undefined,
  };
}
