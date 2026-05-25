import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import { TrustSummaryPanel } from "@/components/leadership/TrustSummaryPanel";
import type { ExplainableRecommendation } from "@/lib/leadershipTrust";
import { AiFeedbackControls } from "@/components/ai/AiFeedbackControls";

const DAY_OPTIONS = [7, 30, 90] as const;

function toneForScore(score: number) {
  if (score >= 75) return "text-red-600";
  if (score >= 55) return "text-orange-600";
  if (score >= 35) return "text-amber-600";
  return "text-emerald-600";
}

function impactClass(impact: string) {
  if (impact === "High impact") return "border-red-200 bg-red-50 text-red-700";
  if (impact === "Medium impact") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function behaviorTone(level?: string) {
  if (level === "Critical") return "text-red-700";
  if (level === "High") return "text-red-600";
  if (level === "Elevated") return "text-orange-600";
  if (level === "Moderate") return "text-amber-600";
  return "text-emerald-600";
}

function safetyLevelTone(level?: string) {
  if (level === "critical") return "text-red-700";
  if (level === "high") return "text-red-600";
  if (level === "moderate") return "text-amber-600";
  return "text-emerald-600";
}

function safetyBadgeClass(level?: string) {
  if (level === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (level === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (level === "moderate" || level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function confidenceBadgeClass(confidence?: string) {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function recommendationStatusTone(status?: string) {
  if (status === "field_used" || status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "accepted" || status === "assigned") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "dismissed") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function priorityTone(priority?: string) {
  if (priority === "critical") return "text-red-700";
  if (priority === "high") return "text-orange-700";
  if (priority === "low") return "text-emerald-700";
  return "text-amber-700";
}

function actionTypeLabel(actionType?: string) {
  if (actionType === "request_documentation") return "Document";
  if (actionType === "request_inspection") return "Inspection request";
  if (actionType === "create_corrective_action") return "Corrective action";
  if (actionType === "request_permit") return "Permit request";
  if (actionType === "accountability_review") return "Accountability review";
  if (actionType === "stop_work_review") return "Stop-work review";
  if (actionType === "mark_field_used") return "Field used";
  if (actionType === "resolve") return "Resolve";
  if (actionType === "dismiss") return "Dismiss";
  return "Assign";
}

function mitigationLabel(state?: string) {
  if (state === "documentation_requested") return "Documentation requested";
  if (state === "inspection_requested") return "Inspection requested";
  if (state === "linked_action_created") return "Linked action created";
  if (state === "evidence_uploaded") return "Evidence uploaded";
  if (state === "field_verified") return "Field verified";
  if (state === "resolved") return "Resolved";
  if (state === "dismissed") return "Dismissed";
  if (state === "assigned") return "Assigned";
  return "No verified mitigation yet";
}

function TrendChart({ points }: { points: PredictiveRiskPayload["trend"] }) {
  const safe = points.length > 0 ? points : [{ label: "Now", riskScore: 0 }];
  const width = 520;
  const height = 170;
  const pad = 22;
  const step = safe.length > 1 ? (width - pad * 2) / (safe.length - 1) : 0;
  const coords = safe.map((point, idx) => {
    const x = pad + idx * step;
    const y = height - pad - (Math.max(0, Math.min(100, point.riskScore)) / 100) * (height - pad * 2);
    return { x, y, ...point };
  });
  const path = coords.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${coords.at(-1)?.x ?? pad} ${height - pad} L ${pad} ${height - pad} Z`;

  return (
    <div className="h-full min-h-[220px] rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[var(--app-text-strong)]">Risk score over time</h2>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            Average predicted risk across visible locations. Each point is capped at 100.
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-[var(--app-accent-primary)]" aria-hidden />
      </div>
      <svg className="mt-3 h-[170px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Risk trend chart">
        <path d={area} fill="rgba(37,99,235,0.12)" />
        <path d={path} fill="none" stroke="rgb(37,99,235)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p) => (
          <circle key={`${p.label}-${p.x}`} cx={p.x} cy={p.y} r="4" fill="white" stroke="rgb(37,99,235)" strokeWidth="2" />
        ))}
        {coords.map((p, idx) =>
          idx % Math.max(1, Math.ceil(coords.length / 4)) === 0 || idx === coords.length - 1 ? (
            <text key={`label-${p.label}`} x={p.x} y={height - 4} textAnchor="middle" className="fill-slate-500 text-[10px]">
              {p.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  explanation,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  explanation?: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</p>
      <p className={`mt-2 font-app-display text-3xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--app-muted)]">{detail}</p>
      {explanation ? <p className="mt-3 border-t border-[var(--app-border)] pt-3 text-xs leading-5 text-[var(--app-text)]">{explanation}</p> : null}
    </div>
  );
}

function ModelExplanationPanel({
  data,
  days,
}: {
  data: PredictiveRiskPayload | null;
  days: number;
}) {
  const windowDays = data?.filters.days ?? days;
  const signalCount = data?.summary.riskSignalCount ?? 0;
  const sources = data?.leadershipTrust?.sourceCoverage ?? [];
  const activeSources = sources.filter((source) => source.status === "connected").length;
  const sourceTotal = sources.length;
  const confidenceLabel = data?.model.confidenceLabel ?? "Pending";
  const confidencePercent = data?.summary.confidencePercent ?? 0;
  const topDriver = data?.drivers[0];
  const driverLine = topDriver
    ? `${topDriver.label} is the largest driver right now, representing ${topDriver.percent}% of active driver signals in this window.`
    : "Driver percentages appear after the selected window has active risk categories.";
  const coverageLine =
    sourceTotal > 0
      ? `${activeSources} of ${sourceTotal} source groups have records in this view.`
      : "Source coverage appears after the model loads.";

  return (
    <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 text-sm text-[var(--app-text)]">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--app-accent-primary)]" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-muted)]">How these numbers work</p>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-[var(--app-text-strong)]">
            This view turns company safety signals from the last {windowDays} days into a ranked prevention list. The score runs from 0 to 100: lower is better, higher is worse. A score of 100 is the maximum displayed risk pressure, not a perfect score.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Score direction</p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                0 means no active risk signals in this window. 100 means the location hit the cap and should be reviewed first.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Formula inputs</p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                Points come from severity, urgency, open or overdue work, SIF potential, stop-work signals, and repeated patterns.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Trend direction</p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                Positive trend means risk pressure is increasing. Negative trend means the location is improving compared with the prior half.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 text-xs leading-5 text-[var(--app-muted)] md:grid-cols-3">
            <p>
              {data ? (
                <>
                  <span className="font-bold text-[var(--app-text-strong)]">{signalCount}</span> risk signal{signalCount === 1 ? "" : "s"} {signalCount === 1 ? "is" : "are"} in the selected window.
                </>
              ) : (
                "Risk signal counts appear after the model loads."
              )}
            </p>
            <p>{coverageLine}</p>
            <p>
              Confidence is <span className="font-bold text-[var(--app-text-strong)]">{confidenceLabel.toLowerCase()}</span>
              {data ? ` at ${confidencePercent}%` : ""}; it reflects model coverage, not a safety grade.
            </p>
          </div>
          <details className="mt-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-[var(--app-text-strong)]">Methodology notes</summary>
            <div className="mt-3 grid gap-3 text-xs leading-5 text-[var(--app-text)] md:grid-cols-2">
              <p>
                Location scores add weight for severity, urgency, open items, overdue items, SIF potential, and stop-work signals. The display score is capped at 100 so extreme signal clusters stay readable.
              </p>
              <p>
                Trend compares the recent half of the selected window with the earlier half. A positive number is bad because the location is getting more active risk signal pressure.
              </p>
              <p>
                High risk locations are locations in view with a score of 70 or higher. The average risk score uses only locations with active risk, then falls back to the overall model score when none are active.
              </p>
              <p>{driverLine}</p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function SafetyAiAssessmentPanel({ data, loading }: { data: PredictiveRiskPayload | null; loading: boolean }) {
  const assessment = data?.safetyAiAssessment;
  const scoreExplanation = assessment?.scoreExplanation;
  const drivers = assessment?.topDrivers.slice(0, 3) ?? [];
  const recommendations = assessment?.recommendations.slice(0, 4) ?? [];
  const missingData = assessment?.missingData ?? [];
  const levelLabel = assessment?.level ?? "pending";
  const confidenceLabel = assessment?.confidence ?? "low";

  return (
    <section className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">Safety AI Assessment</p>
          <h2 className="mt-2 text-lg font-black text-[var(--app-text-strong)]">Explainable jobsite risk score</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--app-muted)]">
            Transparent rules score severity, likelihood, exposure, control gaps, and data-confidence concern so leaders can see why a potential risk was flagged.
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Score</p>
            <p className={`mt-1 font-app-display text-3xl font-black ${safetyLevelTone(assessment?.level)}`}>
              {loading ? "-" : assessment?.score ?? 0}
            </p>
          </div>
          <div className="space-y-2">
            <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${safetyBadgeClass(assessment?.level)}`}>
              {levelLabel}
            </span>
            <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${confidenceBadgeClass(assessment?.confidence)}`}>
              {confidenceLabel} confidence
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3 text-xs leading-5 text-[var(--app-text)]">
        <span className="font-bold text-[var(--app-text-strong)]">Guardrail:</span>{" "}
        This rules-based guidance does not guarantee OSHA compliance and does not replace a competent person, safety manager, legal review, or professional judgment.
      </div>

      {assessment ? (
        <p className="mt-4 text-sm leading-6 text-[var(--app-text)]">{assessment.explanation}</p>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--app-muted)]">Safety AI assessment will appear after the predictive model loads.</p>
      )}

      {scoreExplanation ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Reason for score</p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{scoreExplanation.reason}</p>
          </div>
          <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Data used</p>
            <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">
              {scoreExplanation.dataInputs.slice(0, 3).join(" | ") || "No source signal was available."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Recommended action</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--app-text-strong)]">{scoreExplanation.recommendedAction}</p>
          </div>
          <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Human review</p>
            <p className={scoreExplanation.humanApprovalRequired ? "mt-2 text-xs font-black leading-5 text-red-700" : "mt-2 text-xs font-black leading-5 text-emerald-700"}>
              {scoreExplanation.humanApprovalRequired ? "Human approval required before work proceeds" : "No extra AI-triggered human approval requirement"}
            </p>
            {scoreExplanation.humanApprovalReason ? (
              <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{scoreExplanation.humanApprovalReason}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Top risk drivers</h3>
          <div className="mt-3 space-y-2">
            {drivers.map((driver, index) => (
              <div key={`${driver.category}-${driver.label}`} className="rounded-lg border border-[var(--app-border)] bg-slate-50/70 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">{index + 1}. {driver.label}</p>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${safetyBadgeClass(driver.impact)}`}>
                    {driver.impact}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{driver.explanation}</p>
              </div>
            ))}
            {!loading && drivers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-5 text-center text-sm text-[var(--app-muted)]">
                No Safety AI drivers available yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-5">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Recommended next actions</h3>
          <div className="mt-3 space-y-2">
            {recommendations.map((recommendation) => (
              <div key={`${recommendation.controlType}-${recommendation.title}`} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                    {recommendation.controlType.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    {recommendation.priority} priority
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">{recommendation.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{recommendation.reason}</p>
              </div>
            ))}
            {!loading && recommendations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-5 text-center text-sm text-[var(--app-muted)]">
                Recommendations appear when safety signals are available.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-3">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Escalation status</h3>
          <div className="mt-3 space-y-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3 text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[var(--app-text)]">Escalation</span>
              <span className={assessment?.escalationRequired ? "font-black text-red-700" : "font-black text-emerald-700"}>
                {assessment?.escalationRequired ? "Required" : "Not required"}
              </span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[var(--app-text)]">Stop-work review</span>
              <span className={assessment?.stopWorkReviewRecommended ? "font-black text-red-700" : "font-black text-emerald-700"}>
                {assessment?.stopWorkReviewRecommended ? "Recommended" : "Not recommended"}
              </span>
            </p>
          </div>

          <h3 className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Missing data</h3>
          <div className="mt-3 rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            {missingData.length > 0 ? (
              <ul className="space-y-1 text-xs leading-5 text-[var(--app-text)]">
                {missingData.slice(0, 6).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-[var(--app-muted)]">No major missing data was flagged for this assessment.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DailyRiskBriefingPanel({ data, loading }: { data: PredictiveRiskPayload | null; loading: boolean }) {
  const briefing = data?.dailyBriefing;
  const highRiskToday = briefing?.highRiskWork.filter((work) => work.timing === "today").slice(0, 3) ?? [];
  const highRiskTomorrow = briefing?.highRiskWork.filter((work) => work.timing === "tomorrow").slice(0, 3) ?? [];
  const blockers = briefing?.readinessBlockers.slice(0, 5) ?? [];
  const controls = briefing?.controlsToVerify.slice(0, 5) ?? [];
  const topWork = briefing?.highRiskWork[0];
  const topScoreExplanation = topWork?.scoreExplanation;
  const topRecommendedControls = topWork?.recommendedControls.slice(0, 3) ?? [];
  const actionQueue = data?.aiSafetyActionQueue.items.slice(0, 4) ?? [];
  const conflicts = data?.aiSafetyConflictMap.findings.slice(0, 3) ?? [];
  const approvalState = data?.approvalState;
  const reasoningFrame = data?.aiSafetyReasoningFrame;
  const decisionQuality = data?.decisionQuality;
  const uncertaintySummary = data?.uncertaintySummary;
  const nextBestActions = data?.nextBestActions.slice(0, 4) ?? [];
  const fieldEvidenceSignals = reasoningFrame?.fieldEvidenceSignals.slice(0, 3) ?? [];

  return (
    <section className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">Daily Risk Briefing</p>
          <h2 className="mt-2 text-lg font-black text-[var(--app-text-strong)]">Work that needs attention before start</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--app-muted)]">
            {loading ? "Loading today and tomorrow risk briefing." : briefing?.headline ?? "No briefing is available yet."}
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Highest risk</p>
            <p className={`mt-1 font-app-display text-2xl font-black ${safetyLevelTone(topWork?.riskLevel)}`}>
              {loading ? "-" : topWork?.riskLevel ?? "none"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Confidence</p>
            <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${confidenceBadgeClass(briefing?.confidence)}`}>
              {briefing?.confidence ?? "low"}
            </span>
          </div>
        </div>
      </div>

      {briefing?.stopWorkReviewRecommended || briefing?.escalationRequired ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold leading-5 text-red-800">
          Critical or high-consequence conditions require human review and possible stop-work evaluation. The engine recommends review; it does not release work or declare compliance.
        </div>
      ) : null}

      {reasoningFrame ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-800">AI reasoning frame</p>
              <p className="mt-1 text-xs leading-5 text-sky-950">{reasoningFrame.goal}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-sky-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-800">
                Quality {decisionQuality?.score ?? 0}/100
              </span>
              <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                {uncertaintySummary?.level ?? "low"} uncertainty
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-sky-950">
            {uncertaintySummary?.summary ?? "Uncertainty summary appears after the AI Engine has enough evidence to reason over."}
          </p>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <div className="rounded-md border border-sky-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Evidence used</p>
              {(reasoningFrame.supportingEvidence.slice(0, 3)).map((item) => (
                <p key={`${item.source}-${item.label}`} className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                  {item.label}
                </p>
              ))}
            </div>
            <div className="rounded-md border border-sky-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Missing or conflicting</p>
              {(uncertaintySummary?.drivers.slice(0, 3) ?? []).map((driver) => (
                <p key={driver} className="mt-1 text-xs leading-5 text-[var(--app-text)]">{driver}</p>
              ))}
              {(uncertaintySummary?.drivers.length ?? 0) === 0 ? (
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">No major uncertainty driver was flagged.</p>
              ) : null}
            </div>
            <div className="rounded-md border border-sky-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Verify first</p>
              {nextBestActions.slice(0, 3).map((item) => (
                <p key={item.id} className="mt-1 text-xs leading-5 text-[var(--app-text)]">{item.detail}</p>
              ))}
              {nextBestActions.length === 0 ? (
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">No next-best action was generated.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {fieldEvidenceSignals.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">Field evidence needing verification</p>
              <p className="mt-1 text-xs leading-5 text-amber-950">
                Photo-review summaries are advisory evidence inputs and need field verification before work proceeds.
              </p>
            </div>
            <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
              {fieldEvidenceSignals.length} item{fieldEvidenceSignals.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {fieldEvidenceSignals.map((signal) => (
              <div key={signal.id} className="rounded-md border border-amber-200 bg-white px-3 py-2">
                <p className="text-xs font-black text-[var(--app-text-strong)]">
                  {signal.linkedWorkTitle ?? signal.linkedConflictTitle ?? "Unlinked field evidence"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                  {(signal.criticalFlags[0] ?? signal.concerns[0] ?? signal.nextActions[0]) || "Field evidence needs review."}
                </p>
                {signal.recommendedControls[0] ? (
                  <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">
                    Verify: {signal.recommendedControls[0]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-orange-800">Predicted workface conflicts</p>
              <p className="mt-1 text-xs leading-5 text-orange-900">{data?.aiSafetyConflictMap.summary}</p>
            </div>
            <span className="rounded-md border border-orange-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-orange-800">
              {data?.aiSafetyConflictMap.highConflictCount ?? 0} high/critical
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-md border border-orange-200 bg-white px-3 py-2">
                <p className="text-xs font-black text-[var(--app-text-strong)]">{conflict.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{conflict.requiredVerification}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {actionQueue.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Today&apos;s AI safety action queue</p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                {data?.aiSafetyActionQueue.headline}
              </p>
            </div>
            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
              {approvalState?.reviewRequiredCount ?? 0} review required
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {actionQueue.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${safetyBadgeClass(item.riskLevel)}`}>
                    {item.priority}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    {item.approvalState.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    {item.ownerRole.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">{item.title}</p>
                {item.category === "workface_conflict_review" ? (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                    Predicted workface conflict
                  </p>
                ) : null}
                <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{item.recommendedControl}</p>
                {item.humanApprovalRequired ? (
                  <p className="mt-2 text-xs font-black leading-5 text-red-700">
                    Human review required before work proceeds.
                  </p>
                ) : null}
                {item.missingInformation.length > 0 ? (
                  <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    Missing: {item.missingInformation.slice(0, 2).join("; ")}
                  </p>
                ) : null}
                {item.feedbackInfluence.length > 0 ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
                    Feedback influenced this recommendation: {item.feedbackInfluence.slice(0, 2).join("; ")}
                  </p>
                ) : null}
                {item.reasoningMetadata ? (
                  <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs leading-5 text-sky-800">
                    Reasoning quality {item.reasoningMetadata.decisionQualityScore}/100; uncertainty {item.reasoningMetadata.uncertaintyLevel}.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {topScoreExplanation ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Top score reason</p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{topScoreExplanation.reason}</p>
          </div>
          <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Data used</p>
            <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">
              {topScoreExplanation.dataInputs.slice(0, 3).join(" | ") || "No source signal was available."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Human review</p>
            <p className={topScoreExplanation.humanApprovalRequired ? "mt-2 text-xs font-black leading-5 text-red-700" : "mt-2 text-xs font-black leading-5 text-emerald-700"}>
              {topScoreExplanation.humanApprovalRequired ? "Human approval required before work proceeds" : "No extra AI-triggered human approval requirement"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        {topRecommendedControls.length > 0 ? (
          <div className="xl:col-span-12">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
              <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">AI-recommended controls</h3>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {topRecommendedControls.map((control) => (
                <div key={`${topWork?.id}-${control.hazardFamily}-${control.title}`} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                      {control.controlCategory.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      {control.basis.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">{control.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{control.recommendedAction}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{control.verificationRequired}</p>
                  {control.humanApprovalRequired ? (
                    <p className="mt-2 text-xs font-black leading-5 text-red-700">
                      Human review required before work proceeds.
                    </p>
                  ) : null}
                  <AiFeedbackControls
                    surface="ai-engine.daily-briefing"
                    sourceId={`${topWork?.id}-${control.hazardFamily}`}
                    mode="recommendation"
                    metadata={{
                      workflowStep: "predictive_risk_daily_briefing",
                      hazardFamily: control.hazardFamily,
                      basis: control.basis,
                      jobsiteId: topWork?.jobsiteId ?? null,
                    }}
                    className="mt-3"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="xl:col-span-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--app-accent-primary)]" aria-hidden />
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">High risk today</h3>
          </div>
          <div className="mt-3 space-y-2">
            {highRiskToday.map((work) => (
              <div key={work.id} className="rounded-lg border border-[var(--app-border)] bg-slate-50/70 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">{work.title}</p>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${safetyBadgeClass(work.riskLevel)}`}>
                    {work.riskLevel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{work.jobsiteName}{work.area ? ` | ${work.area}` : ""}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{work.scoreExplanation.recommendedAction}</p>
              </div>
            ))}
            {!loading && highRiskToday.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                No high-risk work ranked for today from loaded data.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--app-accent-primary)]" aria-hidden />
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">High risk tomorrow</h3>
          </div>
          <div className="mt-3 space-y-2">
            {highRiskTomorrow.map((work) => (
              <div key={work.id} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">{work.title}</p>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${safetyBadgeClass(work.riskLevel)}`}>
                    {work.riskLevel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{work.whyItMatters}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--app-text)]">{work.scoreExplanation.recommendedAction}</p>
              </div>
            ))}
            {!loading && highRiskTomorrow.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                No high-risk work ranked for tomorrow from loaded data.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Missing readiness items</h3>
          </div>
          <div className="mt-3 space-y-2">
            {blockers.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${safetyBadgeClass(item.severity)}`}>
                    {item.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">{item.severity}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{item.detail}</p>
              </div>
            ))}
            {!loading && blockers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                No readiness blockers were found in the loaded briefing.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Controls to verify before work starts</h3>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {controls.map((control) => (
              <div key={control.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                    {control.controlType.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">{control.priority}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">{control.text}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{control.whyItMatters}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-5">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Why this matters</h3>
          <div className="mt-3 rounded-lg border border-[var(--app-border)] bg-white px-3 py-3">
            {(briefing?.whyThisMatters ?? []).slice(0, 4).map((item) => (
              <p key={item} className="border-b border-[var(--app-border)] py-2 text-xs leading-5 text-[var(--app-text)] last:border-b-0">
                {item}
              </p>
            ))}
            {!loading && (briefing?.whyThisMatters.length ?? 0) === 0 ? (
              <p className="text-xs leading-5 text-[var(--app-muted)]">Reasoning appears when the briefing has work or blocker evidence.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function HumanBehaviorRiskPanel({ data, loading }: { data: PredictiveRiskPayload | null; loading: boolean }) {
  const behaviorRisk = data?.behaviorRisk;
  const topDrivers = behaviorRisk?.topDrivers ?? [];
  const primaryAction = behaviorRisk?.recommendedActions[0] ?? "Supervisor coaching recommended when behavior risk drivers appear.";
  const byTrade = behaviorRisk?.byTrade ?? [];
  const bySupervisor = behaviorRisk?.bySupervisor ?? [];

  return (
    <section className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">Human Behavior Risk</p>
          <h2 className="mt-2 text-lg font-black text-[var(--app-text-strong)]">Coaching and verification guidance</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--app-muted)]">
            This layer looks for planning, verification, and control-quality signals before risky work starts. It supports coaching and field intervention, not discipline.
          </p>
        </div>
        <div className="min-w-[180px] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Current Level</p>
          <p className={`mt-1 font-app-display text-2xl font-black ${behaviorTone(behaviorRisk?.riskLevel)}`}>
            {loading ? "-" : behaviorRisk?.riskLevel ?? "Low"}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--app-text)]">Score: {loading ? "-" : behaviorRisk?.behaviorRiskScore ?? 0} / 100</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Top Drivers</h3>
          <div className="mt-3 space-y-2">
            {(loading ? [] : topDrivers.slice(0, 4)).map((driver, index) => (
              <div key={driver.driver} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-slate-50/70 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">{index + 1}. {driver.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{driver.description}</p>
                </div>
                <span className="shrink-0 text-xs font-black text-[var(--app-text-strong)]">+{driver.points}</span>
              </div>
            ))}
            {!loading && topDrivers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                No behavior risk drivers in this window.
              </p>
            ) : null}
          </div>
        </div>

        <div className="xl:col-span-3">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Recommended Action</h3>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold leading-6 text-amber-900">
            {loading ? "Loading behavior intervention guidance." : primaryAction}
          </div>
          {behaviorRisk && behaviorRisk.behaviorRiskScore >= 61 ? (
            <p className="mt-3 text-xs leading-5 text-[var(--app-text)]">Field verification required for the highest-risk work before release.</p>
          ) : null}
        </div>

        <div className="grid gap-4 xl:col-span-4 md:grid-cols-2 xl:grid-cols-1">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Behavior Risk by Trade</h3>
            <div className="mt-3 space-y-2">
              {(loading ? [] : byTrade.slice(0, 4)).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-bold text-[var(--app-text-strong)]">{row.label}</span>
                  <span className={`font-black ${behaviorTone(row.riskLevel)}`}>{row.riskLevel}</span>
                </div>
              ))}
              {!loading && byTrade.length === 0 ? <p className="text-xs text-[var(--app-muted)]">Trade rollups appear when source rows include trade data.</p> : null}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Behavior Risk by Supervisor</h3>
            <div className="mt-3 space-y-2">
              {(loading ? [] : bySupervisor.slice(0, 4)).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-bold text-[var(--app-text-strong)]">{row.label}</span>
                  <span className={`font-black ${behaviorTone(row.riskLevel)}`}>{row.riskLevel}</span>
                </div>
              ))}
              {!loading && bySupervisor.length === 0 ? <p className="text-xs text-[var(--app-muted)]">Supervisor rollups appear when verification data includes supervisor assignment.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RiskActionLoopPanel({
  recommendations,
  loading,
  message,
  onGenerate,
  onExecuteAction,
}: {
  recommendations: ExplainableRecommendation[];
  loading?: boolean;
  message?: string;
  onGenerate?: () => void;
  onExecuteAction?: (id: string, actionType: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">AI Risk Action Loop</p>
          <h2 className="mt-2 text-lg font-black text-[var(--app-text-strong)]">Supervisor action plan</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--app-muted)]">
            Generate grounded recommendations from predictive risk, Risk Memory, company memory, and current work signals, then track whether leaders accepted and used them.
          </p>
        </div>
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--app-accent-primary)] px-4 text-sm font-bold text-white transition hover:bg-[var(--app-link-hover)] disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate action plan"}
          </button>
        ) : null}
      </div>

      {message ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {recommendations.map((recommendation) => (
          <details
            key={recommendation.id}
            className="rounded-lg border border-[var(--app-border)] bg-slate-50/70 px-3 py-3"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${recommendationStatusTone(recommendation.status)}`}>
                      {(recommendation.status ?? "active").replace("_", " ")}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${priorityTone(recommendation.priority)}`}>
                      {recommendation.priority ?? "medium"} priority
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">{recommendation.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--app-text)]">{recommendation.body}</p>
                </div>
                <span className="shrink-0 text-xs font-black text-[var(--app-accent-primary)]">
                  {Math.round((recommendation.confidence ?? 0) * 100)}% confidence
                </span>
              </div>
            </summary>
            <div className="mt-3 border-t border-[var(--app-border)] pt-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Why this matters</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{recommendation.body}</p>
              {recommendation.evidence ? <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{recommendation.evidence}</p> : null}
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Suggested action</p>
                  <p className="mt-1 text-xs font-bold text-[var(--app-text-strong)]">{actionTypeLabel(recommendation.actionType)}</p>
                </div>
                <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Owner / due</p>
                  <p className="mt-1 text-xs font-bold text-[var(--app-text-strong)]">
                    {recommendation.ownerUserId ? "Assigned" : "Unassigned"}{recommendation.dueAt ? ` | ${new Date(recommendation.dueAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Mitigation</p>
                  <p className="mt-1 text-xs font-bold text-[var(--app-text-strong)]">{mitigationLabel(recommendation.mitigationState)}</p>
                </div>
                <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">Residual risk</p>
                  <p className="mt-1 text-xs font-bold text-[var(--app-text-strong)]">
                    {(recommendation.riskReductionPoints ?? 0) > 0
                      ? `-${recommendation.riskReductionPoints} verified points`
                      : recommendation.verificationRequired === false
                        ? "No credit yet"
                        : "Verification required"}
                  </p>
                </div>
              </div>
              {recommendation.linkedModule || recommendation.linkedRecordId ? (
                <p className="mt-2 text-xs font-semibold text-[var(--app-text)]">
                  Linked {String(recommendation.linkedModule ?? "record").replaceAll("_", " ")}
                  {recommendation.linkedRecordId ? `: ${recommendation.linkedRecordId}` : ""}
                </p>
              ) : null}
              {recommendation.evidenceRefs && recommendation.evidenceRefs.length > 0 ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {recommendation.evidenceRefs.slice(0, 4).map((ref) => (
                    <Link
                      key={ref.id}
                      href={ref.href}
                      className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-xs transition hover:border-[var(--app-accent-surface-35)]"
                    >
                      <span className="font-bold text-[var(--app-text-strong)]">{ref.label}</span>
                      <span className="mt-1 block text-[var(--app-muted)]">{ref.detail ?? ref.sourceModule}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {[recommendation.actionType ?? "assign", "assign", "request_documentation", "request_inspection", "create_corrective_action", "request_permit", "accountability_review", "stop_work_review", "mark_field_used", "resolve", "dismiss"]
                  .filter((action, index, arr) => arr.indexOf(action) === index)
                  .map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => onExecuteAction?.(recommendation.id, action)}
                    disabled={loading || !onExecuteAction}
                    className="rounded-md border border-[var(--app-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)] disabled:opacity-50"
                  >
                    {action === recommendation.actionType ? `Do: ${actionTypeLabel(action)}` : actionTypeLabel(action)}
                  </button>
                ))}
                {recommendation.actionHref ? (
                  <Link
                    href={recommendation.actionHref}
                    className="rounded-md border border-[var(--app-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--app-accent-primary)] transition hover:bg-[var(--app-panel-soft)]"
                  >
                    Open target
                  </Link>
                ) : null}
              </div>
            </div>
          </details>
        ))}
        {recommendations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border)] px-4 py-7 text-center text-sm text-[var(--app-muted)]">
            No AI risk actions have been generated for this view yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PredictiveModelView({
  data,
  loading,
  error,
  days,
  onDaysChange,
  selectedJobsiteId,
  onJobsiteChange,
  onRefresh,
  riskActionRecommendations = [],
  riskActionLoading = false,
  riskActionMessage = "",
  onGenerateRiskActionPlan,
  onExecuteRiskRecommendation,
}: {
  data: PredictiveRiskPayload | null;
  loading: boolean;
  error: string;
  days: number;
  onDaysChange?: (days: number) => void;
  selectedJobsiteId?: string;
  onJobsiteChange?: (jobsiteId: string) => void;
  onRefresh?: () => void;
  riskActionRecommendations?: ExplainableRecommendation[];
  riskActionLoading?: boolean;
  riskActionMessage?: string;
  onGenerateRiskActionPlan?: () => void;
  onExecuteRiskRecommendation?: (id: string, actionType: string) => void;
}) {
  const locations = data?.locations ?? [];
  const drivers = data?.drivers ?? [];
  const actions = data?.actions ?? [];
  const hasSignals = Boolean(data && (locations.some((row) => row.riskScore > 0) || drivers.length > 0));

  return (
    <div className="min-h-[calc(100vh-4rem)] rounded-[1.5rem] border border-[var(--app-accent-surface-18)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.99)_0%,_rgba(239,247,249,0.96)_100%)] text-[var(--app-text)] shadow-[var(--app-shadow-primary-float)]">
      <div className="border-b border-[var(--app-border)] bg-white/90 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-700">Predictive model</p>
            <h1 className="mt-2 font-app-display text-3xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-4xl">
              Predict risk before it happens
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--app-text)]">
              The model combines validated observations, corrective actions, permits, JSAs, and incidents to prioritize where safety leaders should act next.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[var(--app-border)] bg-white p-1" role="group" aria-label="Risk window">
              {DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onDaysChange?.(option)}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-bold transition",
                    days === option
                      ? "bg-[var(--app-accent-primary)] text-white"
                      : "text-[var(--app-muted)] hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]",
                  ].join(" ")}
                >
                  {option === 7 ? "7 days" : option === 30 ? "30 days" : "90 days"}
                </button>
              ))}
            </div>
            <select
              value={selectedJobsiteId ?? ""}
              onChange={(event) => onJobsiteChange?.(event.target.value)}
              className="h-10 min-w-[180px] rounded-lg border border-[var(--app-border)] bg-white px-3 text-sm font-semibold text-[var(--app-text-strong)]"
              aria-label="Location filter"
            >
              <option value="">All locations</option>
              {locations
                .filter((row) => row.id !== "unassigned")
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 text-sm font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-8">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
        {data?.warning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {data.warning}
          </div>
        ) : null}

        {data?.leadershipTrust ? <TrustSummaryPanel trust={data.leadershipTrust} compact /> : null}

        <ModelExplanationPanel data={data} days={days} />

        <DailyRiskBriefingPanel data={data} loading={loading} />

        <SafetyAiAssessmentPanel data={data} loading={loading} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="High risk locations"
            value={loading ? "-" : data?.summary.highRiskLocationCount ?? 0}
            detail={loading ? "Loading" : `${locations.length} locations in view`}
            explanation="Count of visible locations with a score of 70 or higher."
            tone="text-red-600"
          />
          <MetricCard
            label="Predicted incidents"
            value={loading ? "-" : data?.summary.predictedIncidents ?? 0}
            detail="Next model window"
            explanation="Rounded forecast from the injury and risk model for the next model period."
            tone="text-red-600"
          />
          <MetricCard
            label="Average risk score"
            value={loading ? "-" : data?.summary.averageResidualRiskScore ?? data?.summary.averageRiskScore ?? 0}
            detail="Out of 100"
            explanation={
              data?.summary.mitigationSummary
                ? `Average of locations with active risk. Higher is worse; 100 is the cap for maximum displayed pressure. ${data.summary.mitigationSummary}`
                : "Average of locations with active risk. Higher is worse; 100 is the cap for maximum displayed pressure."
            }
            tone="text-orange-600"
          />
          <MetricCard
            label="Confidence level"
            value={loading ? "-" : `${data?.summary.confidencePercent ?? 0}%`}
            detail={data?.model.confidenceLabel ? `${data.model.confidenceLabel} model confidence` : "Model confidence"}
            explanation="Confidence reflects data and model coverage, not a safety grade."
            tone="text-emerald-600"
          />
        </div>

        <HumanBehaviorRiskPanel data={data} loading={loading} />

        <RiskActionLoopPanel
          recommendations={riskActionRecommendations}
          loading={riskActionLoading}
          message={riskActionMessage}
          onGenerate={onGenerateRiskActionPlan}
          onExecuteAction={onExecuteRiskRecommendation}
        />

        {!loading && !hasSignals ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border)] bg-white px-5 py-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-teal-700" aria-hidden />
            <h2 className="mt-3 text-lg font-black text-[var(--app-text-strong)]">No predictive risk signals yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--app-muted)]">
              Validated observations, corrective actions, incidents, permits, or JSA activity will populate this view as records flow into the company workspace.
            </p>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-12">
          <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 xl:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[var(--app-text-strong)]">Top locations by predicted risk</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Ranked by weighted severity, urgency, open/overdue items, SIF potential, and stop-work signals. Lower is better; 100 means highest displayed risk pressure.
                </p>
              </div>
              <MapPin className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <div className="mt-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs leading-5 text-[var(--app-text)]">
              <span className="font-bold text-[var(--app-text-strong)]">Read the score like a risk pressure gauge:</span>{" "}
              0 is good, 70+ is high risk, and 100 is the cap for the worst visible combination of active signals.
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  <tr className="border-b border-[var(--app-border)]">
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">
                      Risk score
                      <span className="block text-[10px] font-semibold normal-case tracking-normal text-[var(--app-muted)]">0 is best, 100 is highest risk pressure</span>
                    </th>
                    <th className="py-2 pr-3">
                      Trend
                      <span className="block text-[10px] font-semibold normal-case tracking-normal text-[var(--app-muted)]">Positive is worsening, negative is improving</span>
                    </th>
                    <th className="py-2 pr-3">Top driver</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : locations).map((row) => (
                    <tr key={row.id} className="border-b border-[var(--app-border)] last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-bold text-[var(--app-text-strong)]">{row.label}</p>
                        {row.subtitle ? <p className="mt-0.5 text-xs text-[var(--app-muted)]">{row.subtitle}</p> : null}
                      </td>
                      <td className={`py-3 pr-3 font-app-display text-lg font-black ${toneForScore(row.riskScore)}`}>{row.riskScore}</td>
                      <td className="py-3 pr-3">
                        <span className={row.trendDelta > 0 ? "text-red-600" : row.trendDelta < 0 ? "text-emerald-600" : "text-[var(--app-muted)]"}>
                          {row.trendDelta > 0 ? `+${row.trendDelta}` : row.trendDelta}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[var(--app-text)]">{row.topDriver}</td>
                    </tr>
                  ))}
                  {!loading && locations.length === 0 ? (
                    <tr>
                      <td className="py-8 text-center text-sm text-[var(--app-muted)]" colSpan={4}>
                        No locations available in this window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 xl:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[var(--app-text-strong)]">Top risk drivers</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Share of active risk categories in the selected window.
                </p>
              </div>
              <Target className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {(loading ? [] : drivers).map((driver, idx) => (
                <div key={driver.id}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-[var(--app-text-strong)]">{driver.label}</span>
                    <span className="font-black text-[var(--app-text-strong)]">{driver.percent}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className={["h-full rounded-full", idx === 0 ? "bg-red-500" : idx === 1 ? "bg-orange-500" : idx === 2 ? "bg-amber-400" : "bg-emerald-500"].join(" ")}
                      style={{ width: `${Math.max(4, driver.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!loading && drivers.length === 0 ? <p className="py-8 text-center text-sm text-[var(--app-muted)]">No risk drivers yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <TrendChart points={data?.trend ?? []} />
          </div>
          <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 xl:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[var(--app-text-strong)]">Recommended actions</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Model-prioritized actions to reduce risk.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {(loading ? [] : actions).map((action) => (
                <div key={action.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-slate-50/70 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">{action.title}</p>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">{action.target}</p>
                    {action.evidence ? <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{action.evidence}</p> : null}
                    {typeof action.confidencePercent === "number" ? (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                        {action.sourceModule ?? "predictive risk"} - confidence {action.confidencePercent}%
                      </p>
                    ) : null}
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black ${impactClass(action.impact)}`}>
                    {action.impact}
                  </span>
                </div>
              ))}
              {!loading && actions.length === 0 ? <p className="py-8 text-center text-sm text-[var(--app-muted)]">No recommended actions yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 text-xs text-[var(--app-muted)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            <p>{data?.model.provenanceNote ?? "Model provenance will appear after the first load."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {data ? `${data.filters.days} days` : `${days} days`}
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-4 w-4" aria-hidden />
              {data?.model.version ?? "Model pending"}
            </span>
            <Link href="/analytics" className="font-bold text-[var(--app-accent-primary)] underline-offset-4 hover:underline">
              Back to analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
