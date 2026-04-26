"use client";

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
  SystemHealthCheck,
  SystemHealthConnection,
  SystemHealthResponse,
  SystemHealthSection,
  SystemHealthStatus,
} from "@/lib/superadmin/systemHealthTypes";

const SECTION_LABELS: Record<string, string> = {
  data_foundation: "Data Foundation",
  memory_buckets: "Safety Memory Buckets",
  prevention_logic: "Prevention Logic Layer",
  intelligence_engine: "Smart Safety Intelligence Engine",
  protection_outputs: "Protection Outputs",
  field_feedback_loop: "Field Feedback Loop",
};

/** Card / diagram canonical order (bottom → top flow, then left-to-right outputs). */
const SECTION_DISPLAY_ORDER = [
  "data_foundation",
  "memory_buckets",
  "prevention_logic",
  "intelligence_engine",
  "protection_outputs",
  "field_feedback_loop",
] as const;

function statusBadgeClasses(status: SystemHealthStatus) {
  if (status === "healthy") return "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/30";
  if (status === "warning") return "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/35";
  if (status === "critical") return "bg-red-500/15 text-red-900 ring-1 ring-red-500/35";
  return "bg-slate-400/15 text-slate-700 ring-1 ring-slate-400/30";
}

function nodeRing(status: SystemHealthStatus) {
  if (status === "healthy") return "ring-2 ring-emerald-500/70 border-emerald-600/30";
  if (status === "warning") return "ring-2 ring-amber-500/70 border-amber-600/30";
  if (status === "critical") return "ring-2 ring-red-500/70 border-red-600/30";
  return "ring-2 ring-slate-300 border-slate-300/80";
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
                {section.lastSuccessfulCheck ? new Date(section.lastSuccessfulCheck).toLocaleString() : "—"}
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

  function getEdge(from: string, to: string) {
    return connMap.get(`${from}->${to}`);
  }

  function HorizontalEdge({ from, to }: { from: string; to: string }) {
    const edge = getEdge(from, to);
    const st = edge?.status ?? "unknown";
    return (
      <div
        className={`flex min-w-[40px] max-w-[56px] shrink-0 flex-col items-center justify-center self-center px-0.5 ${connectionArrowColor(st)}`}
      >
        <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="text-center text-[8px] font-bold leading-tight">{edge?.label ?? "—"}</span>
      </div>
    );
  }

  function VerticalEdge({ from, to }: { from: string; to: string }) {
    const edge = getEdge(from, to);
    const st = edge?.status ?? "unknown";
    return (
      <div className={`flex flex-col items-center py-0.5 ${connectionArrowColor(st)}`}>
        <ArrowUp className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="text-center text-[8px] font-bold leading-tight">{edge?.label ?? "—"}</span>
      </div>
    );
  }

  function LoopBackEdge({
    from,
    to,
    caption,
    Icon,
  }: {
    from: string;
    to: string;
    caption: string;
    Icon: LucideIcon;
  }) {
    const edge = getEdge(from, to);
    const st = edge?.status ?? "unknown";
    return (
      <div className={`flex max-w-[120px] flex-col items-center gap-0.5 ${connectionArrowColor(st)}`}>
        <div className="[&_svg_path]:stroke-[currentColor] [&_svg_path]:[stroke-dasharray:5_4] [&_svg_path]:[stroke-linecap:round]">
          <Icon className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
        </div>
        <span className="text-center text-[8px] font-bold leading-tight">{caption}</span>
        <span className="text-center text-[8px] font-semibold opacity-90">{edge?.label ?? "—"}</span>
      </div>
    );
  }

  function NodeCard({ id, className }: { id: string; className?: string }) {
    const section = byId.get(id);
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

  /** Matches the Smart Safety reference: vertical stack under the engine, outputs branch right, dashed feedback from the field loop. */
  const spineCol = "flex w-[min(100%,118px)] shrink-0 flex-col items-center sm:w-[128px]";

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-1">
        <div className="flex w-full flex-wrap items-end justify-center gap-x-0.5 gap-y-2 sm:flex-nowrap sm:justify-center">
          <div className={spineCol}>
            <NodeCard id="intelligence_engine" className="w-full min-w-0" />
          </div>
          <HorizontalEdge from="intelligence_engine" to="protection_outputs" />
          <NodeCard id="protection_outputs" className="min-w-[100px] shrink-0 sm:min-w-[112px]" />
          <HorizontalEdge from="protection_outputs" to="field_feedback_loop" />
          <div className="flex shrink-0 flex-col items-center">
            <NodeCard id="field_feedback_loop" className="min-w-[108px] sm:min-w-[120px]" />
            <div className="mt-1 flex max-w-[220px] flex-wrap justify-center gap-2 sm:gap-3">
              <LoopBackEdge
                from="field_feedback_loop"
                to="intelligence_engine"
                caption="Feedback → engine"
                Icon={ArrowUpLeft}
              />
              <LoopBackEdge
                from="field_feedback_loop"
                to="memory_buckets"
                caption="Feedback → memory"
                Icon={ArrowDownLeft}
              />
            </div>
          </div>
        </div>

        <div className={spineCol}>
          <VerticalEdge from="prevention_logic" to="intelligence_engine" />
          <NodeCard id="prevention_logic" className="w-full min-w-0" />
          <VerticalEdge from="memory_buckets" to="prevention_logic" />
          <NodeCard id="memory_buckets" className="w-full min-w-0" />
          <VerticalEdge from="data_foundation" to="memory_buckets" />
          <NodeCard id="data_foundation" className="w-full min-w-0" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--app-muted)]">
        Layout follows the Smart Safety architecture: foundation → memory → prevention → intelligence, then deliverables
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

export default function SuperadminSystemHealthPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load health data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
                with suggested fixes so prevention data stays trustworthy—field verification still owns the final call.
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
        description="Layered checks follow how data flows from foundation tables through memory, prevention logic, intelligence outputs, and field feedback. Use them to find missing controls in the stack—not as a substitute for jobsite verification."
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

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--app-muted)]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Running health checks…
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

          <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
            <h2 className="text-lg font-bold text-[var(--app-text-strong)]">Infrastructure and core routes</h2>
            <p className="mt-1 text-sm text-[var(--app-text)]">
              Each card is an independent probe. <strong className="font-semibold text-emerald-800">Green</strong> means
              working, <strong className="font-semibold text-amber-900">yellow</strong> usually means connected but empty
              or incomplete, <strong className="font-semibold text-red-900">red</strong> means broken or missing. Table
              checks never insert data—they only run read-only row counts.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(data.platformInfrastructure ?? []).map((c) => (
                <PlatformInfrastructureCard key={c.name} check={c} scanTime={data.lastCheckedAt} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-6 shadow-[var(--app-shadow-soft)]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--app-muted)]">Summary</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl bg-slate-900 px-4 py-4 text-white lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Overall health score</p>
                <p className="mt-1 font-app-display text-4xl font-bold">{data.healthScore}</p>
                <p className="mt-1 text-xs text-slate-300">0–100 (weighted by check severity)</p>
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
              {" · "}
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
