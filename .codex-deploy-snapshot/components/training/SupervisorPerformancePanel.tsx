"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  SectionCard,
  StatusBadge,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type SafetySignal = {
  label?: string;
  detail?: string;
  points?: number;
  count?: number;
};

type EvidenceRef = {
  id?: string;
  label?: string;
  href?: string;
  sourceModule?: string;
  detail?: string;
};

type SupervisorScore = {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  roleLabel?: string;
  windowStart?: string;
  windowEnd?: string;
  score: number;
  grade: string;
  trend: number;
  lastScoredAt?: string;
  positiveSignals?: SafetySignal[];
  negativeSignals?: SafetySignal[];
  evidenceRefs?: EvidenceRef[];
  coachingPrompt?: string;
};

type ScoresResponse = {
  scores?: SupervisorScore[];
  windowStart?: string;
  windowEnd?: string;
  error?: string;
};

type ViewFilter = "supervisors" | "all" | "attention" | "top";
type SortMode = "lowest" | "highest" | "trend";
type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scoreTone(score: number): BadgeTone {
  if (score >= 85) return "success";
  if (score >= 72) return "info";
  if (score >= 60) return "warning";
  return "error";
}

function trendLabel(trend: number) {
  if (trend > 0) return `+${trend} pts`;
  if (trend < 0) return `${trend} pts`;
  return "Steady";
}

function performanceLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Watch";
  if (score >= 60) return "Needs coaching";
  return "At risk";
}

function isSupervisor(score: SupervisorScore) {
  const label = `${score.role ?? ""} ${score.roleLabel ?? ""}`.toLowerCase();
  return (
    label.includes("field_supervisor") ||
    label.includes("supervisor") ||
    label.includes("foreman") ||
    label.includes("superintendent")
  );
}

function formatDate(value?: string) {
  if (!value) return "Current window";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Current window";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function average(scores: SupervisorScore[]) {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((total, score) => total + score.score, 0) / scores.length);
}

function getProfileHref(userId: string) {
  return `/profile?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent("/training")}`;
}

export function SupervisorPerformancePanel() {
  const [scores, setScores] = useState<SupervisorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState("30");
  const [view, setView] = useState<ViewFilter>("supervisors");
  const [sort, setSort] = useState<SortMode>("lowest");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [windowRange, setWindowRange] = useState<{ start?: string; end?: string }>({});

  const loadScores = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Sign in to view supervisor performance rates.");
      }

      const response = await fetch(`/api/company/leadership-safety-scores?days=${encodeURIComponent(days)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await response.json().catch(() => null)) as ScoresResponse | null;
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load supervisor performance rates.");
      }

      const nextScores = (data?.scores ?? [])
        .filter((score) => Number.isFinite(score.score))
        .map((score) => ({
          ...score,
          score: clamp(Math.round(score.score), 0, 100),
          trend: Number.isFinite(score.trend) ? Math.round(score.trend) : 0,
        }));
      setScores(nextScores);
      setWindowRange({ start: data?.windowStart, end: data?.windowEnd });
      setSelectedId((current) =>
        current && nextScores.some((score) => score.userId === current)
          ? current
          : nextScores[0]?.userId ?? null
      );
    } catch (loadError) {
      setScores([]);
      setSelectedId(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load supervisor performance rates.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadScores();
    });
  }, [loadScores]);

  const filteredScores = useMemo(() => {
    const search = query.trim().toLowerCase();
    return scores
      .filter((score) => {
        if (view === "supervisors" && !isSupervisor(score)) return false;
        if (view === "attention" && score.score >= 75 && score.trend >= 0) return false;
        if (view === "top" && score.score < 85) return false;
        if (!search) return true;
        return `${score.name ?? ""} ${score.email ?? ""} ${score.roleLabel ?? ""}`
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => {
        if (sort === "highest") return b.score - a.score;
        if (sort === "trend") return a.trend - b.trend;
        return a.score - b.score;
      });
  }, [query, scores, sort, view]);

  const selectedScore = useMemo(
    () => filteredScores.find((score) => score.userId === selectedId) ?? filteredScores[0] ?? null,
    [filteredScores, selectedId]
  );

  const supervisorScores = useMemo(() => scores.filter(isSupervisor), [scores]);
  const summary = useMemo(() => {
    const source = view === "all" ? scores : supervisorScores;
    const attention = source.filter((score) => score.score < 75 || score.trend < 0).length;
    const improving = source.filter((score) => score.trend > 0).length;
    const positiveSignals = source.reduce((total, score) => total + (score.positiveSignals?.length ?? 0), 0);
    return {
      averageRate: average(source),
      attention,
      improving,
      positiveSignals,
      count: source.length,
    };
  }, [scores, supervisorScores, view]);

  const windowText = `${formatDate(windowRange.start)} to ${formatDate(windowRange.end)}`;
  const hasScores = filteredScores.length > 0;

  return (
    <SectionCard
      eyebrow="Leadership View"
      title="Supervisor Performance Rates"
      description="Interactive scorecards show how supervisors are performing across permits, JSAs, corrective actions, incident response, AI risk actions, and behavior-risk signals."
      tone="attention"
      aside={<StatusBadge label={windowText} tone="info" />}
      actions={
        <button
          type="button"
          onClick={() => void loadScores()}
          disabled={loading}
          className={`${appButtonSecondaryClassName} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      {error ? (
        <InlineMessage tone="warning" onRetry={loadScores} retryLabel="Retry">
          {error}
        </InlineMessage>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Average rate",
            value: loading ? "-" : `${summary.averageRate}%`,
            detail: `${summary.count} leader${summary.count === 1 ? "" : "s"} in scope`,
            icon: BarChart3,
            tone: scoreTone(summary.averageRate || 0),
          },
          {
            label: "Need coaching",
            value: loading ? "-" : String(summary.attention),
            detail: "Below 75% or trending down",
            icon: AlertTriangle,
            tone: summary.attention > 0 ? "warning" : "success",
          },
          {
            label: "Improving",
            value: loading ? "-" : String(summary.improving),
            detail: "Positive score trend",
            icon: TrendingUp,
            tone: "success",
          },
          {
            label: "Good signals",
            value: loading ? "-" : String(summary.positiveSignals),
            detail: "Evidence-backed positives",
            icon: ShieldCheck,
            tone: "info",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--app-border)] bg-white/86 p-4 shadow-[0_10px_22px_rgba(44,58,86,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
                  {item.value}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
                <item.icon aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--app-text)]">{item.detail}</p>
              <StatusBadge label={item.tone === "success" ? "Good" : item.tone === "warning" ? "Watch" : "Live"} tone={item.tone as BadgeTone} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Search supervisors</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or role"
            className="w-full rounded-lg border border-[var(--app-border)] bg-white py-2 pl-10 pr-3 text-sm text-[var(--app-text-strong)] shadow-[0_4px_10px_rgba(76,108,161,0.035)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
          />
        </label>
        <select
          value={view}
          onChange={(event) => setView(event.target.value as ViewFilter)}
          className={appNativeSelectClassName}
          aria-label="Filter performance rates"
        >
          <option value="supervisors">Supervisors only</option>
          <option value="all">All leadership</option>
          <option value="attention">Needs coaching</option>
          <option value="top">Top performers</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortMode)}
          className={appNativeSelectClassName}
          aria-label="Sort performance rates"
        >
          <option value="lowest">Lowest rate first</option>
          <option value="highest">Highest rate first</option>
          <option value="trend">Trend risk first</option>
        </select>
        <select
          value={days}
          onChange={(event) => setDays(event.target.value)}
          className={appNativeSelectClassName}
          aria-label="Select scoring window"
        >
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-[var(--app-border)] bg-white/78 p-5">
            <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          </div>
          <div className="h-80 animate-pulse rounded-2xl border border-[var(--app-border)] bg-white/78" />
        </div>
      ) : !hasScores ? (
        <EmptyState
          icon={UserRoundCheck}
          title="No supervisor rates match this view"
          description="Try a broader role filter or a longer scoring window. Rates appear when leadership score evidence exists for supervisors you are allowed to review."
          actionHref="/company-users"
          actionLabel="Review Company Users"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-[var(--app-border)] bg-white/84 p-4 shadow-[0_10px_22px_rgba(44,58,86,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--app-text-strong)]">Supervisor rate board</p>
                <p className="text-xs text-[var(--app-muted)]">{filteredScores.length} visible in this view</p>
              </div>
              <StatusBadge label={view === "all" ? "Leadership" : "Supervisors"} tone="info" />
            </div>
            <div className="mt-4 space-y-3">
              {filteredScores.map((score) => {
                const selected = selectedScore?.userId === score.userId;
                return (
                  <button
                    key={score.userId}
                    type="button"
                    onClick={() => setSelectedId(score.userId)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:border-[var(--app-accent-border-24)] hover:bg-[var(--app-accent-primary-soft)] ${
                      selected
                        ? "border-[var(--app-accent-border-24)] bg-[var(--app-accent-primary-soft)]"
                        : "border-[var(--app-border)] bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--app-text-strong)]">
                          {score.name || score.email || "Unnamed leader"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--app-muted)]">{score.roleLabel || score.role || "Leadership"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge label={`Grade ${score.grade}`} tone={scoreTone(score.score)} />
                        <span className="text-lg font-black text-[var(--app-text-strong)]">{score.score}%</span>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-[linear-gradient(90deg,_var(--semantic-warning)_0%,_var(--semantic-success)_100%)]"
                        style={{ width: `${score.score}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--app-muted)]">
                      <span className="inline-flex items-center gap-1">
                        {score.trend < 0 ? (
                          <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 text-[var(--semantic-warning)]" />
                        ) : score.trend > 0 ? (
                          <ArrowUp aria-hidden="true" className="h-3.5 w-3.5 text-[var(--semantic-success)]" />
                        ) : (
                          <Target aria-hidden="true" className="h-3.5 w-3.5 text-[var(--app-muted)]" />
                        )}
                        {trendLabel(score.trend)}
                      </span>
                      <span>{performanceLabel(score.score)}</span>
                      <span>{score.negativeSignals?.length ?? 0} coaching signal{(score.negativeSignals?.length ?? 0) === 1 ? "" : "s"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedScore ? (
            <div className="rounded-2xl border border-[var(--app-border)] bg-white/90 p-5 shadow-[0_10px_22px_rgba(44,58,86,0.05)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Selected supervisor
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-[var(--app-text-strong)]">
                    {selectedScore.name || selectedScore.email || "Unnamed leader"}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--app-text)]">{selectedScore.roleLabel || selectedScore.role}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={`${selectedScore.score}% rate`} tone={scoreTone(selectedScore.score)} />
                  <StatusBadge label={trendLabel(selectedScore.trend)} tone={selectedScore.trend < 0 ? "warning" : selectedScore.trend > 0 ? "success" : "neutral"} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Score</p>
                  <p className="mt-2 text-3xl font-black text-[var(--app-text-strong)]">{selectedScore.score}</p>
                </div>
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Grade</p>
                  <p className="mt-2 text-3xl font-black text-[var(--app-text-strong)]">{selectedScore.grade}</p>
                </div>
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Evidence</p>
                  <p className="mt-2 text-3xl font-black text-[var(--app-text-strong)]">
                    {selectedScore.evidenceRefs?.length ?? 0}
                  </p>
                </div>
              </div>

              <p className="mt-5 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-sm leading-6 text-[var(--app-text)]">
                {selectedScore.coachingPrompt || "Use the signals below to coach field follow-through and close out risk items before they age."}
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-text-strong)]">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[var(--semantic-success)]" />
                    Positive signals
                  </div>
                  <div className="mt-3 space-y-2">
                    {(selectedScore.positiveSignals ?? []).slice(0, 3).length > 0 ? (
                      (selectedScore.positiveSignals ?? []).slice(0, 3).map((signal, index) => (
                        <div key={`${signal.label}-${index}`} className="rounded-xl border border-[rgba(46,158,91,0.2)] bg-[var(--semantic-success-bg)] p-3">
                          <p className="text-xs font-bold text-[var(--semantic-success)]">{signal.label || "Positive signal"}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{signal.detail || "Positive evidence captured."}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-[var(--app-border)] bg-white p-3 text-xs leading-5 text-[var(--app-muted)]">
                        No positive signals in this window yet.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-text-strong)]">
                    <AlertTriangle aria-hidden="true" className="h-4 w-4 text-[var(--semantic-warning)]" />
                    Coaching signals
                  </div>
                  <div className="mt-3 space-y-2">
                    {(selectedScore.negativeSignals ?? []).slice(0, 3).length > 0 ? (
                      (selectedScore.negativeSignals ?? []).slice(0, 3).map((signal, index) => (
                        <div key={`${signal.label}-${index}`} className="rounded-xl border border-[rgba(217,164,65,0.24)] bg-[var(--semantic-warning-bg)] p-3">
                          <p className="text-xs font-bold text-[var(--semantic-warning)]">{signal.label || "Coaching signal"}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{signal.detail || "Follow-up needed."}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-[var(--app-border)] bg-white p-3 text-xs leading-5 text-[var(--app-muted)]">
                        No coaching signals were found in this window.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={getProfileHref(selectedScore.userId)} className={appButtonSecondaryClassName}>
                  Open Profile
                </Link>
                <Link href="/training-matrix" className={appButtonSecondaryClassName}>
                  Training Matrix
                </Link>
                {(selectedScore.evidenceRefs ?? []).slice(0, 2).map((ref, index) => (
                  <Link
                    key={ref.id || `${selectedScore.userId}-evidence-${index}`}
                    href={ref.href || "/reports"}
                    className={appButtonSecondaryClassName}
                  >
                    {ref.label || ref.sourceModule || "Evidence"}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
