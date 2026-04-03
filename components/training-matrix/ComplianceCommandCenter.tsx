"use client";

import { useMemo } from "react";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import {
  buildComplianceDashboardModel,
  flattenCredentialLedger,
} from "@/lib/complianceDashboardModel";

function KpiCard({
  label,
  value,
  sub,
  trendLabel,
  borderAccent,
}: {
  label: string;
  value: string;
  sub?: string;
  trendLabel?: string;
  borderAccent: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-zinc-900/80 p-4 shadow-lg ${borderAccent} backdrop-blur-sm`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-400">{sub}</p> : null}
      {trendLabel ? (
        <p className="mt-1 text-xs font-medium text-emerald-400">{trendLabel}</p>
      ) : null}
    </div>
  );
}

function StaticOutcomeSummary({
  met,
  gap,
  na,
  compliancePct,
}: {
  met: number;
  gap: number;
  na: number;
  compliancePct: number;
}) {
  const total = met + gap + na;
  if (total <= 0) {
    return <p className="mt-6 text-sm text-zinc-500">No check cells yet.</p>;
  }
  const wMet = (met / total) * 100;
  const wGap = (gap / total) * 100;
  const wNa = (na / total) * 100;
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-950/60 py-6">
        <p className="font-mono text-4xl font-bold text-white">{compliancePct}%</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">in-scope met</p>
      </div>
      <p className="text-[11px] text-zinc-500">Share of all person × requirement cells</p>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {wMet > 0 ? (
          <div
            className="h-full bg-cyan-500"
            style={{ width: `${wMet}%` }}
            title={`Met ${met}`}
          />
        ) : null}
        {wGap > 0 ? (
          <div
            className="h-full bg-fuchsia-500"
            style={{ width: `${wGap}%` }}
            title={`Gap ${gap}`}
          />
        ) : null}
        {wNa > 0 ? (
          <div
            className="h-full bg-zinc-600"
            style={{ width: `${wNa}%` }}
            title={`N/A ${na}`}
          />
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs text-zinc-400">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400" /> Met ({met})
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-fuchsia-400" /> Gap ({gap})
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-500" /> N/A ({na})
        </li>
      </ul>
    </div>
  );
}

function StaticGapsByRequirement({
  bars,
}: {
  bars: Array<{ name: string; gaps: number; fullTitle: string }>;
}) {
  const maxGaps = Math.max(1, ...bars.map((b) => b.gaps));
  return (
    <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
      {bars.length === 0 ? (
        <p className="text-sm text-zinc-500">No requirements to compare.</p>
      ) : (
        bars.map((b) => (
          <div key={b.fullTitle} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-zinc-300" title={b.fullTitle}>
                {b.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-zinc-500">{b.gaps}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-fuchsia-500/90"
                style={{ width: `${(b.gaps / maxGaps) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type RowInput = Parameters<typeof buildComplianceDashboardModel>[0][number];
type ReqInput = Parameters<typeof buildComplianceDashboardModel>[1][number];

export function ComplianceCommandCenter({
  rows,
  requirements,
  loading,
  workspaceDataLoaded,
  warning,
  onRefresh,
  children,
  footer,
}: {
  rows: RowInput[];
  requirements: ReqInput[];
  loading: boolean;
  workspaceDataLoaded: boolean;
  warning: string | null;
  onRefresh: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const model = useMemo(
    () => buildComplianceDashboardModel(rows, requirements),
    [rows, requirements]
  );

  const flatCreds = useMemo(() => flattenCredentialLedger(rows), [rows]);

  const shell = (inner: React.ReactNode) => (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl ring-1 ring-zinc-700/40">
      <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400">
              Compliance command center
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Training & credentials
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Snapshot of requirement checks and profile credentials. Opens with a fresh fetch; use Refresh
              for the latest — no background polling.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? workspaceDataLoaded
                ? "Refreshing…"
                : "Loading…"
              : "Refresh data"}
          </button>
        </div>
      </div>
      {inner}
    </div>
  );

  if (!workspaceDataLoaded && !loading) {
    return shell(
      <div className="px-6 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center">
          <p className="text-lg font-semibold text-white">Compliance data not loaded</p>
          <p className="mt-2 text-sm text-zinc-400">
            Use <span className="font-semibold text-fuchsia-400">Refresh data</span> in the page header or
            above — the page normally loads workspace data automatically when you open it.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !workspaceDataLoaded) {
    return shell(
      <div className="px-6 py-12">
        <InlineMessage tone="neutral">
          <span className="text-zinc-200">Loading compliance workspace…</span>
        </InlineMessage>
      </div>
    );
  }

  if (rows.length === 0) {
    return shell(
      <div className="px-6 py-14">
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
          <p className="text-lg font-semibold text-white">No team members to show</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {warning
              ? "Fix the configuration warning above, or invite users to this workspace."
              : "Invite users and ensure they complete their construction profile certifications."}
          </p>
        </div>
      </div>
    );
  }

  return shell(
    <>
      {loading && workspaceDataLoaded ? (
        <div className="border-b border-cyan-500/20 bg-cyan-950/40 px-6 py-2 text-center text-sm text-cyan-200">
          Refreshing summaries and matrix…
        </div>
      ) : null}
      {model ? (
        <>
          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Workspace roster"
              value={String(model.totalPeople)}
              sub={`${model.totalRequirements} requirement${model.totalRequirements === 1 ? "" : "s"} configured`}
              borderAccent="border-cyan-500/25"
            />
            <KpiCard
              label="In-scope compliance"
              value={`${model.compliancePct}%`}
              sub={`${model.met} met · ${model.gap} gaps (N/A excluded)`}
              trendLabel={
                model.scoped > 0
                  ? `${model.fullyCompliantPeople} of ${model.totalPeople} fully clear in-scope rules`
                  : undefined
              }
              borderAccent="border-fuchsia-500/25"
            />
            <KpiCard
              label="Met · expiring soon"
              value={String(model.metExpiringSoon)}
              sub="Requirement cells still met, renewal pressure"
              borderAccent="border-amber-500/25"
            />
            <KpiCard
              label="Credential risk"
              value={String(model.expiredCreds + model.soonCreds)}
              sub={`${model.expiredCreds} expired · ${model.soonCreds} expiring on profile`}
              borderAccent="border-rose-500/25"
            />
          </div>

          <div className="grid gap-6 px-6 pb-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Gaps by requirement</p>
              <p className="mt-1 text-[11px] text-zinc-500">People missing each rule (in scope), static bars</p>
              <StaticGapsByRequirement bars={model.requirementBars} />
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 lg:col-span-4">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Check outcomes</p>
              <p className="mt-1 text-[11px] text-zinc-500">All person × requirement cells (CSS only)</p>
              <StaticOutcomeSummary
                met={model.met}
                gap={model.gap}
                na={model.na}
                compliancePct={model.compliancePct}
              />
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 lg:col-span-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">By trade</p>
              <p className="mt-1 text-[11px] text-zinc-500">% of in-scope checks met</p>
              <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                {model.tradeBars.length === 0 ? (
                  <p className="text-sm text-zinc-500">No scoped checks by trade yet.</p>
                ) : (
                  model.tradeBars.map((t) => (
                    <div key={t.fullTrade}>
                      <div className="flex justify-between gap-2 text-[11px] text-zinc-400">
                        <span className="truncate font-medium text-zinc-300" title={t.fullTrade}>
                          {t.name}
                        </span>
                        <span className="shrink-0 font-mono text-cyan-300">{t.pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500"
                          style={{ width: `${Math.min(100, t.pct)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        {t.met}/{t.scoped} checks met
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="px-6 py-8">
          <p className="text-sm text-zinc-400">
            Add at least one training requirement to unlock summaries. You can still review people below.
          </p>
        </div>
      )}

      <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Requirement matrix</p>
        <p className="mt-1 text-sm text-zinc-500">
          Per-person grid with position/trade rollups and requirement columns.
        </p>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-4 text-zinc-500">{footer}</div> : null}
      </div>

      {flatCreds.length > 0 ? (
        <div className="border-t border-zinc-800 bg-zinc-900/30 px-4 py-6 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Credential ledger</p>
          <p className="mt-1 text-sm text-zinc-500">
            Every certification on file with expiry health (sortable view of profile credentials).
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/90">
                  <th className="px-4 py-3 font-semibold text-zinc-300">Person</th>
                  <th className="px-4 py-3 font-semibold text-zinc-300">Certification</th>
                  <th className="px-4 py-3 font-semibold text-zinc-300">Expiration</th>
                  <th className="px-4 py-3 font-semibold text-zinc-300">Status</th>
                  <th className="hidden px-4 py-3 font-semibold text-zinc-300 md:table-cell">Email</th>
                </tr>
              </thead>
              <tbody>
                {flatCreds.map((c, idx) => (
                  <tr
                    key={`${c.userId}-${c.cert}-${idx}`}
                    className="border-b border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-white">{c.person}</td>
                    <td className="max-w-[220px] px-4 py-2.5 text-zinc-300">{c.cert}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-zinc-400">
                      {c.expiresOn ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          c.statusKey === "expired"
                            ? "rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/40"
                            : c.statusKey === "soon"
                              ? "rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40"
                              : c.statusKey === "ok"
                                ? "rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/35"
                                : "rounded-full bg-zinc-700/50 px-2.5 py-0.5 text-xs font-semibold text-zinc-300 ring-1 ring-zinc-600"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="hidden max-w-[200px] truncate px-4 py-2.5 text-xs text-zinc-500 md:table-cell">
                      {c.email || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
