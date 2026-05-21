"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Database,
  RefreshCw,
  Send,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const SURFACES = [
  { value: "all", label: "All surfaces" },
  { value: "safety-intelligence", label: "Safety Intelligence" },
  { value: "company-memory", label: "Company memory" },
  { value: "permit-copilot", label: "Permit copilot" },
  { value: "csep-review", label: "CSEP review" },
  { value: "gc-review", label: "GC review" },
  { value: "injury-weather", label: "Injury/weather" },
  { value: "training-records.photo-extract", label: "Training photo extract" },
  { value: "field-audits.ai-review", label: "Field audit review" },
  { value: "jobsite.site-visual", label: "Jobsite visual" },
  { value: "embeddings", label: "Embeddings" },
];

const OUTCOMES = [
  { value: "accepted", label: "Accepted" },
  { value: "edited", label: "Edited" },
  { value: "rejected", label: "Rejected" },
  { value: "regenerated", label: "Rerun requested" },
  { value: "field-used", label: "Field-used" },
] as const;

function formatOutcomeLabel(outcome: string) {
  return OUTCOMES.find((item) => item.value === outcome)?.label ?? outcome.replace(/-/g, " ");
}

type MetricsPayload = {
  generatedAt: string;
  unavailable: boolean;
  unavailableReason: string | null;
  summary: {
    totalCalls: number;
    fallbackCalls: number;
    fallbackRate: number;
    failedCalls: number;
    failureRate: number;
    totalTokens: number;
    averageLatencyMs: number | null;
    p50LatencyMs?: number | null;
    p90LatencyMs?: number | null;
    p95LatencyMs?: number | null;
  };
  bySurface: Array<GroupMetric>;
  byModel: Array<GroupMetric>;
  byProvider: Array<GroupMetric>;
  recentFailures: Array<CallRow>;
};

type GroupMetric = {
  key: string;
  calls: number;
  fallbacks: number;
  failures: number;
  tokens: number;
  p50LatencyMs?: number | null;
  p90LatencyMs?: number | null;
  p95LatencyMs?: number | null;
};

type CallRow = {
  id: string | number;
  created_at: string;
  surface: string;
  model: string | null;
  provider: string | null;
  trace_id?: string | null;
  prompt_version?: string | null;
  output_schema_version?: string | null;
  latency_ms: number | null;
  status: string;
  error_type?: string | null;
  http_status: number | null;
  attempts: number | null;
  retry_count?: number | null;
  fallback_used: boolean | null;
  fallback_reason: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens: number | null;
  error_message: string | null;
  cache_hit?: boolean | null;
  tool_calls_used?: number | null;
  eval_fixture_id?: string | null;
};

type CallsPayload = {
  rows: CallRow[];
  count: number;
  unavailable: boolean;
  reason: string | null;
};

type FeedbackRow = {
  id: string | number;
  created_at: string;
  surface: string;
  source_id: string | null;
  ai_review_id: string | null;
  rating: number | null;
  outcome: string;
  reason: string | null;
  created_by: string | null;
  signal_metadata?: {
    workflowStep?: string;
    documentType?: string;
    reasonCode?: string;
    editDistanceRatio?: number;
    regeneratedCount?: number;
    usedInField?: boolean;
    fallbackUsed?: boolean;
  } | null;
};

type FeedbackPayload = {
  rows: FeedbackRow[];
  count: number;
  unavailable: boolean;
  reason: string | null;
  summary?: {
    total: number;
    outcomeCounts: Record<string, number>;
    bySurface: Array<{
      surface: string;
      count: number;
      accepted: number;
      edited: number;
      rejected: number;
      regenerated: number;
      fieldUsed: number;
      negativeRate: number;
      fieldUsedRate: number;
      current7DayCount: number;
      previous7DayCount: number;
      delta7DayCount: number;
    }>;
    needsReview: Array<{
      surface: string;
      count: number;
      negativeRate: number;
      current7DayCount: number;
      previous7DayCount: number;
      delta7DayCount: number;
    }>;
  };
};

type EvalPayload = {
  totalFixtures: number;
  rootAvailable: boolean;
  surfaces: Array<{ surface: string; fixtures: number; status: string }>;
};

type Recommendation = {
  id: string;
  severity: "critical" | "warning" | "info";
  surface: string;
  category: string;
  title: string;
  evidence: string;
  suggestedAction: string;
  source: "deterministic";
};

type ToolResultSummary = {
  toolName: string;
  generatedAt: string;
  rowCount: number;
  evidenceIds: string[];
  filters: {
    surface: string;
    since: string;
    windowDays: number;
    limit: number;
    status: string | null;
    errorType: string | null;
    traceId: string | null;
  };
  summary: Record<string, unknown>;
};

type RecommendationPayload = {
  snapshot: unknown | null;
  stale: boolean;
  generatedAt: string | null;
  snapshotDate: string | null;
  surface: string;
  windowDays: number;
  summary: string;
  summaryMeta: {
    model: string | null;
    provider: string | null;
    promptHash: string | null;
    fallbackUsed: boolean;
    fallbackReason: string | null;
    toolCallsUsed?: number;
    toolResults?: ToolResultSummary[];
  };
  recommendations: Recommendation[];
  toolResultsSummary?: ToolResultSummary[];
};

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatMaybeDate(value: string | null | undefined) {
  return value ? formatDate(value) : "Not generated";
}

function buildAiAlerts(metrics: MetricsPayload | null, evals: EvalPayload | null, feedback: FeedbackPayload | null) {
  const alerts: Array<{ level: "critical" | "warning"; title: string; detail: string }> = [];
  const summary = metrics?.summary;
  if (summary && summary.failureRate > 0.05) {
    alerts.push({ level: "critical", title: "Failure rate above gate", detail: `${formatPercent(summary.failureRate)} over selected window.` });
  }
  if (summary && summary.fallbackRate > 0.1) {
    alerts.push({ level: "critical", title: "Fallback rate above alert threshold", detail: `${formatPercent(summary.fallbackRate)} over selected window.` });
  }
  const failedSurface = metrics?.bySurface.find((row) => row.calls > 0 && row.failures === row.calls);
  if (failedSurface) {
    alerts.push({ level: "critical", title: "Surface has 100% failures", detail: failedSurface.key });
  }
  const providerFailures = metrics?.byProvider.find((row) => row.failures > 3);
  if (providerFailures) {
    alerts.push({ level: "critical", title: "Provider failures above threshold", detail: `${providerFailures.key}: ${providerFailures.failures} failures.` });
  }
  const slowSurface = metrics?.bySurface.find((row) => (row.p95LatencyMs ?? 0) > 30_000);
  if (slowSurface) {
    alerts.push({ level: "warning", title: "p95 latency above target", detail: `${slowSurface.key}: ${formatNumber(slowSurface.p95LatencyMs)} ms.` });
  }
  const expensiveSurface = metrics?.bySurface.find((row) => row.tokens > 100_000);
  if (expensiveSurface) {
    alerts.push({ level: "warning", title: "Token usage above budget", detail: `${expensiveSurface.key}: ${formatNumber(expensiveSurface.tokens)} tokens.` });
  }
  const missingEval = evals?.surfaces.find((row) => row.status !== "covered");
  if (missingEval) {
    alerts.push({ level: "warning", title: "Active surface missing eval fixtures", detail: missingEval.surface });
  }
  if (feedback?.summary && feedback.summary.total === 0) {
    alerts.push({ level: "warning", title: "Feedback capture is zero", detail: "No accepted, edited, rejected, regenerated, or field-used signals in this window." });
  }
  return alerts;
}

function formatMetadata(row: FeedbackRow) {
  const metadata = row.signal_metadata;
  if (!metadata) return row.reason ?? "n/a";
  const parts = [
    metadata.workflowStep,
    metadata.documentType,
    metadata.reasonCode ?? row.reason,
    typeof metadata.editDistanceRatio === "number" ? `edit ${Math.round(metadata.editDistanceRatio * 100)}%` : null,
    typeof metadata.regeneratedCount === "number" ? `rerun ${metadata.regeneratedCount}` : null,
    metadata.usedInField ? "field used" : null,
    metadata.fallbackUsed ? "fallback" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "n/a";
}

function sinceForWindow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: "slate" | "green" | "amber" | "red" | "cyan";
}) {
  const tones = {
    slate: "border-slate-700 bg-slate-950 text-slate-100",
    green: "border-emerald-500/40 bg-emerald-950/40 text-emerald-100",
    amber: "border-amber-500/40 bg-amber-950/40 text-amber-100",
    red: "border-red-500/40 bg-red-950/40 text-red-100",
    cyan: "border-cyan-500/40 bg-cyan-950/40 text-cyan-100",
  };
  return (
    <div className={`rounded-md border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: GroupMetric[] }) {
  return (
    <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 pr-4 font-semibold">Key</th>
              <th className="py-2 pr-4 font-semibold">Calls</th>
              <th className="py-2 pr-4 font-semibold">Fallbacks</th>
              <th className="py-2 pr-4 font-semibold">Failures</th>
              <th className="py-2 pr-4 font-semibold">Tokens</th>
              <th className="py-2 pr-4 font-semibold">p95</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {rows.slice(0, 8).map((row) => (
              <tr key={row.key}>
                <td className="py-2 pr-4 font-medium">{row.key}</td>
                <td className="py-2 pr-4">{formatNumber(row.calls)}</td>
                <td className="py-2 pr-4">{formatNumber(row.fallbacks)}</td>
                <td className="py-2 pr-4">{formatNumber(row.failures)}</td>
                <td className="py-2 pr-4">{formatNumber(row.tokens)}</td>
                <td className="py-2 pr-4">{formatNumber(row.p95LatencyMs)} ms</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-400" colSpan={6}>
                  No rows in this window.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function severityTone(severity: Recommendation["severity"]) {
  if (severity === "critical") return "border-red-500/50 bg-red-950/35 text-red-100";
  if (severity === "warning") return "border-amber-500/50 bg-amber-950/35 text-amber-100";
  return "border-cyan-500/40 bg-cyan-950/35 text-cyan-100";
}

function toolLabel(name: string) {
  return name
    .replace(/^get_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ToolContextPanel({
  payload,
  refreshing,
  onRefresh,
}: {
  payload: RecommendationPayload | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const tools = payload?.toolResultsSummary ?? payload?.summaryMeta.toolResults ?? [];
  return (
    <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Read-only tool context
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Diagnostic Toolbelt</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            Advisor-only evidence used to ground AI Engine recommendations. These tools read telemetry and never mutate production state.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-950 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Run diagnostic refresh
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <article key={`${tool.toolName}:${tool.generatedAt}`} className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-100">{toolLabel(tool.toolName)}</h3>
              <span className="rounded bg-slate-950 px-2 py-0.5 text-xs text-slate-300">{formatNumber(tool.rowCount)} rows</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {formatDate(tool.generatedAt)} / {tool.filters.surface} / {tool.filters.windowDays}d
            </div>
            <div className="mt-2 text-xs text-slate-300">
              Evidence: {tool.evidenceIds.slice(0, 4).join(", ") || "n/a"}
            </div>
          </article>
        ))}
        {tools.length === 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-950/25 p-4 text-sm text-amber-100">
            No read-only tool context has been generated for this snapshot yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecommendationsPanel({
  payload,
  refreshing,
  onRefresh,
}: {
  payload: RecommendationPayload | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const rows = payload?.recommendations ?? [];
  const severityCounts = {
    critical: rows.filter((row) => row.severity === "critical").length,
    warning: rows.filter((row) => row.severity === "warning").length,
    info: rows.filter((row) => row.severity === "info").length,
  };

  return (
    <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
            <Brain className="h-4 w-4" aria-hidden="true" />
            Daily snapshot
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">AI Engine Recommendations</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            {payload?.summary ?? "No recommendation snapshot has been generated for this filter yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-950 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh snapshot
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Snapshot</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">{payload?.snapshotDate ?? "None"}</div>
          {payload?.stale ? <div className="mt-1 text-xs text-amber-200">Stale or missing</div> : <div className="mt-1 text-xs text-emerald-200">Current daily snapshot</div>}
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Generated</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">{formatMaybeDate(payload?.generatedAt)}</div>
        </div>
        <div className="rounded-md border border-red-500/40 bg-red-950/25 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-200">Critical</div>
          <div className="mt-1 text-2xl font-semibold text-red-100">{severityCounts.critical}</div>
        </div>
        <div className="rounded-md border border-amber-500/40 bg-amber-950/25 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">Warnings</div>
          <div className="mt-1 text-2xl font-semibold text-amber-100">{severityCounts.warning}</div>
        </div>
        <div className="rounded-md border border-cyan-500/40 bg-cyan-950/25 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Info</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-100">{severityCounts.info}</div>
        </div>
      </div>

      {payload?.stale ? (
        <div className="mt-4 rounded-md border border-amber-500/50 bg-amber-950/35 p-3 text-sm text-amber-100">
          This view is using the latest stored snapshot. Refresh manually when you need today&apos;s recommendation set.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className={`rounded-md border p-3 ${severityTone(row.severity)}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-black/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                {row.severity}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{row.category}</span>
              <span className="text-xs opacity-70">{row.surface}</span>
            </div>
            <h3 className="mt-2 text-sm font-semibold">{row.title}</h3>
            <p className="mt-1 text-sm opacity-85">{row.evidence}</p>
            <p className="mt-2 text-sm font-medium">{row.suggestedAction}</p>
          </article>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-950/25 p-4 text-sm text-emerald-100">
            No open recommendations in the stored snapshot.
          </div>
        ) : null}
      </div>

      {payload?.summaryMeta ? (
        <div className="mt-4 text-xs text-slate-400">
          Summary: {payload.summaryMeta.fallbackUsed ? `deterministic fallback (${payload.summaryMeta.fallbackReason ?? "unknown"})` : "AI summarized"} · Model:{" "}
          {payload.summaryMeta.model ?? "n/a"} · Provider: {payload.summaryMeta.provider ?? "n/a"} · Prompt hash:{" "}
          {payload.summaryMeta.promptHash ?? "n/a"}
        </div>
      ) : null}
    </section>
  );
}

export default function SuperadminAiEnginePage() {
  const [surface, setSurface] = useState("all");
  const [windowDays, setWindowDays] = useState(7);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [calls, setCalls] = useState<CallsPayload | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [evals, setEvals] = useState<EvalPayload | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingRecommendations, setRefreshingRecommendations] = useState(false);
  const [refreshingDiagnostics, setRefreshingDiagnostics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState({
    surface: "safety-intelligence",
    sourceId: "",
    outcome: "accepted",
    rating: "5",
    reason: "",
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("surface", surface);
    params.set("since", sinceForWindow(windowDays));
    return params.toString();
  }, [surface, windowDays]);

  const recommendationQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("surface", surface);
    params.set("windowDays", String(windowDays));
    return params.toString();
  }, [surface, windowDays]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsResponse, callsResponse, feedbackResponse, evalsResponse, recommendationsResponse] = await Promise.all([
        fetch(`/api/superadmin/ai-engine/metrics?${query}`),
        fetch(`/api/superadmin/ai-engine/calls?${query}&limit=50`),
        fetch(`/api/superadmin/ai-engine/feedback?${query}&limit=50`),
        fetch("/api/superadmin/ai-engine/evals"),
        fetch(`/api/superadmin/ai-engine/recommendations?${recommendationQuery}`),
      ]);

      if (
        !metricsResponse.ok ||
        !callsResponse.ok ||
        !feedbackResponse.ok ||
        !evalsResponse.ok ||
        !recommendationsResponse.ok
      ) {
        throw new Error("Superadmin AI Engine data is unavailable.");
      }

      setMetrics(await metricsResponse.json());
      setCalls(await callsResponse.json());
      setFeedback(await feedbackResponse.json());
      setEvals(await evalsResponse.json());
      setRecommendations(await recommendationsResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load AI Engine operations.");
    } finally {
      setLoading(false);
    }
  }, [query, recommendationQuery]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/superadmin/ai-engine/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surface: feedbackDraft.surface,
        sourceId: feedbackDraft.sourceId,
        outcome: feedbackDraft.outcome,
        rating: feedbackDraft.rating ? Number(feedbackDraft.rating) : null,
        reason: feedbackDraft.reason,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Unable to record feedback.");
      return;
    }
    setFeedbackDraft((draft) => ({ ...draft, sourceId: "", reason: "" }));
    await load();
  }

  async function refreshRecommendationSnapshot() {
    setRefreshingRecommendations(true);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/ai-engine/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, windowDays }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to refresh recommendations.");
      }
      setRecommendations(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh recommendations.");
    } finally {
      setRefreshingRecommendations(false);
    }
  }

  async function refreshDiagnostics() {
    setRefreshingDiagnostics(true);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/ai-engine/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, windowDays }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to run AI Engine diagnostics.");
      }
      setRecommendations({
        snapshot: null,
        stale: false,
        generatedAt: body.generatedAt ?? new Date().toISOString(),
        snapshotDate: null,
        surface: body.surface ?? surface,
        windowDays: body.windowDays ?? windowDays,
        summary: body.summary ?? "Diagnostics refreshed.",
        summaryMeta: body.summaryMeta,
        recommendations: body.recommendations ?? [],
        toolResultsSummary: body.toolResultsSummary ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run AI Engine diagnostics.");
    } finally {
      setRefreshingDiagnostics(false);
    }
  }

  const summary = metrics?.summary;
  const feedbackSummary = feedback?.summary;
  const alerts = buildAiAlerts(metrics, evals, feedback);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Superadmin
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">AI Engine Operations</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Runtime telemetry, recovery health, learning signals, and evaluation coverage for the platform AI
              operations panel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={surface}
              onChange={(event) => setSurface(event.target.value)}
              aria-label="AI surface"
            >
              {SURFACES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              aria-label="Time window"
            >
              <option value={1}>24 hours</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-950 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {metrics?.unavailable ? (
          <div className="rounded-md border border-amber-500/50 bg-amber-950/40 p-4 text-sm text-amber-100">
            Runtime telemetry is not configured: {metrics.unavailableReason}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Activity} label="Calls" value={formatNumber(summary?.totalCalls)} tone="cyan" />
          <Stat icon={AlertTriangle} label="Fallback rate" value={formatPercent(summary?.fallbackRate)} tone="amber" />
          <Stat icon={CheckCircle2} label="Failure rate" value={formatPercent(summary?.failureRate)} tone="red" />
          <Stat icon={BarChart3} label="Avg latency" value={`${formatNumber(summary?.averageLatencyMs)} ms`} />
          <Stat icon={Database} label="Tokens" value={formatNumber(summary?.totalTokens)} tone="green" />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Stat icon={BarChart3} label="p50 latency" value={`${formatNumber(summary?.p50LatencyMs)} ms`} />
          <Stat icon={BarChart3} label="p90 latency" value={`${formatNumber(summary?.p90LatencyMs)} ms`} />
          <Stat icon={BarChart3} label="p95 latency" value={`${formatNumber(summary?.p95LatencyMs)} ms`} tone="amber" />
        </section>

        {alerts.length > 0 ? (
          <section className="grid gap-3 md:grid-cols-2">
            {alerts.slice(0, 6).map((alert) => (
              <div
                key={`${alert.level}:${alert.title}:${alert.detail}`}
                className={`rounded-md border p-3 text-sm ${
                  alert.level === "critical"
                    ? "border-red-500/50 bg-red-950/35 text-red-100"
                    : "border-amber-500/50 bg-amber-950/35 text-amber-100"
                }`}
              >
                <div className="font-semibold">{alert.title}</div>
                <div className="mt-1 text-xs opacity-85">{alert.detail}</div>
              </div>
            ))}
          </section>
        ) : null}

        <RecommendationsPanel
          payload={recommendations}
          refreshing={refreshingRecommendations}
          onRefresh={() => void refreshRecommendationSnapshot()}
        />

        <ToolContextPanel
          payload={recommendations}
          refreshing={refreshingDiagnostics}
          onRefresh={() => void refreshDiagnostics()}
        />

        <section className="grid gap-4 xl:grid-cols-3">
          <GroupTable title="Calls by surface" rows={metrics?.bySurface ?? []} />
          <GroupTable title="Calls by model" rows={metrics?.byModel ?? []} />
          <GroupTable title="Calls by provider" rows={metrics?.byProvider ?? []} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Recent AI calls</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Surface</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Error</th>
                    <th className="py-2 pr-4">HTTP</th>
                    <th className="py-2 pr-4">Retries</th>
                    <th className="py-2 pr-4">Fallback</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-4">Cache</th>
                    <th className="py-2 pr-4">Trace</th>
                    <th className="py-2 pr-4">Prompt</th>
                    <th className="py-2 pr-4">Schema</th>
                    <th className="py-2 pr-4">Tools</th>
                    <th className="py-2 pr-4">Eval fixture</th>
                    <th className="py-2 pr-4">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {(calls?.rows ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="py-2 pr-4">{row.surface}</td>
                      <td className="py-2 pr-4">{row.status}</td>
                      <td className="py-2 pr-4">{row.model ?? "n/a"}</td>
                      <td className="py-2 pr-4">{row.provider ?? "n/a"}</td>
                      <td className="py-2 pr-4">{row.error_type ?? "n/a"}</td>
                      <td className="py-2 pr-4">{formatNumber(row.http_status)}</td>
                      <td className="py-2 pr-4">{formatNumber(row.retry_count ?? Math.max(0, (row.attempts ?? 1) - 1))}</td>
                      <td className="py-2 pr-4">{row.fallback_used ? row.fallback_reason ?? "used" : "no"}</td>
                      <td className="py-2 pr-4">
                        {formatNumber(row.input_tokens)} / {formatNumber(row.output_tokens)}
                      </td>
                      <td className="py-2 pr-4">{row.cache_hit ? "yes" : "no"}</td>
                      <td className="max-w-[11rem] truncate py-2 pr-4" title={row.trace_id ?? undefined}>{row.trace_id ?? "n/a"}</td>
                      <td className="py-2 pr-4">{row.prompt_version ?? "n/a"}</td>
                      <td className="py-2 pr-4">{row.output_schema_version ?? "n/a"}</td>
                      <td className="py-2 pr-4">{formatNumber(row.tool_calls_used)}</td>
                      <td className="py-2 pr-4">{row.eval_fixture_id ?? "n/a"}</td>
                      <td className="py-2 pr-4">{formatNumber(row.latency_ms)} ms</td>
                    </tr>
                  ))}
                  {(calls?.rows ?? []).length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={18}>
                        No calls in this window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-cyan-200" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Eval coverage</h2>
            </div>
            <div className="mt-3 text-2xl font-semibold">{formatNumber(evals?.totalFixtures)} fixtures</div>
            <div className="mt-4 space-y-2">
              {(evals?.surfaces ?? []).map((row) => (
                <div key={row.surface} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">{row.surface}</span>
                  <span className={row.status === "covered" ? "text-emerald-200" : "text-amber-200"}>
                    {row.status} ({row.fixtures})
                  </span>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={submitFeedback} className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Record learning signal</h2>
            <div className="mt-4 grid gap-3">
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={feedbackDraft.surface}
                onChange={(event) =>
                  setFeedbackDraft((draft) => ({ ...draft, surface: event.target.value }))
                }
                aria-label="Feedback surface"
              >
                {SURFACES.filter((item) => item.value !== "all").map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={feedbackDraft.sourceId}
                onChange={(event) =>
                  setFeedbackDraft((draft) => ({ ...draft, sourceId: event.target.value }))
                }
                placeholder="Source ID"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={feedbackDraft.outcome}
                  onChange={(event) =>
                    setFeedbackDraft((draft) => ({ ...draft, outcome: event.target.value }))
                  }
                  aria-label="Feedback outcome"
                >
                  {OUTCOMES.map((outcome) => (
                    <option key={outcome.value} value={outcome.value}>
                      {outcome.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={feedbackDraft.rating}
                  onChange={(event) =>
                    setFeedbackDraft((draft) => ({ ...draft, rating: event.target.value }))
                  }
                  type="number"
                  min={1}
                  max={5}
                  aria-label="Rating"
                />
              </div>
              <textarea
                className="min-h-24 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={feedbackDraft.reason}
                onChange={(event) =>
                  setFeedbackDraft((draft) => ({ ...draft, reason: event.target.value }))
                }
                placeholder="Sanitized note"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-950 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Save signal
              </button>
            </div>
          </form>

          <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Recent feedback</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Metadata-only learning signals. Raw prompts, outputs, and edited text stay out of telemetry.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-emerald-500/35 bg-emerald-950/25 p-2 text-emerald-100">
                  <div className="font-semibold uppercase tracking-wide">Accepted</div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(feedbackSummary?.outcomeCounts?.accepted)}</div>
                </div>
                <div className="rounded-md border border-amber-500/35 bg-amber-950/25 p-2 text-amber-100">
                  <div className="font-semibold uppercase tracking-wide">Edited</div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(feedbackSummary?.outcomeCounts?.edited)}</div>
                </div>
                <div className="rounded-md border border-red-500/35 bg-red-950/25 p-2 text-red-100">
                  <div className="font-semibold uppercase tracking-wide">Rejected</div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(feedbackSummary?.outcomeCounts?.rejected)}</div>
                </div>
              </div>
            </div>

            {(feedbackSummary?.needsReview ?? []).length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {feedbackSummary?.needsReview.slice(0, 4).map((row) => (
                  <div key={row.surface} className="rounded-md border border-amber-500/40 bg-amber-950/25 p-3 text-sm text-amber-100">
                    <div className="font-semibold">{row.surface}</div>
                    <div className="mt-1 text-xs">
                      {formatPercent(row.negativeRate)} revision pressure · 7-day delta {row.delta7DayCount >= 0 ? "+" : ""}
                      {row.delta7DayCount}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {(feedbackSummary?.bySurface ?? []).length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {feedbackSummary?.bySurface.slice(0, 6).map((row) => (
                  <div key={row.surface} className="rounded-md border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                    <div className="font-semibold text-slate-100">{row.surface}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{row.count} signals</span>
                      <span>{formatPercent(row.negativeRate)} revised</span>
                      <span>{formatPercent(row.fieldUsedRate)} field-used</span>
                      <span>7d {row.delta7DayCount >= 0 ? "+" : ""}{row.delta7DayCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Surface</th>
                    <th className="py-2 pr-4">Outcome</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {(feedback?.rows ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="py-2 pr-4">{row.surface}</td>
                      <td className="py-2 pr-4">{formatOutcomeLabel(row.outcome)}</td>
                      <td className="py-2 pr-4">{row.rating ?? "n/a"}</td>
                      <td className="py-2 pr-4">{row.source_id ?? row.ai_review_id ?? "n/a"}</td>
                      <td className="py-2 pr-4">{formatMetadata(row)}</td>
                    </tr>
                  ))}
                  {(feedback?.rows ?? []).length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={6}>
                        No feedback in this window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
