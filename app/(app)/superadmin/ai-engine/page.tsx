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
} from "lucide-react";

const SURFACES = [
  { value: "all", label: "All surfaces" },
  { value: "safety-intelligence", label: "Safety Intelligence" },
  { value: "company-memory", label: "Company memory" },
  { value: "permit-copilot", label: "Permit copilot" },
  { value: "csep-review", label: "CSEP review" },
  { value: "gc-review", label: "GC review" },
  { value: "injury-weather", label: "Injury/weather" },
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
};

type CallRow = {
  id: string | number;
  created_at: string;
  surface: string;
  model: string | null;
  provider: string | null;
  latency_ms: number | null;
  status: string;
  http_status: number | null;
  attempts: number | null;
  fallback_used: boolean | null;
  fallback_reason: string | null;
  total_tokens: number | null;
  error_message: string | null;
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
};

type FeedbackPayload = {
  rows: FeedbackRow[];
  count: number;
  unavailable: boolean;
  reason: string | null;
};

type EvalPayload = {
  totalFixtures: number;
  rootAvailable: boolean;
  surfaces: Array<{ surface: string; fixtures: number; status: string }>;
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
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-400" colSpan={5}>
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

export default function SuperadminAiEnginePage() {
  const [surface, setSurface] = useState("all");
  const [windowDays, setWindowDays] = useState(7);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [calls, setCalls] = useState<CallsPayload | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [evals, setEvals] = useState<EvalPayload | null>(null);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsResponse, callsResponse, feedbackResponse, evalsResponse] = await Promise.all([
        fetch(`/api/superadmin/ai-engine/metrics?${query}`),
        fetch(`/api/superadmin/ai-engine/calls?${query}&limit=50`),
        fetch(`/api/superadmin/ai-engine/feedback?${query}&limit=50`),
        fetch("/api/superadmin/ai-engine/evals"),
      ]);

      if (!metricsResponse.ok || !callsResponse.ok || !feedbackResponse.ok || !evalsResponse.ok) {
        throw new Error("Superadmin AI Engine data is unavailable.");
      }

      setMetrics(await metricsResponse.json());
      setCalls(await callsResponse.json());
      setFeedback(await feedbackResponse.json());
      setEvals(await evalsResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load AI Engine operations.");
    } finally {
      setLoading(false);
    }
  }, [query]);

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

  const summary = metrics?.summary;

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
              Service-role telemetry, fallback health, learning signals, and eval coverage for the platform AI
              control plane.
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
            Service-role telemetry is not configured: {metrics.unavailableReason}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Activity} label="Calls" value={formatNumber(summary?.totalCalls)} tone="cyan" />
          <Stat icon={AlertTriangle} label="Fallback rate" value={formatPercent(summary?.fallbackRate)} tone="amber" />
          <Stat icon={CheckCircle2} label="Failure rate" value={formatPercent(summary?.failureRate)} tone="red" />
          <Stat icon={BarChart3} label="Avg latency" value={`${formatNumber(summary?.averageLatencyMs)} ms`} />
          <Stat icon={Database} label="Tokens" value={formatNumber(summary?.totalTokens)} tone="green" />
        </section>

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
                    <th className="py-2 pr-4">Fallback</th>
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
                      <td className="py-2 pr-4">{row.fallback_used ? row.fallback_reason ?? "used" : "no"}</td>
                      <td className="py-2 pr-4">{formatNumber(row.latency_ms)} ms</td>
                    </tr>
                  ))}
                  {(calls?.rows ?? []).length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={7}>
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
            <h2 className="text-sm font-semibold text-slate-100">Recent feedback</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Surface</th>
                    <th className="py-2 pr-4">Outcome</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2 pr-4">Source</th>
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
                    </tr>
                  ))}
                  {(feedback?.rows ?? []).length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={5}>
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
