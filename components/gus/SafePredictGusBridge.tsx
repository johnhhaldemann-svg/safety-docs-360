"use client";

import { useMemo } from "react";
import { GusAssistant } from "@/components/gus/GusAssistant";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
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

function siteIdsForScope(dataset: SafePredictDataset, selectedJobsiteId: string) {
  if (!selectedJobsiteId || selectedJobsiteId === "all") {
    return new Set(dataset.jobsites.map((site) => site.id));
  }
  return new Set(dataset.jobsites.some((site) => site.id === selectedJobsiteId) ? [selectedJobsiteId] : []);
}

function buildSafePredictGusContext(dataset: SafePredictDataset, selectedJobsiteId: string): Partial<GusContext> {
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

  return {
    jobsiteId: selectedSite?.id,
    currentPage: selectedSite ? `SafePredict - ${selectedSite.name}` : "SafePredict",
    route: "/safe-predict",
    riskLevel: peakReason ? toGusRiskLevel(peakReason.riskLevel) : toGusRiskLevel(selectedSite?.riskLevel),
    riskDrivers: peakReason?.topDrivers.map((driver) => driver.label) ?? [],
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
  const liveContext = useMemo(
    () => buildSafePredictGusContext(dataset, selectedJobsiteId),
    [dataset, selectedJobsiteId],
  );

  return (
    <GusAssistant
      currentPage={liveContext.currentPage ?? "SafePredict"}
      jobsiteId={liveContext.jobsiteId}
      liveContext={liveContext}
    />
  );
}
