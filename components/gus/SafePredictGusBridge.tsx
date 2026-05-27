"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { GusAssistant } from "@/components/gus/GusAssistant";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import {
  buildGusContextFromSafetyAiAssessment,
  buildSafetyAiAssessmentForSafePredict,
} from "@/lib/gus/gusSafetyAiBridge";
import {
  forecastReasonsForSite,
  riskForecastForSite,
  summarizeSafePredictDataset,
  type SafePredictDataset,
  type SafePredictJobsiteRecord,
} from "@/lib/safePredictData";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusRiskLevel } from "@/lib/gus/gusTypes";

function toGusRiskLevel(level: SafePredictJobsiteRecord["riskLevel"] | "critical" | undefined): GusRiskLevel {
  if (level === "critical") return "severe";
  if (level === "high") return "high";
  if (level === "medium") return "moderate";
  return "low";
}

function riskRank(level: GusRiskLevel | undefined) {
  if (level === "severe") return 4;
  if (level === "high") return 3;
  if (level === "moderate") return 2;
  if (level === "low") return 1;
  return 0;
}

function highestRiskLevel(first: GusRiskLevel | undefined, second: GusRiskLevel | undefined): GusRiskLevel | undefined {
  return riskRank(second) > riskRank(first) ? second : first;
}

function siteIdsForScope(dataset: SafePredictDataset, selectedJobsiteId: string) {
  if (!selectedJobsiteId || selectedJobsiteId === "all") {
    return new Set(dataset.jobsites.map((site) => site.id));
  }
  return new Set(dataset.jobsites.some((site) => site.id === selectedJobsiteId) ? [selectedJobsiteId] : []);
}

function buildSafePredictGusContext(dataset: SafePredictDataset, selectedJobsiteId: string, route: string): Partial<GusContext> {
  const siteIds = siteIdsForScope(dataset, selectedJobsiteId);
  const summary = summarizeSafePredictDataset(dataset);
  const forecast = riskForecastForSite(dataset, selectedJobsiteId || "all");
  const reasons = forecastReasonsForSite(dataset, selectedJobsiteId || "all", forecast);
  const peakReason = reasons.reduce<(typeof reasons)[number] | null>(
    (highest, reason) => (!highest || reason.score > highest.score ? reason : highest),
    null,
  );
  const selectedSite = dataset.jobsites.find((site) => site.id === selectedJobsiteId) ?? null;
  const scopedPermits = dataset.permits.filter((permit) => siteIds.has(permit.siteId));
  const missingPermitTypes = scopedPermits
    .filter((permit) => permit.status !== "Active" || permit.readiness !== "Ready")
    .map((permit) => permit.type || permit.title)
    .filter(Boolean);
  const scopedActions = dataset.actions.filter((action) => siteIds.has(action.siteId) && action.status !== "Closed");
  const highPriorityActions = scopedActions.filter((action) => action.priority === "high" || action.priority === "critical");
  const safetyAiAssessment = buildSafetyAiAssessmentForSafePredict(dataset, selectedJobsiteId || "all");
  const aiContext = buildGusContextFromSafetyAiAssessment(safetyAiAssessment);
  const forecastRiskLevel = peakReason ? toGusRiskLevel(peakReason.riskLevel) : toGusRiskLevel(selectedSite?.riskLevel);
  const forecastDrivers = peakReason?.topDrivers.map((driver) => driver.label) ?? [];
  const linkedRiskDrivers = [...new Set([...(aiContext.riskDrivers ?? []), ...forecastDrivers])].slice(0, 8);

  return {
    ...aiContext,
    jobsiteId: selectedSite?.id,
    currentPage: selectedSite ? `SafePredict - ${selectedSite.name}` : "SafePredict",
    route,
    riskLevel: highestRiskLevel(forecastRiskLevel, aiContext.riskLevel),
    riskDrivers: linkedRiskDrivers,
    missingPermitTypes: [...new Set(missingPermitTypes)].slice(0, 6),
    expiredTrainingCount: summary.workforce.overdue,
    upcomingTrainingExpirationCount: summary.workforce.expiringSoon,
    recentObservationTypes: dataset.observations
      .filter((observation) => siteIds.has(observation.siteId))
      .slice(0, 6)
      .map((observation) => observation.category),
    recentNegativeObservationCount: dataset.observations.filter(
      (observation) => siteIds.has(observation.siteId) && observation.riskLevel !== "low",
    ).length,
    recentPositiveObservationCount: dataset.observations.filter(
      (observation) => siteIds.has(observation.siteId) && observation.riskLevel === "low",
    ).length,
    openCorrectiveActionCount: scopedActions.length,
    openHighPriorityActionCount: highPriorityActions.length,
    scheduleUploadedToday: dataset.mode === "live" && dataset.forecasts.length > 0,
  };
}

export function SafePredictGusBridge() {
  const { dataset, selectedJobsiteId } = useSafePredictData();
  const pathname = usePathname();
  const route = pathname || "/safe-predict";
  const gusOwnedTrainingRoute = route.startsWith("/safe-predict/gus-coaching");
  const liveContext = useMemo(
    () => buildSafePredictGusContext(dataset, selectedJobsiteId, route),
    [dataset, route, selectedJobsiteId],
  );

  if (gusOwnedTrainingRoute) return null;

  return (
    <GusAssistant
      currentPage={liveContext.currentPage ?? "SafePredict"}
      jobsiteId={liveContext.jobsiteId}
      route={liveContext.route}
      liveContext={liveContext}
    />
  );
}
