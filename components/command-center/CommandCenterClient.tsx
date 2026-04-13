"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { InlineMessage, SectionCard } from "@/components/WorkspacePrimitives";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type WorkspaceRow = Record<string, unknown>;

type WorkspaceSummary = {
  observations?: WorkspaceRow[];
  daps?: WorkspaceRow[];
  permits?: WorkspaceRow[];
  incidents?: WorkspaceRow[];
  reports?: WorkspaceRow[];
  error?: string;
};

type AnalyticsSummaryPayload = {
  summary?: {
    companyDashboard?: {
      totalOpenObservations?: number;
      openIncidents?: number;
      totalActiveJobsites?: number;
    };
    riskMemory?: {
      windowDays?: number;
      facetCount?: number;
      topScopes?: Array<{ code: string | null; count: number }>;
      topHazards?: Array<{ code: string | null; count: number }>;
      aggregatedWithBaseline?: { score: number; band: string };
      aggregated?: { score: number; band: string; sampleSize?: number };
    };
    riskMemoryRecommendations?: Array<{
      id: string;
      kind: string;
      title: string;
      body: string;
      confidence: number;
      created_at: string;
    }>;
  };
  warning?: string;
  error?: string;
};

function str(v: unknown) {
  return String(v ?? "").trim();
}

function isObservationOpen(row: WorkspaceRow) {
  return str(row.status).toLowerCase() !== "verified_closed";
}

function isIncidentOpen(row: WorkspaceRow) {
  return str(row.status).toLowerCase() !== "closed";
}

function isPermitActive(row: WorkspaceRow) {
  return str(row.status).toLowerCase() === "active";
}

function permitStopWork(row: WorkspaceRow) {
  const s = str(row.stop_work_status);
  return s === "stop_work_active" || s === "stop_work_requested";
}

function isJsaInFlight(row: WorkspaceRow) {
  const s = str(row.status).toLowerCase();
  if (!s) return false;
  return s !== "completed" && s !== "archived";
}

function isReportDraftish(row: WorkspaceRow) {
  const s = str(row.status).toLowerCase();
  if (!s) return false;
  return s !== "published" && s !== "final";
}

function isOverdueObservation(row: WorkspaceRow) {
  if (!isObservationOpen(row)) return false;
  const due = str(row.due_at);
  if (!due) return false;
  const t = Date.parse(due);
  return Number.isFinite(t) && t < Date.now();
}

function StatTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-[rgba(79,125,243,0.2)] bg-white/80 px-4 py-3 shadow-sm transition hover:border-[rgba(79,125,243,0.45)] hover:shadow-md"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="mt-1 text-2xl font-black tracking-tight text-[var(--app-text-strong)]">{value}</span>
      {hint ? (
        <span className="mt-1 text-[11px] leading-snug text-slate-500 group-hover:text-slate-600">{hint}</span>
      ) : null}
    </Link>
  );
}

export function CommandCenterClient() {
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummaryPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [analyticsErr, setAnalyticsErr] = useState("");
  const [workspaceErr, setWorkspaceErr] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAnalyticsErr("");
    setWorkspaceErr("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAnalyticsErr("Sign in to load the command center.");
        setWorkspace(null);
        setAnalytics(null);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [aRes, wRes] = await Promise.all([
        fetchWithTimeoutSafe(`/api/company/analytics/summary?days=${days}`, { headers }, 20000, "Analytics"),
        fetchWithTimeoutSafe("/api/company/workspace/summary", { headers }, 20000, "Workspace"),
      ]);
      const aJson = (await aRes.json().catch(() => null)) as AnalyticsSummaryPayload | null;
      const wJson = (await wRes.json().catch(() => null)) as WorkspaceSummary | null;
      if (!aRes.ok) {
        setAnalyticsErr(aJson?.error || "Could not load analytics summary.");
        setAnalytics(null);
      } else {
        setAnalytics(aJson);
      }
      if (!wRes.ok) {
        setWorkspaceErr(wJson?.error || "Could not load workspace summary.");
        setWorkspace(null);
      } else {
        setWorkspace(wJson);
      }
      setLastLoadedAt(new Date());
    } catch (e) {
      setAnalyticsErr(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWork = useMemo(() => {
    const obs = workspace?.observations ?? [];
    const inc = workspace?.incidents ?? [];
    const pm = workspace?.permits ?? [];
    const jsas = workspace?.daps ?? [];
    const reps = workspace?.reports ?? [];
    return {
      openObservations: obs.filter(isObservationOpen).length,
      overdueObservations: obs.filter(isOverdueObservation).length,
      openIncidents: inc.filter(isIncidentOpen).length,
      activePermits: pm.filter(isPermitActive).length,
      stopWorkPermits: pm.filter(permitStopWork).length,
      openJsas: jsas.filter(isJsaInFlight).length,
      openReports: reps.filter(isReportDraftish).length,
    };
  }, [workspace]);

  const risk = analytics?.summary?.riskMemory;
  const recs = analytics?.summary?.riskMemoryRecommendations ?? [];
  const band = risk?.aggregatedWithBaseline?.band ?? risk?.aggregated?.band ?? "—";
  const score = risk?.aggregatedWithBaseline?.score ?? risk?.aggregated?.score ?? null;

  return (
    <div className="analytics-workspace-light min-h-[calc(100vh-4rem)] rounded-[1.5rem] border border-[rgba(79,125,243,0.18)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(237,244,255,0.96)_100%)] text-[var(--app-text)] shadow-[0_20px_48px_rgba(79,125,243,0.12)]">
      <div className="border-b border-[rgba(198,212,236,0.85)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] px-5 py-6 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-400/90">Command center</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Risk, memory & open work</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              One place for Risk Memory signals, the company memory bank, and what still needs attention in your
              workspace. All data stays scoped to your company.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  days === d ? "bg-cyan-500 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700",
                ].join(" ")}
              >
                {d}d risk window
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-full bg-[linear-gradient(135deg,#4f7df3_0%,#5b92ff_100%)] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-[0_16px_28px_rgba(79,125,243,0.24)] transition hover:brightness-105 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        <details className="rounded-2xl border border-[rgba(79,125,243,0.22)] bg-[rgba(79,125,243,0.06)] px-4 py-3 text-[var(--app-text)] shadow-sm open:pb-4">
          <summary className="cursor-pointer list-none text-sm font-bold text-[var(--app-text-strong)] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              How to use this page
              <span className="text-xs font-normal text-slate-500">(click to expand)</span>
            </span>
          </summary>
          <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-slate-600">
            <li>
              Click <strong className="text-[var(--app-text-strong)]">Refresh</strong> to pull the latest data. Choose{" "}
              <strong className="text-[var(--app-text-strong)]">30d</strong> or <strong className="text-[var(--app-text-strong)]">90d</strong>{" "}
              for the Risk Memory window (rollups and the analytics line below use that range).
            </li>
            <li>
              Read <strong className="text-[var(--app-text-strong)]">Risk Memory</strong> for scope/hazard emphasis, then use{" "}
              <strong className="text-[var(--app-text-strong)]">Full analytics</strong> for charts or{" "}
              <strong className="text-[var(--app-text-strong)]">Risk Memory setup</strong> to tune fields.
            </li>
            <li>
              Use <strong className="text-[var(--app-text-strong)]">Open work</strong> tiles—each links to the right module (Issues,
              Incidents, Permits, JSA, Reports). Clear items there, then refresh here to see counts drop.
            </li>
            <li>
              Scan <strong className="text-[var(--app-text-strong)]">Recommendations</strong> for company-only suggestions; expand the{" "}
              <strong className="text-[var(--app-text-strong)]">Company memory bank</strong> to add context your team and copilots can reuse.
            </li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            All data is scoped to your company. A longer guide for admins lives in the repository at{" "}
            <code className="rounded bg-white/60 px-1 py-0.5 text-[11px] text-[var(--app-text-strong)]">docs/command-center.md</code>
            (linked from the project README).
          </p>
        </details>

        {analytics?.warning ? <InlineMessage tone="neutral">{analytics.warning}</InlineMessage> : null}
        {analyticsErr ? <InlineMessage tone="error">{analyticsErr}</InlineMessage> : null}
        {workspaceErr ? <InlineMessage tone="warning">{workspaceErr}</InlineMessage> : null}
        {!analyticsErr && !workspaceErr && lastLoadedAt ? (
          <p className="text-xs text-slate-500">
            Last updated {lastLoadedAt.toLocaleString()}. Open-work counts use the latest workspace snapshot (up to 500
            rows per list). Risk Memory uses the selected window.
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Risk Memory"
            description="Rollup for the selected window. Tune taxonomy and baselines in setup."
          >
            {risk ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-black text-[var(--app-text-strong)]">{band}</span>
                  {score != null ? (
                    <span className="text-sm font-semibold text-slate-600">Score {Number(score).toFixed(1)}</span>
                  ) : null}
                  <span className="text-xs text-slate-500">
                    {risk.facetCount ?? 0} facets · {risk.windowDays ?? days}d
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top scopes</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--app-text-strong)]">
                      {(risk.topScopes ?? []).slice(0, 5).map((row, i) => (
                        <li key={`${row.code ?? "x"}-${i}`}>
                          <span className="font-mono text-xs text-slate-600">{row.code ?? "—"}</span>
                          <span className="ml-2 text-slate-500">×{row.count}</span>
                        </li>
                      ))}
                      {!risk.topScopes?.length ? <li className="text-slate-500">No scope rollup yet.</li> : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top hazards</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--app-text-strong)]">
                      {(risk.topHazards ?? []).slice(0, 5).map((row, i) => (
                        <li key={`${row.code ?? "h"}-${i}`}>
                          <span className="font-mono text-xs text-slate-600">{row.code ?? "—"}</span>
                          <span className="ml-2 text-slate-500">×{row.count}</span>
                        </li>
                      ))}
                      {!risk.topHazards?.length ? <li className="text-slate-500">No hazard rollup yet.</li> : null}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/analytics"
                    className="rounded-full border border-[rgba(79,125,243,0.35)] px-3 py-1.5 text-xs font-bold text-[var(--app-accent-primary)] hover:bg-[rgba(79,125,243,0.08)]"
                  >
                    Full analytics
                  </Link>
                  <Link
                    href="/settings/risk-memory"
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Risk Memory setup
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                {loading ? "Loading Risk Memory…" : "Risk Memory is not available for this account or window."}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Open work" description="Current items from your workspace lists (jobsite-scoped when applicable).">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                label="Open issues"
                value={openWork.openObservations}
                href="/field-id-exchange"
                hint="Corrective actions not verified closed"
              />
              <StatTile
                label="Overdue"
                value={openWork.overdueObservations}
                href="/field-id-exchange"
                hint="Open with past due date"
              />
              <StatTile label="Open incidents" value={openWork.openIncidents} href="/incidents" />
              <StatTile label="Active permits" value={openWork.activePermits} href="/permits" />
              <StatTile
                label="Stop work"
                value={openWork.stopWorkPermits}
                href="/permits"
                hint="Requested or active"
              />
              <StatTile label="JSAs in flight" value={openWork.openJsas} href="/jsa" />
              <StatTile label="Reports (draft)" value={openWork.openReports} href="/reports" />
            </div>
            {analytics?.summary?.companyDashboard ? (
              <p className="mt-4 text-xs text-slate-500">
                Window KPIs (analytics): {analytics.summary.companyDashboard.totalOpenObservations ?? "—"} open
                observations, {analytics.summary.companyDashboard.openIncidents ?? "—"} open incidents in the selected
                range.
              </p>
            ) : null}
          </SectionCard>
        </div>

        <SectionCard
          title="Recommendations"
          description="Stored AI recommendations for your company (not shared across tenants)."
        >
          {recs.length ? (
            <ul className="space-y-3">
              {recs.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-[var(--app-text-strong)]"
                >
                  <p className="font-bold">{r.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{r.body}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">
                    {r.kind} · confidence {Math.round((r.confidence ?? 0) * 100)}%
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              No active recommendations. They appear as Risk Memory and other flows generate them.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Company memory bank"
          description="Pinned context your team and copilots can reuse."
        >
          <CompanyMemoryBankPanel />
        </SectionCard>
      </div>
    </div>
  );
}
