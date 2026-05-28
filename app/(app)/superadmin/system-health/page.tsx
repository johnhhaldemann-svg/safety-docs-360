"use client";
import { deferEffect } from "@/lib/deferredEffect";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { PageHero, appButtonPrimaryClassName, appButtonSecondaryClassName } from "@/components/WorkspacePrimitives";
import type {
  PlatformCronRunSummary,
  PlatformPerformanceSnapshot,
} from "@/lib/superadmin/platformPerformanceHealth";
import type {
  IntegrationAuditCheck,
  IntegrationAuditResponse,
  IntegrationAuditStatus,
} from "@/lib/superadmin/integrationAuditTypes";
import type {
  SystemHealthCheck,
  SystemHealthConnection,
  SystemHealthResponse,
  SystemHealthSection,
  SystemHealthStatus,
} from "@/lib/superadmin/systemHealthTypes";
import {
  systemHealthStatusToTrafficLight,
  trafficLightBadgeClasses,
  trafficLightNodeRingClass,
} from "@/src/lib/dashboard/dashboardStatusSemantics";

const SECTION_LABELS: Record<string, string> = {
  data_foundation: "Data Foundation",
  memory_buckets: "Safety Memory Buckets",
  prevention_logic: "Prevention Logic Layer",
  intelligence_engine: "Smart Safety Intelligence Engine",
  protection_outputs: "Protection Outputs",
  field_feedback_loop: "Field Feedback Loop",
};

/** Card / diagram canonical order (bottom -> top flow, then left-to-right outputs). */
const SECTION_DISPLAY_ORDER = [
  "data_foundation",
  "memory_buckets",
  "prevention_logic",
  "intelligence_engine",
  "protection_outputs",
  "field_feedback_loop",
] as const;

function statusBadgeClasses(status: SystemHealthStatus) {
  if (status === "unknown") return "bg-slate-400/15 text-slate-700 ring-1 ring-slate-400/30";
  return trafficLightBadgeClasses(systemHealthStatusToTrafficLight(status));
}

function nodeRing(status: SystemHealthStatus) {
  if (status === "unknown") return "ring-2 ring-slate-300 border-slate-300/80";
  return trafficLightNodeRingClass(systemHealthStatusToTrafficLight(status));
}

function StatusIcon({ status }: { status: SystemHealthStatus }) {
  if (status === "healthy") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />;
  if (status === "critical") return <XCircle className="h-4 w-4 text-red-600" aria-hidden />;
  return <HelpCircle className="h-4 w-4 text-slate-500" aria-hidden />;
}

function formatStatusLabel(s: SystemHealthStatus) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function integrationStatusBadgeClasses(status: IntegrationAuditStatus) {
  return statusBadgeClasses(status);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function formatDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return " - ";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

function PerformanceAndCronCard({
  performance,
  cronRuns,
}: {
  performance?: PlatformPerformanceSnapshot;
  cronRuns?: PlatformCronRunSummary;
}) {
  return (
    <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--app-text-strong)]">Performance and cron telemetry</h2>
          <p className="mt-1 text-sm text-[var(--app-text)]">
            Database advisor hygiene, top table sizes, slow query samples, and latest platform job runs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {performance ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(performance.status)}`}>
              <StatusIcon status={performance.status} />
              DB {formatStatusLabel(performance.status)}
            </span>
          ) : null}
          {cronRuns ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(cronRuns.status)}`}>
              <StatusIcon status={cronRuns.status} />
              Cron {formatStatusLabel(cronRuns.status)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">Advisor clean</p>
          <dl className="mt-3 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt>Missing FK indexes</dt>
              <dd className="font-mono font-bold">{performance?.advisorSummary.missingForeignKeyIndexes ?? " - "}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Duplicate RLS groups</dt>
              <dd className="font-mono font-bold">{performance?.advisorSummary.duplicatePolicyGroups ?? " - "}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>RLS without policies</dt>
              <dd className="font-mono font-bold">{performance?.advisorSummary.rlsEnabledNoPolicyTables ?? " - "}</dd>
            </div>
          </dl>
          {performance?.message ? <p className="mt-3 text-xs leading-5 text-[var(--app-text)]">{performance.message}</p> : null}
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-white p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">Largest hot tables</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[var(--app-muted)]">
                <tr>
                  <th className="py-1 pr-3 font-semibold">Table</th>
                  <th className="py-1 pr-3 font-semibold">Rows</th>
                  <th className="py-1 pr-3 font-semibold">Size</th>
                  <th className="py-1 pr-3 font-semibold">Seq / idx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {(performance?.topTables ?? []).slice(0, 5).map((table) => (
                  <tr key={table.tableName}>
                    <td className="py-2 pr-3 font-mono text-[var(--app-text-strong)]">{table.tableName}</td>
                    <td className="py-2 pr-3">{table.liveRows.toLocaleString()}</td>
                    <td className="py-2 pr-3">{formatBytes(table.totalBytes)}</td>
                    <td className="py-2 pr-3">{table.seqScan.toLocaleString()} / {table.idxScan.toLocaleString()}</td>
                  </tr>
                ))}
                {performance && performance.topTables.length === 0 ? (
                  <tr>
                    <td className="py-3 text-[var(--app-muted)]" colSpan={4}>No table-size samples returned.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--app-border)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">Slow query samples</p>
          <ul className="mt-3 space-y-2">
            {(performance?.slowQueries ?? []).slice(0, 3).map((query, index) => (
              <li key={`${query.calls}-${index}`} className="rounded-lg bg-[var(--app-panel-soft)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
                  <span>{query.calls.toLocaleString()} calls</span>
                  <span>{query.meanExecMs.toFixed(1)} ms avg</span>
                </div>
                <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-5 text-[var(--app-muted)]">{query.querySample}</p>
              </li>
            ))}
            {performance && performance.slowQueries.length === 0 ? (
              <li className="text-sm text-[var(--app-muted)]">No pg_stat_statements samples returned.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">Recent cron runs</p>
          {cronRuns?.message ? <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{cronRuns.message}</p> : null}
          <ul className="mt-3 space-y-2">
            {(cronRuns?.jobs ?? []).slice(0, 5).map((job) => (
              <li key={`${job.jobName}-${job.startedAt}`} className="rounded-lg bg-[var(--app-panel-soft)] px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-[var(--app-text-strong)]">{job.jobName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${job.status === "failed" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {job.status}
                  </span>
                </div>
                <p className="mt-1 text-[var(--app-muted)]">
                  {new Date(job.startedAt).toLocaleString()} - {formatDuration(job.durationMs)}
                  {job.processedCount == null ? "" : ` - ${job.processedCount.toLocaleString()} processed`}
                </p>
                {job.errorMessage ? <p className="mt-1 text-red-700">{job.errorMessage}</p> : null}
              </li>
            ))}
            {cronRuns && cronRuns.jobs.length === 0 ? (
              <li className="text-sm text-[var(--app-muted)]">No cron telemetry has been recorded yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PlatformInfrastructureCard({ check, scanTime }: { check: SystemHealthCheck; scanTime: string }) {
  const checkedAt = check.lastCheckedAt ?? scanTime;
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-semibold capitalize text-[var(--app-text-strong)]">{check.name}</h3>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClasses(check.status)}`}>
          <StatusIcon status={check.status} />
          {formatStatusLabel(check.status)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">{check.message}</p>
      {check.recommendedFix ? (
        <p className="mt-2 text-sm font-medium text-amber-900/90">
          <span className="text-[var(--app-muted)]">Suggested fix: </span>
          {check.recommendedFix}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-[var(--app-muted)]">
        Last checked: <strong className="text-[var(--app-text)]">{new Date(checkedAt).toLocaleString()}</strong>
      </p>
    </div>
  );
}

function SectionCardBlock({
  section,
  expanded,
  onToggle,
}: {
  section: SystemHealthSection;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-5 shadow-[var(--app-shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(section.status)}`}>
              <StatusIcon status={section.status} />
              {formatStatusLabel(section.status)}
            </span>
            <h2 className="text-lg font-bold text-[var(--app-text-strong)]">{section.title}</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">{section.message}</p>
          {section.recommendedFix ? (
            <p className="mt-2 text-sm font-medium text-amber-900/90">
              <span className="text-[var(--app-muted)]">Suggested fix: </span>
              {section.recommendedFix}
            </p>
          ) : null}
          <dl className="mt-3 grid gap-2 text-xs text-[var(--app-muted)] sm:grid-cols-3">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-[var(--app-text)]">Records checked</dt>
              <dd className="font-mono text-sm text-[var(--app-text-strong)]">{section.recordsChecked}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-[var(--app-text)]">Warnings + critical</dt>
              <dd className="font-mono text-sm text-[var(--app-text-strong)]">{section.failedChecks}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-[var(--app-text)]">Last check</dt>
              <dd className="text-sm text-[var(--app-text-strong)]">
                {section.lastSuccessfulCheck ? new Date(section.lastSuccessfulCheck).toLocaleString() : " - "}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm font-semibold text-slate-800">
            Score {section.score}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--app-accent-primary)] hover:underline"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            View details
          </button>
        </div>
      </div>
      {expanded ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--app-border)] pt-4">
          {section.checks.map((c) => (
            <li
              key={c.name}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusIcon status={c.status} />
                <span className="font-semibold text-[var(--app-text-strong)]">{c.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClasses(c.status)}`}>
                  {c.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--app-text)]">{c.message}</p>
              {c.recommendedFix ? <p className="mt-1 text-xs text-amber-900/90">Fix: {c.recommendedFix}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function connectionArrowColor(status: SystemHealthStatus) {
  if (status === "critical") return "text-red-600";
  if (status === "warning") return "text-amber-700";
  if (status === "unknown") return "text-slate-500";
  return "text-emerald-600";
}

function getFlowEdge(
  connections: Map<string, SystemHealthConnection>,
  from: string,
  to: string
) {
  return connections.get(`${from}->${to}`);
}

function HorizontalEdge({
  connections,
  from,
  to,
}: {
  connections: Map<string, SystemHealthConnection>;
  from: string;
  to: string;
}) {
  const edge = getFlowEdge(connections, from, to);
  const st = edge?.status ?? "unknown";
  return (
    <div
      className={`flex min-w-[40px] max-w-[56px] shrink-0 flex-col items-center justify-center self-center px-0.5 ${connectionArrowColor(st)}`}
    >
      <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden />
      <span className="text-center text-[8px] font-bold leading-tight">{edge?.label ?? " - "}</span>
    </div>
  );
}

function VerticalEdge({
  connections,
  from,
  to,
}: {
  connections: Map<string, SystemHealthConnection>;
  from: string;
  to: string;
}) {
  const edge = getFlowEdge(connections, from, to);
  const st = edge?.status ?? "unknown";
  return (
    <div className={`flex flex-col items-center py-0.5 ${connectionArrowColor(st)}`}>
      <ArrowUp className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
      <span className="text-center text-[8px] font-bold leading-tight">{edge?.label ?? " - "}</span>
    </div>
  );
}

function LoopBackEdge({
  connections,
  from,
  to,
  caption,
  Icon,
}: {
  connections: Map<string, SystemHealthConnection>;
  from: string;
  to: string;
  caption: string;
  Icon: LucideIcon;
}) {
  const edge = getFlowEdge(connections, from, to);
  const st = edge?.status ?? "unknown";
  return (
    <div className={`flex max-w-[120px] flex-col items-center gap-0.5 ${connectionArrowColor(st)}`}>
      <div className="[&_svg_path]:stroke-[currentColor] [&_svg_path]:[stroke-dasharray:5_4] [&_svg_path]:[stroke-linecap:round]">
        <Icon className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
      </div>
      <span className="text-center text-[8px] font-bold leading-tight">{caption}</span>
      <span className="text-center text-[8px] font-semibold opacity-90">{edge?.label ?? " - "}</span>
    </div>
  );
}

function NodeCard({
  sections,
  id,
  className,
}: {
  sections: Map<string, SystemHealthSection>;
  id: string;
  className?: string;
}) {
  const section = sections.get(id);
  const status = section?.status ?? "unknown";
  const label = SECTION_LABELS[id] ?? id;
  return (
    <div
      className={`flex min-h-[88px] min-w-[100px] flex-col items-center justify-center rounded-2xl border bg-white/95 px-2 py-3 text-center shadow-sm sm:min-w-[112px] ${nodeRing(status)} ${className ?? ""}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Layer</span>
      <span className="mt-1 text-xs font-bold leading-tight text-slate-900">{label}</span>
      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClasses(status)}`}>
        {formatStatusLabel(status)}
      </span>
    </div>
  );
}

function FlowDiagram({
  sections,
  connections,
}: {
  sections: SystemHealthSection[];
  connections: SystemHealthConnection[];
}) {
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const connMap = useMemo(() => {
    const m = new Map<string, SystemHealthConnection>();
    for (const c of connections) {
      m.set(`${c.from}->${c.to}`, c);
    }
    return m;
  }, [connections]);

  /** Matches the Smart Safety reference: vertical stack under the engine, outputs branch right, dashed feedback from the field loop. */
  const spineCol = "flex w-[min(100%,118px)] shrink-0 flex-col items-center sm:w-[128px]";

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-1">
        <div className="flex w-full flex-wrap items-end justify-center gap-x-0.5 gap-y-2 sm:flex-nowrap sm:justify-center">
          <div className={spineCol}>
            <NodeCard sections={byId} id="intelligence_engine" className="w-full min-w-0" />
          </div>
          <HorizontalEdge connections={connMap} from="intelligence_engine" to="protection_outputs" />
          <NodeCard sections={byId} id="protection_outputs" className="min-w-[100px] shrink-0 sm:min-w-[112px]" />
          <HorizontalEdge connections={connMap} from="protection_outputs" to="field_feedback_loop" />
          <div className="flex shrink-0 flex-col items-center">
            <NodeCard sections={byId} id="field_feedback_loop" className="min-w-[108px] sm:min-w-[120px]" />
            <div className="mt-1 flex max-w-[220px] flex-wrap justify-center gap-2 sm:gap-3">
              <LoopBackEdge
                connections={connMap}
                from="field_feedback_loop"
                to="intelligence_engine"
                caption="Feedback -> engine"
                Icon={ArrowUpLeft}
              />
              <LoopBackEdge
                connections={connMap}
                from="field_feedback_loop"
                to="memory_buckets"
                caption="Feedback -> memory"
                Icon={ArrowDownLeft}
              />
            </div>
          </div>
        </div>

        <div className={spineCol}>
          <VerticalEdge connections={connMap} from="prevention_logic" to="intelligence_engine" />
          <NodeCard sections={byId} id="prevention_logic" className="w-full min-w-0" />
          <VerticalEdge connections={connMap} from="memory_buckets" to="prevention_logic" />
          <NodeCard sections={byId} id="memory_buckets" className="w-full min-w-0" />
          <VerticalEdge connections={connMap} from="data_foundation" to="memory_buckets" />
          <NodeCard sections={byId} id="data_foundation" className="w-full min-w-0" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--app-muted)]">
        {"Layout follows the Smart Safety architecture: foundation -> memory -> prevention -> intelligence, then deliverables"}
        and field feedback (dashed arrows) closing the loop. Edge colors reflect aggregated check status from the API.
      </p>
    </div>
  );
}

function issuesPanelItemsFromPayload(data: SystemHealthResponse) {
  const items: {
    section: string;
    name: string;
    message: string;
    fix: string | null;
    status: SystemHealthStatus;
  }[] = [];
  for (const s of data.sections) {
    for (const c of s.checks) {
      if (c.status === "critical" || c.status === "warning") {
        items.push({
          section: s.title,
          name: c.name,
          message: c.message,
          fix: c.recommendedFix,
          status: c.status,
        });
      }
    }
  }
  for (const c of data.platformInfrastructure ?? []) {
    if (c.status === "critical" || c.status === "warning") {
      items.push({
        section: "Infrastructure & core routes",
        name: c.name,
        message: c.message,
        fix: c.recommendedFix,
        status: c.status,
      });
    }
  }
  items.sort((a, b) => {
    if (a.status === b.status) return 0;
    if (a.status === "critical") return -1;
    if (b.status === "critical") return 1;
    return 0;
  });
  return items;
}

function IntegrationMapCard({ audit }: { audit: IntegrationAuditResponse }) {
  const statusOrder: Record<IntegrationAuditStatus, number> = {
    critical: 0,
    warning: 1,
    unknown: 2,
    healthy: 3,
  };
  const visibleChecks = [...audit.checks].sort((a, b) => {
    const rank = statusOrder[a.status] - statusOrder[b.status];
    return rank === 0 ? a.label.localeCompare(b.label) : rank;
  });

  return (
    <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--app-text-strong)]">Production integration map</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--app-text)]">
            Read-only evidence across Vercel, Supabase, auth, storage, workflows, scheduled jobs, and Safety AI.
            Broken or weak links are listed first.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--app-muted)]">Source of truth</p>
          <p className="font-mono font-bold text-[var(--app-text-strong)]">{audit.sourceOfTruth}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--app-border)] bg-slate-900 px-4 py-3 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Supabase ref</p>
          <p className="mt-1 break-all font-mono text-sm font-bold">{audit.project.supabaseRef ?? "unknown"}</p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Vercel project</p>
          <p className="mt-1 break-all font-mono text-sm font-bold text-[var(--app-text-strong)]">
            {audit.project.vercelProjectName ?? audit.project.vercelProjectId ?? "unknown"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Local migration</p>
          <p className="mt-1 font-mono text-sm font-bold text-[var(--app-text-strong)]">
            {audit.project.latestLocalMigration ?? "unknown"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Remote migration</p>
          <p className="mt-1 font-mono text-sm font-bold text-[var(--app-text-strong)]">
            {audit.project.latestRemoteMigration ?? "unknown"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">Connected nodes</p>
          <div className="mt-3 grid gap-2">
            {audit.nodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--app-text-strong)]">{node.label}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${integrationStatusBadgeClasses(node.status)}`}>
                    <StatusIcon status={node.status} />
                    {formatStatusLabel(node.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{node.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">Edges and handoffs</p>
          <div className="mt-3 grid gap-2">
            {audit.edges.map((edge) => (
              <div key={`${edge.from}-${edge.to}`} className="rounded-lg bg-[var(--app-panel-soft)] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--app-text-strong)]">
                    {edge.from} {"->"} {edge.to}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${integrationStatusBadgeClasses(edge.status)}`}>
                    {formatStatusLabel(edge.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--app-text)]">{edge.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/40 p-4">
        <p className="text-sm font-bold text-amber-950">Broken, risky, or unverified first</p>
        <ul className="mt-3 space-y-2">
          {visibleChecks.slice(0, 12).map((check: IntegrationAuditCheck) => (
            <li key={check.id} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${integrationStatusBadgeClasses(check.status)}`}>
                  <StatusIcon status={check.status} />
                  {formatStatusLabel(check.status)}
                </span>
                <span className="font-semibold text-[var(--app-text-strong)]">{check.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  {check.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--app-text)]">{check.message}</p>
              {check.evidence.length > 0 ? (
                <p className="mt-1 font-mono text-[11px] leading-5 text-[var(--app-muted)]">
                  {check.evidence.slice(0, 3).join(" | ")}
                </p>
              ) : null}
              {check.recommendedAction ? (
                <p className="mt-1 text-xs font-medium text-amber-950">Recommended: {check.recommendedAction}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-[var(--app-muted)]">
        Audit generated: <strong className="text-[var(--app-text)]">{new Date(audit.generatedAt).toLocaleString()}</strong>
        {" - "}
        Healthy {audit.summary.healthy}, warnings {audit.summary.warning}, critical {audit.summary.critical}, unknown {audit.summary.unknown}
      </p>
    </section>
  );
}

export default function SuperadminSystemHealthPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [audit, setAudit] = useState<IntegrationAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuditError(null);
    setForbidden(false);
    try {
      const res = await fetch("/api/superadmin/system-health", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : `Request failed (${res.status})`);
        setData(null);
        return;
      }
      const json = (await res.json()) as SystemHealthResponse;
      setData(json);

      const auditRes = await fetch("/api/superadmin/integration-audit", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (auditRes.status === 403) {
        setForbidden(true);
        setAudit(null);
        return;
      }
      if (!auditRes.ok) {
        const body = await auditRes.json().catch(() => ({}));
        setAuditError(typeof body.error === "string" ? body.error : `Integration audit failed (${auditRes.status})`);
        setAudit(null);
        return;
      }
      setAudit((await auditRes.json()) as IntegrationAuditResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load health data.");
      setData(null);
      setAudit(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => {
    void load();
  }), [load]);

  const issuesPanel = useMemo(() => (data ? issuesPanelItemsFromPayload(data) : []), [data]);
  const orderedSections = useMemo(() => {
    if (!data?.sections) return [];
    const rank = new Map<string, number>(SECTION_DISPLAY_ORDER.map((id, i) => [id, i]));
    return [...data.sections].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  }, [data]);
  const allClear = data && data.summary.warning === 0 && data.summary.critical === 0;

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-600" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-red-950">Access denied</h1>
          <p className="mt-2 text-sm text-red-900/90">
            Superadmin System Health is restricted to users with the <strong>Super Admin</strong> role. If you
            believe you should have access, contact a platform administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_45%,#0c4a6e_100%)] px-6 py-8 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-2 ring-1 ring-white/20">
              <Stethoscope className="h-8 w-8 text-cyan-200" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Superadmin</p>
              <h1 className="font-app-display text-2xl font-bold tracking-tight sm:text-3xl">Superadmin System Health</h1>
              <p className="mt-1 max-w-xl text-sm text-slate-200/90">
                Read-only checks across database, storage, core routes, and key tables. Results are plain-language signals
                with suggested fixes so prevention data stays trustworthy - field verification still owns the final call.
              </p>
            </div>
          </div>
          <button type="button" className={`${appButtonSecondaryClassName} !border-white/30 !bg-white/10 !text-white hover:!bg-white/20`} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run Health Check
          </button>
        </div>
      </header>

      <PageHero
        eyebrow="Platform diagnostics"
        title="Prevention-ready platform signals"
        description="Layered checks follow how data flows from foundation tables through memory, prevention logic, intelligence outputs, and field feedback. Use them to find missing controls in the stack - not as a substitute for jobsite verification."
        actions={
          <button type="button" className={appButtonPrimaryClassName} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Refresh scan
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}
      {auditError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Integration audit did not complete: {auditError}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--app-muted)]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Running health checks...
        </div>
      ) : null}

      {data ? (
        <>
          {allClear ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-50/90 px-5 py-4 text-emerald-950 shadow-sm">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="font-bold">All clear</p>
                <p className="text-sm text-emerald-900/90">No warnings or critical issues were detected in this scan.</p>
              </div>
            </div>
          ) : null}

          {audit ? <IntegrationMapCard audit={audit} /> : null}

          <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
            <h2 className="text-lg font-bold text-[var(--app-text-strong)]">Infrastructure and core routes</h2>
            <p className="mt-1 text-sm text-[var(--app-text)]">
              Each card is an independent probe. <strong className="font-semibold text-emerald-800">Green</strong> means
              working, <strong className="font-semibold text-amber-900">yellow</strong> usually means connected but empty
              or incomplete, <strong className="font-semibold text-red-900">red</strong> means broken or missing. Table
              checks never insert data - they only run read-only row counts.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(data.platformInfrastructure ?? []).map((c) => (
                <PlatformInfrastructureCard key={c.name} check={c} scanTime={data.lastCheckedAt} />
              ))}
            </div>
          </section>

          <PerformanceAndCronCard
            performance={data.performance as PlatformPerformanceSnapshot | undefined}
            cronRuns={data.cronRuns as PlatformCronRunSummary | undefined}
          />

          <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--app-muted)]">Summary</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl bg-slate-900 px-4 py-4 text-white lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Overall health score</p>
                <p className="mt-1 font-app-display text-4xl font-bold">{data.healthScore}</p>
                <p className="mt-1 text-xs text-slate-300">0-100 (weighted by check severity)</p>
                <p className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusBadgeClasses(data.overallStatus)}`}>
                  {formatStatusLabel(data.overallStatus)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                <p className="text-xs font-semibold text-[var(--app-muted)]">Total checks</p>
                <p className="mt-1 text-2xl font-bold text-[var(--app-text-strong)]">{data.summary.totalChecks}</p>
              </div>
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold text-emerald-800">Healthy</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{data.summary.healthy}</p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
                <p className="text-xs font-semibold text-amber-900">Warnings</p>
                <p className="mt-1 text-2xl font-bold text-amber-950">{data.summary.warning}</p>
              </div>
              <div className="rounded-xl border border-red-200/80 bg-red-50/50 p-4">
                <p className="text-xs font-semibold text-red-900">Critical</p>
                <p className="mt-1 text-2xl font-bold text-red-950">{data.summary.critical}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-[var(--app-muted)]">
              Last scan: <strong className="text-[var(--app-text)]">{new Date(data.lastCheckedAt).toLocaleString()}</strong>
              {" - "}
              Unknown checks: {data.summary.unknown}
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
            <h2 className="text-lg font-bold text-[var(--app-text-strong)]">Smart Safety flow</h2>
            <p className="mt-1 text-sm text-[var(--app-text)]">
              Vertical stack: data foundation, memory, prevention, then the intelligence engine; outputs and the field
              feedback loop extend to the right. Dashed feedback arrows return into memory and the engine.
            </p>
            <div className="mt-6">
              <FlowDiagram sections={data.sections} connections={data.connections} />
            </div>
          </section>

          {!allClear && issuesPanel.length > 0 ? (
            <section className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-amber-950">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                Issues and recommended fixes
              </h2>
              <p className="mt-1 text-sm text-amber-950/85">
                Lists every check scored as <strong>warning</strong> or <strong>critical</strong> (empty tables are usually warnings, not
                critical).
              </p>
              <ul className="mt-4 space-y-3">
                {issuesPanel.map((item, i) => (
                  <li
                    key={`${item.section}-${item.name}-${i}`}
                    className={`rounded-xl border bg-white/90 px-4 py-3 ${
                      item.status === "critical" ? "border-red-200/70" : "border-amber-200/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800/80">{item.section}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClasses(item.status)}`}
                      >
                        <StatusIcon status={item.status} />
                        {formatStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-[var(--app-text-strong)]">{item.name}</p>
                    <p className="mt-1 text-sm text-[var(--app-text)]">{item.message}</p>
                    {item.fix ? (
                      <p
                        className={`mt-2 text-sm font-medium ${item.status === "critical" ? "text-red-950" : "text-amber-950"}`}
                      >
                        Recommended: {item.fix}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="space-y-4">
            {orderedSections.map((section) => (
              <SectionCardBlock
                key={section.id}
                section={section}
                expanded={Boolean(expanded[section.id])}
                onToggle={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
