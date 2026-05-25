"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { AiFeedbackControls } from "@/components/ai/AiFeedbackControls";
import { buildAdoptionChecklist } from "@/components/dashboard/onboardingChecklist";
import { emptyOnboardingState, type OnboardingState } from "@/lib/onboardingState";
import {
  ActionTile,
  EmptyState,
  InlineMessage,
  MetricTile,
  PageHero,
  ProvenanceBadge,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import type { SafetyDashboardPayload } from "@/components/safety-intelligence/types";
import {
  buildSafetyManagerWorkflowRails,
  buildCommandCenterNotices,
  getRecommendationsEmptyMessage,
  getRiskMemoryEmptyMessage,
  summarizeOpenWork,
  type WorkspaceSummary,
} from "@/components/command-center/model";
import { InductionReadinessCard } from "@/components/command-center/InductionReadinessCard";
import { PredictiveModelView } from "@/components/analytics/PredictiveModelView";
import { AppTabBar } from "@/components/AppTabBar";
import { Sparkline } from "@/components/metrics/Sparkline";
import { TrustSummaryPanel } from "@/components/leadership/TrustSummaryPanel";
import { useUrlTabState } from "@/hooks/useUrlTabState";
import { canAccessCompanyWorkspaceHref } from "@/lib/companyFeatureAccess";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { AnalyticsSummary } from "@/components/analytics/types";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import type { PermissionMap } from "@/lib/rbac";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";

const COMMAND_CENTER_HUB_TABS = ["overview", "risk-memory", "predictive-risk", "insights", "open-work"] as const;
const COMMAND_CENTER_URL_TABS = [...COMMAND_CENTER_HUB_TABS, "risk"] as const;
const INSIGHTS_SECTIONS = ["recommendations", "safety-intelligence", "knowledge"] as const;
const INSIGHTS_SECTION_LABELS: Record<InsightsSection, string> = {
  recommendations: "Recommendations",
  "safety-intelligence": "Safety Intelligence",
  knowledge: "Company Knowledge",
};

const supabase = getSupabaseBrowserClient();

type HubTab = (typeof COMMAND_CENTER_HUB_TABS)[number];
type InsightsSection = (typeof INSIGHTS_SECTIONS)[number];

type AnalyticsSummaryPayload = {
  summary?: AnalyticsSummary;
  warning?: string;
  error?: string;
};

type CommandCenterAdoptionPayload = {
  companyProfile?: {
    name?: string | null;
    industry?: string | null;
    phone?: string | null;
    address_line_1?: string | null;
    city?: string | null;
    state_region?: string | null;
    country?: string | null;
  } | null;
  companyUsers: Array<{ status?: string | null }>;
  companyInvites: Array<{ status?: string | null }>;
  documents: Array<{ status?: string | null; final_file_path?: string | null; draft_file_path?: string | null }>;
  onboardingState: OnboardingState;
};

type BuilderAccess = {
  csep: boolean;
  peshep: boolean;
};

function formatCategory(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "Unmapped";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricValue(value: number | null | undefined) {
  return value == null ? "-" : String(value);
}

function rollupTone(band: string) {
  const value = band.trim().toLowerCase();
  if (value.includes("high") || value.includes("critical") || value.includes("severe")) return "error" as const;
  if (value.includes("moderate") || value.includes("elevated")) return "warning" as const;
  if (!value || value === "-") return "neutral" as const;
  return "success" as const;
}

function LaunchCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-4 shadow-[var(--app-shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-surface-35)]"
    >
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{description}</p>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">{label}</p>
    </Link>
  );
}

function StatTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-[var(--app-border-strong)] bg-white/88 px-4 py-4 shadow-[var(--app-shadow-soft)] transition hover:border-[var(--app-accent-surface-35)]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-text)]">{label}</span>
      <span className="mt-2 text-2xl font-bold tracking-tight text-[var(--app-text-strong)]">{value}</span>
      {hint ? <span className="mt-2 text-xs leading-5 text-[var(--app-text)]">{hint}</span> : null}
    </Link>
  );
}

function RiskMemoryDetails({
  risk,
  trend,
}: {
  risk: AnalyticsSummary["riskMemory"] | undefined;
  trend: AnalyticsSummary["riskMemoryTrend"] | undefined;
}) {
  if (!risk) return null;

  return (
    <div className="space-y-4">
      {trend && trend.points.length > 0 ? (
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 px-4 py-4 shadow-[var(--app-shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">30-day company risk score</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">Persisted nightly by the Risk Memory rollup.</p>
            </div>
            {trend.latest ? (
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--app-text-strong)]">{trend.latest.score.toFixed(1)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-muted)]">{trend.latest.band}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            <Sparkline
              points={trend.points.map((point) => ({ date: point.date, count: point.score }))}
              windowDays={30}
              loading={false}
              variant="compact"
            />
          </div>
          {trend.deltaScore != null ? (
            <p className="mt-2 text-xs text-[var(--app-muted)]">
              {trend.deltaScore > 0 ? "+" : ""}
              {trend.deltaScore.toFixed(1)} points vs {trend.points.length}d ago.
            </p>
          ) : null}
        </div>
      ) : (
        <InlineMessage tone="neutral">30-day risk score trend will appear after the next Risk Memory rollup.</InlineMessage>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top scopes</p>
          <div className="mt-4 space-y-2">
            {risk.topScopes.slice(0, 6).map((row, index) => (
              <div key={`${row.code ?? "scope"}-${index}`} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2.5">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{formatCategory(row.code)}</span>
                <strong className="text-[var(--app-accent-primary)]">{row.count}</strong>
              </div>
            ))}
            {risk.topScopes.length === 0 ? <p className="text-sm text-[var(--app-text)]">No scope tags yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top hazards</p>
          <div className="mt-4 space-y-2">
            {risk.topHazards.slice(0, 6).map((row, index) => (
              <div key={`${row.code ?? "hazard"}-${index}`} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2.5">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{formatCategory(row.code)}</span>
                <strong className="text-[var(--semantic-warning)]">{row.count}</strong>
              </div>
            ))}
            {risk.topHazards.length === 0 ? <p className="text-sm text-[var(--app-text)]">No hazard tags yet.</p> : null}
          </div>
        </div>
      </div>

      {(risk.topLocationGrids?.length ?? 0) > 0 || (risk.topLocationAreas?.length ?? 0) > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Location grids</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
              {(risk.topLocationGrids ?? []).slice(0, 6).map((row) => (
                <li key={`${row.label}-${row.count}`} className="flex justify-between gap-3 rounded-xl bg-[var(--app-panel)] px-3 py-2">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Areas / zones</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
              {(risk.topLocationAreas ?? []).slice(0, 6).map((row) => (
                <li key={`${row.label}-${row.count}`} className="flex justify-between gap-3 rounded-xl bg-[var(--app-panel)] px-3 py-2">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {risk.baselineHints && risk.baselineHints.length > 0 ? (
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
          <span className="font-semibold text-[var(--app-text-strong)]">Baseline patterns matched: </span>
          {risk.baselineHints.map((hint) => `${hint.scope_code}+${hint.hazard_code}`).join(" / ")}
        </div>
      ) : null}
    </div>
  );
}

function RecommendationsList({
  recommendations,
  loading,
  dismissingId,
  onDismiss,
}: {
  recommendations: NonNullable<AnalyticsSummary["riskMemoryRecommendations"]>;
  loading: boolean;
  dismissingId: string | null;
  onDismiss: (id: string) => void;
}) {
  const emptyMessage = getRecommendationsEmptyMessage(recommendations.length);
  if (emptyMessage) {
    return (
      <EmptyState
        title="No smart recommendations yet"
        description={emptyMessage}
        actionHref="/analytics"
        actionLabel="Open Safety analytics"
      />
    );
  }

  return (
    <div className="grid gap-3">
      {recommendations.map((recommendation) => (
        <div
          key={recommendation.id}
          className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 px-4 py-4 shadow-[var(--app-shadow-soft)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">{recommendation.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">{recommendation.body}</p>
              {recommendation.evidence ? <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{recommendation.evidence}</p> : null}
              {recommendation.businessImpact ? <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{recommendation.businessImpact}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <StatusBadge
                label={`${recommendation.sourceModule ?? recommendation.kind} - ${Math.round((recommendation.confidence ?? 0) * 100)}%`}
                tone="info"
              />
              <button
                type="button"
                disabled={loading || dismissingId === recommendation.id}
                onClick={() => onDismiss(recommendation.id)}
                className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-muted)] hover:text-[var(--semantic-danger)] disabled:opacity-40"
              >
                {dismissingId === recommendation.id ? "Dismissing..." : "Dismiss"}
              </button>
            </div>
          </div>
          {recommendation.actionHref ? (
            <Link href={recommendation.actionHref} className="mt-3 inline-flex text-xs font-bold text-[var(--app-accent-primary)] hover:text-[var(--app-link-hover)]">
              Open action path
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DailySafetyCommandCenterPanel({
  predictiveRisk,
  loading,
  syncingActions,
  syncMessage,
  onSyncActions,
}: {
  predictiveRisk: PredictiveRiskPayload | null;
  loading: boolean;
  syncingActions: boolean;
  syncMessage: string;
  onSyncActions: () => void;
}) {
  const briefing = predictiveRisk?.dailyBriefing;
  const actionQueue = predictiveRisk?.aiSafetyActionQueue;
  const approvalState = predictiveRisk?.approvalState;
  const feedbackInfluence = predictiveRisk?.feedbackInfluence;
  const memoryInfluence = predictiveRisk?.memoryInfluence;
  const calibrationSummary = predictiveRisk?.calibrationSummary;
  const conflicts = predictiveRisk?.aiSafetyConflictMap.findings.slice(0, 4) ?? [];
  const highRiskToday = briefing?.highRiskWork.filter((work) => work.timing === "today").slice(0, 3) ?? [];
  const highRiskTomorrow = briefing?.highRiskWork.filter((work) => work.timing === "tomorrow").slice(0, 3) ?? [];
  const missingPermits = briefing?.readinessBlockers.filter((blocker) => blocker.type === "permit").slice(0, 3) ?? [];
  const trainingGaps = briefing?.readinessBlockers.filter((blocker) => blocker.type === "training").slice(0, 3) ?? [];
  const openActions = briefing?.readinessBlockers.filter((blocker) => blocker.type === "corrective_action").slice(0, 3) ?? [];
  const weatherRisks = briefing?.readinessBlockers.filter((blocker) => blocker.type === "weather").slice(0, 3) ?? [];
  const weakJsas = briefing?.readinessBlockers.filter((blocker) => blocker.type === "control").slice(0, 3) ?? [];
  const repeatedObservations = briefing?.readinessBlockers.filter((blocker) => /repeated/i.test(blocker.label)).slice(0, 3) ?? [];
  const topWork = briefing?.highRiskWork[0] ?? null;
  const topControl = topWork?.recommendedControls[0] ?? null;
  const supervisorActions = [
    topControl?.recommendedAction,
    ...missingPermits.map((blocker) => blocker.detail),
    ...trainingGaps.map((blocker) => blocker.detail),
    ...openActions.map((blocker) => blocker.detail),
  ].filter((item): item is string => Boolean(item)).slice(0, 5);
  const morningBriefing = briefing
    ? [
        briefing.headline,
        ...briefing.whyThisMatters.slice(0, 2),
        ...(briefing.missingData.length > 0 ? [`Missing data lowers confidence: ${briefing.missingData.slice(0, 2).join("; ")}`] : []),
      ]
    : [];

  return (
    <SectionCard
      eyebrow="AI Safety Command Center"
      title="Daily safety briefing"
      description="Rules-first lookahead for today and tomorrow. Recommendations require human review where risk, readiness, or critical controls demand it."
      aside={<StatusBadge label={briefing?.confidence ? `${briefing.confidence} confidence` : "Loading"} tone={briefing?.confidence === "high" ? "success" : "warning"} />}
    >
      {briefing?.stopWorkReviewRecommended || briefing?.escalationRequired ? (
        <InlineMessage tone="error">
          Human review required for critical or high-consequence signals. The AI Engine recommends verification and possible stop-work evaluation; it does not release work or declare compliance.
        </InlineMessage>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          eyebrow="Highest risk"
          title={topWork?.riskLevel ?? "None ranked"}
          value={topWork ? String(topWork.riskScore) : "-"}
          detail={topWork ? topWork.title : loading ? "Loading briefing." : "Review missing data before treating the day as low risk."}
          tone={topWork?.riskLevel === "critical" || topWork?.riskLevel === "high" ? "attention" : "panel"}
        />
        <MetricTile eyebrow="Today" title="High-risk work" value={String(highRiskToday.length)} detail="Ranked work starting today." />
        <MetricTile eyebrow="Tomorrow" title="Predicted risk" value={String(highRiskTomorrow.length)} detail="Lookahead items that need pre-start review." />
        <MetricTile
          eyebrow="Approval"
          title="Review required"
          value={String(approvalState?.reviewRequiredCount ?? 0)}
          detail="Human review, assignment, or field verification needed."
          tone={(approvalState?.reviewRequiredCount ?? 0) > 0 ? "attention" : "panel"}
        />
      </div>

      <div className="rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Predicted Workface Conflicts</p>
            <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">
              {predictiveRisk?.aiSafetyConflictMap.summary ?? "Conflict review appears after the predictive risk model loads."}
            </p>
          </div>
          <StatusBadge
            label={`${predictiveRisk?.aiSafetyConflictMap.highConflictCount ?? 0} high/critical`}
            tone={(predictiveRisk?.aiSafetyConflictMap.criticalConflictCount ?? 0) > 0 ? "error" : conflicts.length > 0 ? "warning" : "success"}
          />
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={conflict.riskLevel} tone={conflict.riskLevel === "critical" || conflict.riskLevel === "high" ? "error" : "warning"} />
                <StatusBadge label={conflict.type.replace(/_/g, " ")} tone="info" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">{conflict.confidence} confidence</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{conflict.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{conflict.recommendedAction}</p>
              {conflict.humanApprovalRequired ? (
                <p className="mt-2 text-xs font-bold text-[var(--semantic-danger)]">
                  {conflict.humanApprovalReason ?? "Human review required before work proceeds."}
                </p>
              ) : null}
              {conflict.missingInformation.length > 0 ? (
                <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                  Missing information: {conflict.missingInformation.slice(0, 2).join("; ")}
                </p>
              ) : null}
            </div>
          ))}
          {!loading && conflicts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)] xl:col-span-2">
              No predicted workface conflicts were detected from the loaded data.
            </p>
          ) : null}
        </div>
      </div>

      {actionQueue ? (
        <div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Today&apos;s AI Safety Actions</p>
            <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">{actionQueue.headline}</p>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={`${actionQueue.approvalRequiredCount} review required`}
                tone={actionQueue.approvalRequiredCount > 0 ? "error" : "success"}
              />
              <button
                type="button"
                className={appButtonSecondaryClassName}
                onClick={onSyncActions}
                disabled={syncingActions || actionQueue.items.length === 0}
              >
                {syncingActions ? "Syncing..." : "Create/Sync AI Actions"}
              </button>
            </div>
          </div>
          {syncMessage ? (
            <p className="mt-2 rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-xs leading-5 text-[var(--app-text)]">
              {syncMessage}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {actionQueue.items.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={item.priority} tone={item.priority === "critical" || item.priority === "high" ? "error" : "warning"} />
                  <StatusBadge label={item.approvalState.replace(/_/g, " ")} tone={item.humanApprovalRequired ? "error" : "info"} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    {item.ownerRole.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</p>
                {item.category === "workface_conflict_review" ? (
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--semantic-danger)]">
                    Predicted workface conflict
                  </p>
                ) : null}
                <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.recommendedControl}</p>
                {item.humanApprovalRequired ? (
                  <p className="mt-2 text-xs font-bold text-[var(--semantic-danger)]">
                    {item.humanApprovalReason ?? "Human review required before work proceeds."}
                  </p>
                ) : null}
                {syncMessage ? (
                  <Link href="/analytics/predictive-model" className="mt-2 inline-flex text-xs font-bold text-[var(--app-accent-primary)]">
                    Open persisted recommendation workflow
                  </Link>
                ) : null}
                {item.missingInformation.length > 0 ? (
                  <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    Missing information: {item.missingInformation.slice(0, 2).join("; ")}
                  </p>
                ) : null}
                {item.feedbackInfluence.length > 0 ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-800">
                    Feedback influenced this recommendation: {item.feedbackInfluence.slice(0, 2).join("; ")}
                  </p>
                ) : null}
              </div>
            ))}
            {!loading && actionQueue.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)] xl:col-span-2">
                No AI safety actions were generated from the loaded briefing.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Morning briefing</p>
          <div className="mt-3 space-y-2">
            {morningBriefing.map((line) => (
              <p key={line} className="rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm leading-6 text-[var(--app-text)]">
                {line}
              </p>
            ))}
            {!loading && morningBriefing.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                No daily briefing is available yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Supervisor actions</p>
          <div className="mt-3 space-y-2">
            {supervisorActions.map((action) => (
              <p key={action} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm leading-6 text-[var(--app-text)]">
                {action}
              </p>
            ))}
            {!loading && supervisorActions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                Supervisor actions appear when the engine ranks work, blockers, or controls.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top control</p>
          {topControl && topWork ? (
            <div className="mt-3 rounded-xl border border-[var(--app-border-strong)] bg-white/90 px-3 py-3 shadow-[var(--app-shadow-soft)]">
              <StatusBadge label={topControl.basis.replace(/_/g, " ")} tone="info" />
              <p className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{topControl.title}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{topControl.recommendedAction}</p>
              {topControl.humanApprovalRequired ? (
                <p className="mt-2 text-xs font-bold text-[var(--semantic-danger)]">Human review required before work proceeds.</p>
              ) : null}
              <AiFeedbackControls
                surface="ai-engine.daily-command-center"
                sourceId={`${topWork.id}-${topControl.hazardFamily}`}
                mode="recommendation"
                metadata={{
                  workflowStep: "daily_safety_command_center",
                  hazardFamily: topControl.hazardFamily,
                  basis: topControl.basis,
                  jobsiteId: topWork.jobsiteId,
                }}
                className="mt-3"
              />
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
              Top control appears when high-risk work is ranked.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Missing permits", rows: missingPermits },
          { label: "Expired or missing training", rows: trainingGaps },
          { label: "Open corrective actions", rows: openActions },
          { label: "Weak JSAs", rows: weakJsas },
          { label: "Weather-related risks", rows: weatherRisks },
          { label: "Repeated observations", rows: repeatedObservations },
        ].map((group) => (
          <div key={group.label} className="rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">{group.label}</p>
            <div className="mt-2 space-y-2">
              {group.rows.map((row) => (
                <p key={row.id} className="text-xs leading-5 text-[var(--app-text)]">
                  <span className="font-semibold text-[var(--app-text-strong)]">{row.label}:</span> {row.detail}
                </p>
              ))}
              {group.rows.length === 0 ? <p className="text-xs leading-5 text-[var(--app-muted)]">No loaded blocker in this category.</p> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Feedback influence</p>
          <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{feedbackInfluence?.summary ?? "Feedback influence appears after recommendations are acted on."}</p>
          <p className="mt-2 text-xs font-bold text-[var(--app-muted)]">Confidence: {feedbackInfluence?.confidenceAdjustment ?? "neutral"}</p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Memory influence</p>
          <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{memoryInfluence?.summary ?? "Company and jobsite memory was not loaded yet."}</p>
          <p className="mt-2 text-xs font-bold text-[var(--app-muted)]">{memoryInfluence?.memoryItemCount ?? 0} memory items loaded</p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Calibration</p>
          <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{calibrationSummary?.summary ?? "Calibration starts once later field outcomes are available."}</p>
          <p className="mt-2 text-xs font-bold text-[var(--app-muted)]">
            {calibrationSummary?.predictedHighRiskCount ?? 0} high-risk predictions tracked
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function AiSafetyCalibrationPanel({
  calibration,
  trendSummary,
  generatingReport,
  reportMessage,
  onGenerateReport,
}: {
  calibration: AnalyticsSummary["aiSafetyCalibration"] | undefined;
  trendSummary: AnalyticsSummary["aiExecutiveTrendSummary"] | undefined;
  generatingReport: "weekly" | "monthly" | null;
  reportMessage: string;
  onGenerateReport: (period: "weekly" | "monthly") => void;
}) {
  const actionOutcomes = calibration?.actionOutcomes;
  const summary = calibration?.summary;
  const acceptance = actionOutcomes?.recommendationAcceptanceRate;
  const topHazards = calibration?.trendSummary.topHazards ?? [];
  const topJobsites = calibration?.trendSummary.topJobsites ?? [];
  const topTrades = calibration?.trendSummary.topTrades ?? [];
  const missedSignals = calibration?.predictionOutcomes.missedHighRiskEvents ?? [];
  const insufficientData = calibration?.predictionOutcomes.insufficientData ?? [];
  const recommendedActions = trendSummary?.recommendedLeadershipActions ?? [];

  return (
    <SectionCard
      eyebrow="AI Engine Calibration"
      title="Executive safety signal review"
      description="Company-facing calibration compares AI safety actions with later field outcomes. Treat this as evidence for leadership review, not proof of causation."
      aside={<StatusBadge label={summary?.confidence ? `${summary.confidence} confidence` : "Awaiting data"} tone={summary?.confidence === "high" ? "success" : "warning"} />}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          eyebrow="Predicted risk"
          title="High / critical"
          value={String(summary?.predictedHighRiskCount ?? 0)}
          detail={`${summary?.predictedCriticalCount ?? 0} critical action${summary?.predictedCriticalCount === 1 ? "" : "s"} in the window.`}
          tone={(summary?.predictedCriticalCount ?? 0) > 0 ? "attention" : "panel"}
        />
        <MetricTile
          eyebrow="Action outcomes"
          title="Accepted rate"
          value={acceptance == null ? "-" : `${acceptance}%`}
          detail={`${actionOutcomes?.acceptedCount ?? 0} accepted, ${actionOutcomes?.dismissedCount ?? 0} dismissed.`}
        />
        <MetricTile
          eyebrow="Field follow-through"
          title="Controls used"
          value={String(actionOutcomes?.fieldUsedControlCount ?? 0)}
          detail={`${actionOutcomes?.resolvedCount ?? 0} resolved action${actionOutcomes?.resolvedCount === 1 ? "" : "s"}.`}
        />
        <MetricTile
          eyebrow="Risk reduction"
          title="Points"
          value={String(actionOutcomes?.riskReductionPoints ?? 0)}
          detail="Credit only after field-used or resolved workflow states."
        />
        <MetricTile
          eyebrow="Review pressure"
          title="Overdue"
          value={String(actionOutcomes?.overdueCount ?? 0)}
          detail={`${summary?.missedHighRiskEventCount ?? 0} missed-risk candidate${summary?.missedHighRiskEventCount === 1 ? "" : "s"}.`}
          tone={(actionOutcomes?.overdueCount ?? 0) > 0 || (summary?.missedHighRiskEventCount ?? 0) > 0 ? "attention" : "panel"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Executive summary</p>
          <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-white/90 px-4 py-3">
            <p className="text-sm leading-6 text-[var(--app-text)]">
              {calibration?.executiveSummary ?? "Calibration will appear after AI safety actions and later field outcomes are available."}
            </p>
            {(trendSummary?.bullets ?? []).length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
                {trendSummary?.bullets.slice(0, 4).map((bullet) => (
                  <li key={bullet} className="rounded-lg bg-[var(--app-panel-soft)] px-3 py-2">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Recurring signals</p>
          <div className="mt-3 grid gap-2">
            {topHazards.slice(0, 3).map((row) => (
              <div key={`hazard-${row.label}`} className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm">
                <span className="font-medium text-[var(--app-text-strong)]">{row.label}</span>
                <strong className="text-[var(--semantic-warning)]">{row.count}</strong>
              </div>
            ))}
            {topJobsites.slice(0, 2).map((row) => (
              <div key={`jobsite-${row.jobsiteId}`} className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm">
                <span className="font-medium text-[var(--app-text-strong)]">{formatCategory(row.jobsiteId)}</span>
                <strong className="text-[var(--app-accent-primary)]">{row.count}</strong>
              </div>
            ))}
            {topTrades.slice(0, 2).map((row) => (
              <div key={`trade-${row.trade}`} className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm">
                <span className="font-medium text-[var(--app-text-strong)]">{formatCategory(row.trade)}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
            {!calibration || (topHazards.length === 0 && topJobsites.length === 0 && topTrades.length === 0) ? (
              <p className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                Recurring hazard, jobsite, and trade signals appear after AI safety actions are synced.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Leadership actions</p>
          <div className="mt-3 space-y-2">
            {recommendedActions.slice(0, 4).map((action) => (
              <p key={action} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm leading-6 text-[var(--app-text)]">
                {action}
              </p>
            ))}
            {recommendedActions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                Recommended leadership actions appear when overdue, missed-risk, or follow-up-needed signals are present.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {(missedSignals.length > 0 || insufficientData.length > 0) ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Missed or follow-up signals</p>
            <div className="mt-3 space-y-2">
              {missedSignals.slice(0, 3).map((item) => (
                <p key={item.id} className="rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm leading-6 text-[var(--app-text)]">
                  {item.title}: {item.reason}
                </p>
              ))}
              {missedSignals.length === 0 ? <p className="text-sm text-[var(--app-muted)]">No missed-risk candidates in this window.</p> : null}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Insufficient data</p>
            <div className="mt-3 space-y-2">
              {insufficientData.slice(0, 3).map((item) => (
                <p key={item.id} className="rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm leading-6 text-[var(--app-text)]">
                  {item.reason}
                </p>
              ))}
              {insufficientData.length === 0 ? <p className="text-sm text-[var(--app-muted)]">No insufficient-data warnings in this window.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-white/90 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Generate AI Executive Summary</p>
          <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">Creates a report-ready weekly or monthly summary from calibration, outcomes, and AI action history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={appButtonSecondaryClassName} disabled={Boolean(generatingReport)} onClick={() => onGenerateReport("weekly")}>
            {generatingReport === "weekly" ? "Generating..." : "Weekly summary"}
          </button>
          <button type="button" className={appButtonSecondaryClassName} disabled={Boolean(generatingReport)} onClick={() => onGenerateReport("monthly")}>
            {generatingReport === "monthly" ? "Generating..." : "Monthly summary"}
          </button>
        </div>
      </div>
      {reportMessage ? (
        <p className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs leading-5 text-[var(--app-text)]">
          {reportMessage}
        </p>
      ) : null}
    </SectionCard>
  );
}

export function CommandCenterWorkspace() {
  const [days, setDays] = useState(90);
  const [predictiveJobsiteId, setPredictiveJobsiteId] = useState("");
  const [insightsSection, setInsightsSection] = useState<InsightsSection>("recommendations");
  const { value: rawHubTab, setValue: setHubTabValue } = useUrlTabState(
    "tab",
    COMMAND_CENTER_URL_TABS,
    "overview"
  );
  const hubTab = (rawHubTab === "risk" ? "risk-memory" : rawHubTab) as HubTab;

  const [loading, setLoading] = useState(true);
  const [predictiveLoading, setPredictiveLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummaryPayload | null>(null);
  const [predictiveRisk, setPredictiveRisk] = useState<PredictiveRiskPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [analyticsErr, setAnalyticsErr] = useState("");
  const [predictiveErr, setPredictiveErr] = useState("");
  const [workspaceErr, setWorkspaceErr] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [riskRecWorking, setRiskRecWorking] = useState(false);
  const [riskSnapWorking, setRiskSnapWorking] = useState(false);
  const [aiActionSyncWorking, setAiActionSyncWorking] = useState(false);
  const [aiActionSyncMessage, setAiActionSyncMessage] = useState("");
  const [aiExecutiveReportWorking, setAiExecutiveReportWorking] = useState<"weekly" | "monthly" | null>(null);
  const [aiExecutiveReportMessage, setAiExecutiveReportMessage] = useState("");
  const [dismissingRecId, setDismissingRecId] = useState<string | null>(null);
  const [siWorkloadSummary, setSiWorkloadSummary] = useState<SafetyDashboardPayload["summary"] | null>(null);
  const [builderAccess, setBuilderAccess] = useState<BuilderAccess>({ csep: false, peshep: false });
  const [adoption, setAdoption] = useState<CommandCenterAdoptionPayload>({
    companyProfile: null,
    companyUsers: [],
    companyInvites: [],
    documents: [],
    onboardingState: emptyOnboardingState(),
  });

  useEffect(() => {
    if (rawHubTab === "risk") setHubTabValue("risk-memory");
  }, [rawHubTab, setHubTabValue]);

  const load = useCallback(async () => {
    setLoading(true);
    setPredictiveLoading(true);
    setAnalyticsErr("");
    setPredictiveErr("");
    setWorkspaceErr("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAnalyticsErr("Sign in to load Command Center.");
        setWorkspace(null);
        setAnalytics(null);
        setPredictiveRisk(null);
        setSiWorkloadSummary(null);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const predictiveParams = new URLSearchParams({ days: String(days) });
      if (predictiveJobsiteId) predictiveParams.set("jobsiteId", predictiveJobsiteId);
      const [
        analyticsResponse,
        workspaceResponse,
        siWorkloadResponse,
        predictiveResponse,
        meResponse,
        usersResponse,
        documentsResponse,
        onboardingResponse,
      ] = await Promise.all([
        fetchWithTimeoutSafe(`/api/company/analytics/summary?days=${days}`, { headers }, 20000, "Analytics"),
        fetchWithTimeoutSafe("/api/company/workspace/summary", { headers }, 20000, "Workspace"),
        fetchWithTimeoutSafe("/api/company/safety-intelligence/analytics/summary", { headers }, 15000, "Safety Intelligence workload"),
        fetchWithTimeoutSafe(`/api/company/predictive-risk?${predictiveParams.toString()}`, { headers }, 20000, "Predictive risk"),
        fetchWithTimeoutSafe("/api/auth/me", { headers }, 15000, "Current user"),
        fetchWithTimeoutSafe("/api/company/users", { headers }, 15000, "Company users"),
        fetchWithTimeoutSafe("/api/workspace/documents", { headers }, 15000, "Workspace documents"),
        fetchWithTimeoutSafe(
          "/api/onboarding/state",
          {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ markCommandCenterViewed: true }),
          },
          15000,
          "Onboarding state"
        ),
      ]);

      const analyticsJson = (await analyticsResponse.json().catch(() => null)) as AnalyticsSummaryPayload | null;
      const workspaceJson = (await workspaceResponse.json().catch(() => null)) as WorkspaceSummary | null;
      const siWorkloadJson = (await siWorkloadResponse.json().catch(() => null)) as {
        summary?: SafetyDashboardPayload["summary"];
        error?: string;
      } | null;
      const predictiveJson = (await predictiveResponse.json().catch(() => null)) as
        | (PredictiveRiskPayload & { error?: string })
        | null;
      const meJson = (await meResponse.json().catch(() => null)) as
        | {
            user?: {
              companyProfile?: CommandCenterAdoptionPayload["companyProfile"];
              permissionMap?: PermissionMap;
              role?: string;
              workspaceProduct?: WorkspaceProduct;
            };
          }
        | null;
      const usersJson = (await usersResponse.json().catch(() => null)) as
        | {
            users?: CommandCenterAdoptionPayload["companyUsers"];
            invites?: CommandCenterAdoptionPayload["companyInvites"];
          }
        | null;
      const documentsJson = (await documentsResponse.json().catch(() => null)) as
        | { documents?: CommandCenterAdoptionPayload["documents"] }
        | null;
      const onboardingJson = (await onboardingResponse.json().catch(() => null)) as OnboardingState | null;

      if (!analyticsResponse.ok) {
        setAnalyticsErr(analyticsJson?.error || "Could not load analytics summary.");
        setAnalytics(null);
      } else {
        setAnalytics(analyticsJson);
      }

      if (!workspaceResponse.ok) {
        setWorkspaceErr(workspaceJson?.error || "Could not load workspace summary.");
        setWorkspace(null);
      } else {
        setWorkspace(workspaceJson);
      }

      if (!siWorkloadResponse.ok) {
        setSiWorkloadSummary(null);
      } else {
        setSiWorkloadSummary(siWorkloadJson?.summary ?? null);
      }

      if (!predictiveResponse.ok) {
        setPredictiveErr(predictiveJson?.error || "Could not load predictive risk.");
        setPredictiveRisk(null);
      } else {
        setPredictiveRisk(predictiveJson);
      }

      if (meResponse.ok) {
        const role = meJson?.user?.role ?? "";
        const permissionMap = meJson?.user?.permissionMap ?? null;
        const workspaceProduct = meJson?.user?.workspaceProduct === "csep" ? "csep" : "full";
        setBuilderAccess({
          csep: canAccessCompanyWorkspaceHref("/csep", role, permissionMap),
          peshep:
            workspaceProduct !== "csep" &&
            canAccessCompanyWorkspaceHref("/peshep", role, permissionMap),
        });
      } else {
        setBuilderAccess({ csep: false, peshep: false });
      }

      setAdoption({
        companyProfile: meResponse.ok ? meJson?.user?.companyProfile ?? null : null,
        companyUsers: usersResponse.ok ? usersJson?.users ?? [] : [],
        companyInvites: usersResponse.ok ? usersJson?.invites ?? [] : [],
        documents: documentsResponse.ok ? documentsJson?.documents ?? [] : [],
        onboardingState: onboardingResponse.ok && onboardingJson ? onboardingJson : emptyOnboardingState(),
      });

      setLastLoadedAt(new Date());
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Failed to load Command Center.");
    } finally {
      setLoading(false);
      setPredictiveLoading(false);
    }
  }, [days, predictiveJobsiteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openWork = useMemo(() => summarizeOpenWork(workspace), [workspace]);
  const notices = useMemo(
    () =>
      buildCommandCenterNotices({
        warning: analytics?.warning ?? null,
        analyticsError: analyticsErr,
        workspaceError: workspaceErr,
      }),
    [analytics?.warning, analyticsErr, workspaceErr]
  );

  const summary = analytics?.summary;
  const risk = summary?.riskMemory;
  const riskTrend = summary?.riskMemoryTrend;
  const companyDashboard = summary?.companyDashboard;
  const benchmarking = summary?.benchmarking;
  const injuryAnalytics = summary?.injuryAnalytics;
  const aiSafetyCalibration = summary?.aiSafetyCalibration;
  const aiExecutiveTrendSummary = summary?.aiExecutiveTrendSummary;
  const recommendations = summary?.riskMemoryRecommendations ?? [];
  const workflowRails = useMemo(() => buildSafetyManagerWorkflowRails(openWork), [openWork]);
  const band = risk?.aggregatedWithBaseline?.band ?? risk?.aggregated?.band ?? "-";
  const score = risk?.aggregatedWithBaseline?.score ?? risk?.aggregated?.score ?? null;
  const predictiveSummary = predictiveRisk?.summary;
  const adoptionChecklist = useMemo(
    () =>
      buildAdoptionChecklist({
        companyProfile: adoption.companyProfile,
        companyUsers: adoption.companyUsers,
        companyInvites: adoption.companyInvites,
        jobsites: (workspace?.jobsites ?? []) as Array<{ status?: string | null }>,
        documents: adoption.documents,
        commandCenterViewed:
          adoption.onboardingState.completedSteps.includes("command_center") ||
          Boolean(adoption.onboardingState.lastSeenCommandCenterAt),
      }),
    [adoption, workspace?.jobsites]
  );
  const documentBuilderLaunches = [
    builderAccess.csep
      ? {
          href: "/csep",
          title: "CSEP builder",
          description: "Create a contractor safety plan package.",
          label: "Build CSEP",
        }
      : null,
    builderAccess.peshep
      ? {
          href: "/peshep",
          title: "PESHEP builder",
          description: "Create a project environmental, safety, and health plan package.",
          label: "Build PESHEP",
        }
      : null,
  ].filter((item): item is { href: string; title: string; description: string; label: string } => item != null);

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Missing auth token.");
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function refreshRiskRecommendations(mode: "rules" | "both") {
    setRiskRecWorking(true);
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const timeoutMs = mode === "both" ? 45000 : 20000;
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/recommendations/generate",
        { method: "POST", headers, body: JSON.stringify({ days, mode }) },
        timeoutMs,
        "Risk recommendations"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not generate recommendations.");
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Recommendation refresh failed.");
    } finally {
      setRiskRecWorking(false);
    }
  }

  async function saveRiskMemorySnapshot() {
    setRiskSnapWorking(true);
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/snapshot",
        { method: "POST", headers, body: JSON.stringify({ days }) },
        20000,
        "Risk memory snapshot"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not save snapshot.");
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Snapshot save failed.");
    } finally {
      setRiskSnapWorking(false);
    }
  }

  async function syncAiSafetyActions() {
    setAiActionSyncWorking(true);
    setAiActionSyncMessage("");
    setPredictiveErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        "/api/company/ai/safety-action-queue/sync",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            days,
            ...(predictiveJobsiteId ? { jobsiteId: predictiveJobsiteId } : {}),
          }),
        },
        30000,
        "AI safety action sync"
      );
      const data = (await res.json().catch(() => null)) as
        | { error?: string; insertedCount?: number; skippedDuplicateCount?: number; existingActionCount?: number }
        | null;
      if (!res.ok) throw new Error(data?.error || "Could not sync AI safety actions.");
      setAiActionSyncMessage(
        `${data?.insertedCount ?? 0} action${data?.insertedCount === 1 ? "" : "s"} created; ${data?.skippedDuplicateCount ?? 0} duplicate${data?.skippedDuplicateCount === 1 ? "" : "s"} skipped.`
      );
      await load();
    } catch (error) {
      setPredictiveErr(error instanceof Error ? error.message : "AI safety action sync failed.");
    } finally {
      setAiActionSyncWorking(false);
    }
  }

  async function generateAiExecutiveReport(period: "weekly" | "monthly") {
    setAiExecutiveReportWorking(period);
    setAiExecutiveReportMessage("");
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const reportType = period === "weekly" ? "ai_engine_weekly_summary" : "ai_engine_monthly_summary";
      const res = await fetchWithTimeoutSafe(
        "/api/company/reports",
        { method: "POST", headers, body: JSON.stringify({ reportType }) },
        30000,
        "AI executive summary"
      );
      const data = (await res.json().catch(() => null)) as { error?: string; report?: { title?: string | null } } | null;
      if (!res.ok) throw new Error(data?.error || "Could not generate AI executive summary.");
      setAiExecutiveReportMessage(`${data?.report?.title ?? "AI executive summary"} generated for leadership review.`);
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "AI executive summary generation failed.");
    } finally {
      setAiExecutiveReportWorking(null);
    }
  }

  async function dismissRiskRecommendation(id: string) {
    setDismissingRecId(id);
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        `/api/company/risk-memory/recommendations/${encodeURIComponent(id)}`,
        { method: "PATCH", headers, body: JSON.stringify({ dismissed: true }) },
        15000,
        "Dismiss recommendation"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not dismiss recommendation.");
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Dismiss failed.");
    } finally {
      setDismissingRecId(null);
    }
  }

  const overviewContent = (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Unified Operations"
        title="Insights and risk snapshot"
        description="One place for the signals safety leaders use first: current risk, open work, predictive pressure, recommendations, and Safety Intelligence activity."
        tone="attention"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile
            eyebrow="Current risk"
            title={band === "-" ? "Awaiting rollup" : band}
            value={score != null ? Number(score).toFixed(1) : "-"}
            detail={`${risk?.facetCount ?? 0} Risk Memory facets in ${risk?.windowDays ?? days} days.`}
            tone="attention"
          />
          <MetricTile
            eyebrow="Predictive risk"
            title="Avg score"
            value={metricValue(predictiveSummary?.averageRiskScore)}
            detail={`${predictiveSummary?.highRiskLocationCount ?? 0} high-risk location${predictiveSummary?.highRiskLocationCount === 1 ? "" : "s"}.`}
          />
          <MetricTile
            eyebrow="Recommendations"
            title="Active"
            value={String(recommendations.length)}
            detail="Stored smart or rules-based actions for leadership triage."
          />
          <MetricTile
            eyebrow="Open work"
            title="Issues"
            value={String(openWork.openObservations)}
            detail={`${openWork.overdueObservations} overdue and ${openWork.openIncidents} open incident${openWork.openIncidents === 1 ? "" : "s"}.`}
          />
          <MetricTile
            eyebrow="Safety Intel"
            title="Activity"
            value={String(siWorkloadSummary?.totals.aiReviews ?? 0)}
            detail={`${siWorkloadSummary?.totals.openConflicts ?? 0} open rule conflict${siWorkloadSummary?.totals.openConflicts === 1 ? "" : "s"}.`}
          />
        </div>
      </SectionCard>

      <DailySafetyCommandCenterPanel
        predictiveRisk={predictiveRisk}
        loading={predictiveLoading}
        syncingActions={aiActionSyncWorking}
        syncMessage={aiActionSyncMessage}
        onSyncActions={syncAiSafetyActions}
      />

      <AiSafetyCalibrationPanel
        calibration={aiSafetyCalibration}
        trendSummary={aiExecutiveTrendSummary}
        generatingReport={aiExecutiveReportWorking}
        reportMessage={aiExecutiveReportMessage}
        onGenerateReport={generateAiExecutiveReport}
      />

      <SectionCard
        eyebrow="Launch"
        title="Workspace launch checklist"
        description={`${adoptionChecklist.completedCount} of ${adoptionChecklist.totalCount} adoption milestones complete. Keep setup progress close to the operating hub.`}
        aside={<StatusBadge label={adoptionChecklist.nextItem ? `Next: ${adoptionChecklist.nextItem.label}` : "Launch complete"} tone={adoptionChecklist.nextItem ? "warning" : "success"} />}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {adoptionChecklist.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-2xl border border-[var(--app-border)] bg-white/90 px-4 py-4 shadow-[var(--app-shadow-soft)] transition hover:border-[var(--app-accent-border-28)]"
            >
              <StatusBadge label={item.complete ? "Done" : "Next"} tone={item.complete ? "success" : "warning"} />
              <p className="mt-3 text-sm font-semibold text-[var(--app-text-strong)]">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{item.note}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      {documentBuilderLaunches.length > 0 ? (
        <SectionCard
          eyebrow="Builders"
          title="Document builders"
          description="Start formal builder packages from the operating hub."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {documentBuilderLaunches.map((item) => (
              <LaunchCard
                key={item.href}
                href={item.href}
                title={item.title}
                description={item.description}
                label={item.label}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        eyebrow="Drill-downs"
        title="Deep analysis paths"
        description="The hub shows what matters first. These detailed pages remain available when you need more context."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LaunchCard href="/analytics" title="Safety analytics" description="Observation, incident, benchmarking, and Risk Memory detail." label="Open analytics" />
          <LaunchCard href="/analytics/predictive-model" title="Predictive model detail" description="Full predictive model surface with ranked locations and drivers." label="Open model" />
          <LaunchCard href="/analytics/safety-intelligence" title="Safety Intelligence activity" description="Review batches, conflicts, reviews, and generated output volume." label="Open activity" />
          <LaunchCard href="/safety-intelligence" title="Safety Intelligence workflow" description="Run intake, rules, conflicts, and document-generation workflows." label="Start workflow" />
        </div>
      </SectionCard>
    </div>
  );

  const riskMemoryContent = (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Risk Management"
        title="Risk Memory"
        description="Current company risk rollup, recurring scope/hazard patterns, hotspots, benchmark context, and snapshot controls."
        aside={<StatusBadge label={band === "-" ? "Awaiting rollup" : band} tone={rollupTone(band)} />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile eyebrow="Risk score" title={band === "-" ? "Awaiting rollup" : band} value={score != null ? Number(score).toFixed(1) : "-"} detail="Baseline-adjusted score when available." tone="attention" />
          <MetricTile eyebrow="Facet rows" title="Signals" value={metricValue(risk?.facetCount)} detail={`Selected window: ${risk?.windowDays ?? days} days.`} />
          <MetricTile eyebrow="Open CA hints" title="Corrective actions" value={metricValue(risk?.openCorrectiveFacetHints.openStyleStatuses)} detail="Open-style statuses feeding risk context." />
          <MetricTile eyebrow="Rollup confidence" title="Heuristic" value={risk?.derivedRollupConfidence != null ? `${Math.round(risk.derivedRollupConfidence * 100)}%` : "-"} detail="Based on signal depth and score strength." />
          <MetricTile eyebrow="Benchmark rate" title="Incident rate" value={benchmarking?.incidentRate != null ? benchmarking.incidentRate.toFixed(2) : "-"} detail="Per 200k exposure hours when configured." />
        </div>

        {!risk ? <InlineMessage tone="neutral">{getRiskMemoryEmptyMessage(loading)}</InlineMessage> : <RiskMemoryDetails risk={risk} trend={riskTrend} />}

        {benchmarking ? (
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-4 text-sm text-[var(--app-text)] shadow-[var(--app-shadow-soft)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Industry and trade benchmarks</p>
            <p className="mt-2">
              NAICS <span className="font-mono font-semibold text-[var(--app-text-strong)]">{benchmarking.industryCode ?? "-"}</span>
              {" / "}Industry ref. {benchmarking.industryInjuryRate ?? "-"}
              {" / "}Trade ref. {benchmarking.tradeInjuryRate ?? "-"}
              {" / "}Workspace rate {benchmarking.incidentRate != null ? benchmarking.incidentRate.toFixed(2) : "-"}
            </p>
          </div>
        ) : null}

        {injuryAnalytics ? (
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-4 text-sm text-[var(--app-text)] shadow-[var(--app-shadow-soft)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Injury analytic inputs</p>
            <p className="mt-2">
              Avg severity {injuryAnalytics.averageSeverityScore} (n={injuryAnalytics.severitySampleSize}) / SOR-to-injury ratio{" "}
              {injuryAnalytics.sorToInjuryRatio ?? "-"} / Observation-to-injury {injuryAnalytics.observationToInjuryConversionRate != null ? `${injuryAnalytics.observationToInjuryConversionRate}%` : "-"}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={riskSnapWorking || loading} onClick={() => void saveRiskMemorySnapshot()} className={`${appButtonPrimaryClassName} disabled:opacity-50`}>
            {riskSnapWorking ? "Saving..." : "Save today's rollup snapshot"}
          </button>
          <Link href="/settings/risk-memory" className={appButtonSecondaryClassName}>
            Configure Risk Memory
          </Link>
          <Link href="/analytics" className={appButtonQuietClassName}>
            Full analytics
          </Link>
        </div>
      </SectionCard>
    </div>
  );

  const predictiveContent = (
    <PredictiveModelView
      data={predictiveRisk}
      loading={predictiveLoading}
      error={predictiveErr}
      days={days}
      selectedJobsiteId={predictiveJobsiteId}
      onDaysChange={setDays}
      onJobsiteChange={setPredictiveJobsiteId}
      onRefresh={() => void load()}
    />
  );

  const insightsContent = (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Insights sections">
        {INSIGHTS_SECTIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInsightsSection(value)}
            className={[
              "rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition",
              insightsSection === value
                ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
                : "border border-[var(--app-border-strong)] bg-white/80 text-[var(--app-text-strong)] hover:bg-white",
            ].join(" ")}
          >
            {INSIGHTS_SECTION_LABELS[value]}
          </button>
        ))}
      </div>

      {insightsSection === "recommendations" ? (
        <SectionCard
          eyebrow="Recommended Next Step"
          title="Insights & Recommendations"
          description="Stored recommendations stay company-scoped. Generate rule-based or smart recommendations, then move directly into the action path."
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={riskRecWorking || loading} onClick={() => void refreshRiskRecommendations("rules")} className={`${appButtonSecondaryClassName} disabled:opacity-50`}>
                {riskRecWorking ? "Generating..." : "Rule-based"}
              </button>
              <button type="button" disabled={riskRecWorking || loading} onClick={() => void refreshRiskRecommendations("both")} className={`${appButtonPrimaryClassName} disabled:opacity-50`}>
                {riskRecWorking ? "Generating..." : "Smart + rules"}
              </button>
            </div>
          }
        >
          <RecommendationsList
            recommendations={recommendations}
            loading={loading || riskRecWorking}
            dismissingId={dismissingRecId}
            onDismiss={(id) => void dismissRiskRecommendation(id)}
          />
        </SectionCard>
      ) : null}

      {insightsSection === "safety-intelligence" ? (
        <SectionCard
          eyebrow="Safety Intelligence"
          title="Workflow activity"
          description="Company-scoped snapshot of Safety Intelligence volume so you can triage before opening lists or conflicts."
          aside={
            <Link href="/analytics/safety-intelligence" className={`${appButtonSecondaryClassName} whitespace-nowrap px-3 py-2 text-xs`}>
              Full activity view
            </Link>
          }
        >
          {siWorkloadSummary ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Pipeline batches</p>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.bucketRuns}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">AI-assisted reviews</p>
                  <ProvenanceBadge kind="ai" />
                </div>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.aiReviews}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Open rule conflicts</p>
                  <ProvenanceBadge kind="rules" />
                </div>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.openConflicts}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Documents generated</p>
                  <ProvenanceBadge kind="hybrid" />
                </div>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.generatedDocuments}</p>
              </div>
            </div>
          ) : (
            <InlineMessage tone="neutral">Workflow metrics are not available for this account yet, or your role does not include analytics access.</InlineMessage>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LaunchCard href="/safety-intelligence" title="Start workflow" description="Run intake, rules, conflicts, document generation, and review." label="Open workflow" />
            <LaunchCard href="/analytics/safety-intelligence" title="Activity detail" description="Inspect batches, reviews, conflicts, and generated documents." label="Open analytics" />
            <LaunchCard href="/reports" title="Reports" description="Review generated reports and document handoffs." label="Open reports" />
          </div>
        </SectionCard>
      ) : null}

      {insightsSection === "knowledge" ? (
        <SectionCard
          eyebrow="Supporting Context"
          title="Company Knowledge"
          description="Keep reusable company context close to the hub so assistants and downstream workflows can stay grounded in actual procedures."
        >
          <div className="grid gap-4 lg:grid-cols-[0.3fr_0.7fr]">
            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">What belongs here</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--app-text)]">
                <li>Company procedures and recurring site rules</li>
                <li>Lessons learned worth reusing across jobsites</li>
                <li>Uploaded references that intelligence workflows should retrieve later</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/safety-intelligence" className={appButtonQuietClassName}>
                  Open workflow
                </Link>
                <Link href="/analytics" className={appButtonSecondaryClassName}>
                  Open analytics
                </Link>
              </div>
            </div>
            <CompanyMemoryBankPanel />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );

  const openWorkContent = (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Workflow Rails"
        title="Core operator paths"
        description="Move from signal to action without hunting through separate modules."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowRails.map((rail) => (
            <ActionTile
              key={rail.title}
              eyebrow={rail.tone === "warning" ? "Needs attention" : "Guided flow"}
              title={rail.title}
              description={rail.description}
              href={rail.href}
              actionLabel={rail.actionLabel}
              tone={rail.tone === "warning" ? "attention" : rail.tone === "info" ? "elevated" : "panel"}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Work Area"
        title="Open Work"
        description="Use the current workload picture to decide where human follow-up is needed before or after smart-generated outputs."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open issues" value={openWork.openObservations} href="/field-id-exchange" hint="Corrective actions not verified closed" />
          <StatTile label="Overdue issues" value={openWork.overdueObservations} href="/field-id-exchange" hint="Open items past due" />
          <StatTile label="Open incidents" value={openWork.openIncidents} href="/incidents" />
          <StatTile label="Active permits" value={openWork.activePermits} href="/permits" />
          <StatTile label="Stop work" value={openWork.stopWorkPermits} href="/permits" hint="Requested or active" />
          <StatTile label="JSAs in flight" value={openWork.openJsas} href="/jsa" />
          <StatTile label="Reports draft" value={openWork.openReports} href="/reports" />
          <StatTile label="Active jobsites" value={companyDashboard?.totalActiveJobsites ?? "-"} href="/jobsites" />
        </div>
      </SectionCard>

      <InductionReadinessCard />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Command Center"
        title="Unified risk and insights hub"
        description="Review Risk Memory, predictive signals, recommendations, Safety Intelligence activity, and open work from one company-scoped operating area."
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2">
              {([30, 90] as const).map((windowDays) => (
                <button
                  key={windowDays}
                  type="button"
                  onClick={() => setDays(windowDays)}
                  className={[
                    "rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    days === windowDays
                      ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
                      : "border border-[var(--app-border-strong)] bg-white/80 text-[var(--app-text-strong)] hover:bg-white",
                  ].join(" ")}
                >
                  {windowDays}d window
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void load()} disabled={loading || predictiveLoading} className={`${appButtonPrimaryClassName} disabled:opacity-50`}>
              {loading || predictiveLoading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      {notices.map((notice) => (
        <InlineMessage key={`${notice.tone}-${notice.message}`} tone={notice.tone}>
          {notice.message}
        </InlineMessage>
      ))}
      {predictiveErr ? <InlineMessage tone="warning">{predictiveErr}</InlineMessage> : null}

      {lastLoadedAt ? (
        <p className="text-xs text-[var(--app-text)]">
          Last updated {lastLoadedAt.toLocaleString()}. Risk, predictive, insight, and open-work views use the selected window.
        </p>
      ) : null}

      {summary?.leadershipTrust ? <TrustSummaryPanel trust={summary.leadershipTrust} compact /> : null}

      <AppTabBar
        value={hubTab}
        onValueChange={(next) => setHubTabValue(next)}
        items={[
          { value: "overview", label: "Overview", content: overviewContent },
          { value: "risk-memory", label: "Risk Memory", content: riskMemoryContent },
          { value: "predictive-risk", label: "Predictive Risk", content: predictiveContent },
          { value: "insights", label: "Insights & Recommendations", content: insightsContent },
          { value: "open-work", label: "Open Work", content: openWorkContent },
        ]}
      />

      {loading ? <InlineMessage tone="neutral">Refreshing Command Center data...</InlineMessage> : null}
    </div>
  );
}
