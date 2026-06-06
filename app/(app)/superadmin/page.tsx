"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  Crosshair,
  Database,
  HardDrive,
  LifeBuoy,
  LibraryBig,
  ListChecks,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import {
  useCommandCenterData,
  type CommandActivityEntry,
} from "@/components/superadmin/CommandCenterDataProvider";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}


function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-panel)] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]",
        className
      )}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-tight text-white">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * KPI cards
 * ------------------------------------------------------------------ */

type KpiTone = "cyan" | "rose" | "amber" | "violet" | "emerald";

const KPI_ACCENT: Record<KpiTone, string> = {
  cyan: "text-cyan-300",
  rose: "text-rose-300",
  amber: "text-amber-300",
  violet: "text-violet-300",
  emerald: "text-emerald-300",
};
const KPI_BAR: Record<KpiTone, string> = {
  cyan: "bg-cyan-400",
  rose: "bg-rose-400",
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  emerald: "bg-emerald-400",
};

function KpiCard({
  label,
  value,
  sub,
  tone,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: KpiTone;
  loading: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-panel)] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-0.5", KPI_BAR[tone])} />
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
      </div>
      <p className={cx("sa-nums mt-2 text-3xl font-black tracking-tight", KPI_ACCENT[tone])}>
        {loading ? <span className="text-slate-600">—</span> : value}
      </p>
      {sub ? <p className="mt-1 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Real-data helpers
 * ------------------------------------------------------------------ */

const FINDING_COLORS = {
  correctiveActions: "#fb923c",
  incidents: "#f43f5e",
  observations: "#a855f7",
  inspections: "#22d3ee",
} as const;

/** Splits an ISO date into a compact day / month-abbreviation pair for the deadline tiles. */
function deadlineParts(iso: string): { day: string; mon: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "--", mon: "" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
}

/* ------------------------------------------------------------------ *
 * Findings donut (SVG)
 * ------------------------------------------------------------------ */

function FindingsDonut({ data }: { data: ReadonlyArray<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const segments = data.reduce<Array<{ label: string; color: string; len: number; offset: number }>>(
    (acc, d) => {
      const len = (d.value / total) * circumference;
      const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
      acc.push({ label: d.label, color: d.color, len, offset });
      return acc;
    },
    []
  );

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="14" />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${seg.len} ${circumference - seg.len}`}
              strokeDashoffset={-seg.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="sa-nums text-2xl font-black text-white">{total}</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">open</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-slate-300">{d.label}</span>
            <span className="sa-nums ml-auto font-bold text-slate-400">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * System health (real, from health categories)
 * ------------------------------------------------------------------ */

const SYSTEM_HEALTH_TILES: Array<{
  key:
    | "systemHealth"
    | "aiEngine"
    | "cyberHealth"
    | "dataQuality"
    | "predictionValue"
    | "ownerValidation"
    | "helpTickets";
  label: string;
  icon: typeof Server;
}> = [
  { key: "systemHealth", label: "System Health", icon: Server },
  { key: "aiEngine", label: "AI Engine", icon: Activity },
  { key: "cyberHealth", label: "Cyber Health", icon: ShieldCheck },
  { key: "dataQuality", label: "Data Quality", icon: Database },
  { key: "predictionValue", label: "Prediction Value", icon: HardDrive },
  { key: "ownerValidation", label: "Owner Validation", icon: ClipboardCheck },
  { key: "helpTickets", label: "Help Tickets", icon: LifeBuoy },
];

function healthDot(score: number | null, status: string): string {
  if (status !== "active" || score == null) return "bg-slate-600";
  if (score >= 85) return "bg-emerald-400";
  if (score >= 70) return "bg-amber-400";
  return "bg-rose-400";
}

/* ------------------------------------------------------------------ *
 * Activity feed (real)
 * ------------------------------------------------------------------ */

function severityDot(severity: string): string {
  if (severity === "critical") return "bg-rose-400";
  if (severity === "high") return "bg-amber-400";
  if (severity === "medium") return "bg-cyan-400";
  return "bg-slate-500";
}

function ActivityRow({ entry }: { entry: CommandActivityEntry }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot(entry.severity))} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-slate-200">{entry.summary}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          <span className="uppercase tracking-[0.1em]">{entry.objectType}</span>
          {entry.createdAt ? ` · ${relativeTime(entry.createdAt)}` : ""}
        </p>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function SuperadminCommandCenterPage() {
  const { data, loading } = useCommandCenterData();

  const compliance = data?.healthScore;
  const criticalCount = data?.criticalAlerts.length ?? 0;
  const firstCritical = useMemo(() => {
    const alert = data?.criticalAlerts?.[0];
    if (!alert) return null;
    const text =
      (typeof alert.message === "string" && alert.message) ||
      (typeof alert.summary === "string" && alert.summary) ||
      (typeof alert.title === "string" && alert.title) ||
      null;
    return text;
  }, [data]);

  const metrics = data?.metrics ?? null;
  const inspNow = metrics?.inspectionsMtd.current ?? null;
  const inspPrev = metrics?.inspectionsMtd.previous ?? null;
  const inspDelta =
    inspNow != null && inspPrev != null && inspPrev > 0
      ? Math.round(((inspNow - inspPrev) / inspPrev) * 100)
      : null;

  const findings = metrics?.findingsByType;
  const findingsData = findings
    ? [
        { label: "Corrective", value: findings.correctiveActions ?? 0, color: FINDING_COLORS.correctiveActions },
        { label: "Incidents", value: findings.incidents ?? 0, color: FINDING_COLORS.incidents },
        { label: "Observations", value: findings.observations ?? 0, color: FINDING_COLORS.observations },
        { label: "Inspections", value: findings.inspections ?? 0, color: FINDING_COLORS.inspections },
      ]
    : [];
  const hasFindings = findingsData.some((f) => f.value > 0);

  const backlog = metrics?.reviewBacklog;
  const backlogItems = [
    { label: "Prediction Validation", value: backlog?.predictionValidation ?? 0, href: "/superadmin/prediction-validation", icon: Crosshair },
    { label: "AI Knowledge candidates", value: backlog?.knowledgeCandidates ?? 0, href: "/superadmin/ai-knowledge-map", icon: BrainCircuit },
    { label: "AI Improvements", value: backlog?.aiImprovements ?? 0, href: "/superadmin/ai-improvements", icon: Sparkles },
    { label: "Owner Validations", value: backlog?.ownerValidations ?? 0, href: "/superadmin/owner-validation", icon: ClipboardCheck },
  ];

  const memory = metrics?.approvalMemory;
  const memoryDecided = (memory?.approved ?? 0) + (memory?.rejected ?? 0);
  const approvableRate = memoryDecided > 0 ? Math.round(((memory?.approved ?? 0) / memoryDecided) * 100) : null;

  return (
    <div className="space-y-5">
      {/* Critical alert banner */}
      {criticalCount > 0 ? (
        <Link
          href="/superadmin/health"
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 transition hover:border-rose-400/50"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" strokeWidth={2.25} aria-hidden />
          <p className="min-w-0 text-sm">
            <span className="font-bold text-rose-300">Critical: </span>
            <span className="text-rose-200/90">
              {firstCritical ||
                `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""} require attention.`}
            </span>
          </p>
          <ArrowUpRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden />
        </Link>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Platform Compliance"
          value={compliance != null ? `${compliance}%` : "—"}
          sub="Overall platform health"
          tone="cyan"
          loading={loading && data == null}
        />
        <KpiCard
          label="Open Escalations"
          value={`${data?.openEscalations ?? 0}`}
          sub={`${data?.unseenTickets ?? 0} unseen`}
          tone="rose"
          loading={loading && data == null}
        />
        <KpiCard
          label="Active Users"
          value={data?.activeUsers != null ? `${data.activeUsers}` : "—"}
          sub="Across all tenants"
          tone="amber"
          loading={loading && data == null}
        />
        <KpiCard
          label="Total Organizations"
          value={data?.totalOrganizations != null ? `${data.totalOrganizations}` : "—"}
          sub={
            data?.pendingOnboard != null && data.pendingOnboard > 0
              ? `${data.pendingOnboard} pending onboard`
              : "All active"
          }
          tone="violet"
          loading={loading && data == null}
        />
        <KpiCard
          label="Inspections (MTD)"
          value={inspNow != null ? `${inspNow}` : "—"}
          sub={
            inspDelta != null
              ? `${inspDelta >= 0 ? "↑" : "↓"} ${Math.abs(inspDelta)}% vs prior MTD`
              : "Field audits this month"
          }
          tone="emerald"
          loading={loading && data == null}
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Review Backlog (real) — the superadmin action queue */}
        <Panel
          title="Review Backlog"
          action={<ListChecks className="h-4 w-4 text-slate-500" aria-hidden />}
        >
          <ul className="space-y-1.5">
            {backlogItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] px-3 py-2.5 transition hover:border-cyan-400/30"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-cyan-300" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{item.label}</span>
                    <span
                      className={cx(
                        "sa-nums inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-bold",
                        item.value > 0 ? "bg-amber-500/90 text-slate-950" : "bg-white/5 text-slate-500"
                      )}
                    >
                      {loading && data == null ? "—" : item.value}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-cyan-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Organizations needing attention (real) */}
        <Panel
          title="Orgs Needing Attention"
          action={
            <Link href="/superadmin/organizations" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              All orgs →
            </Link>
          }
        >
          {metrics && metrics.topOrgs.length > 0 ? (
            <ul className="space-y-1.5">
              {metrics.topOrgs.map((org) => (
                <li key={org.companyId}>
                  <Link
                    href="/superadmin/organizations"
                    className="group flex items-center gap-3 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] px-3 py-2.5 transition hover:border-cyan-400/30"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-cyan-300" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{org.name}</span>
                    <span className="sa-nums text-xs font-bold text-rose-300">{org.openIncidents}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">incidents</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">
              {loading && !data ? "Loading…" : "No incident-bearing organizations yet."}
            </p>
          )}
        </Panel>

        {/* Regulatory Deadlines (real — upcoming training/cert expirations) */}
        <Panel title="Upcoming Deadlines">
          {metrics && metrics.deadlines.length > 0 ? (
            <ul className="space-y-3">
              {metrics.deadlines.map((d, i) => {
                const { day, mon } = deadlineParts(d.dueDate);
                return (
                  <li key={`${d.title}-${i}`} className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--sa-border-strong)] bg-[var(--sa-panel-soft)]">
                      <span className="sa-nums text-sm font-black leading-none text-cyan-300">{day}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{mon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-100">{d.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{d.meta}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">
              {loading && !data ? "Loading…" : "No certification expirations in the next 60 days."}
            </p>
          )}
        </Panel>
      </div>

      {/* Secondary grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Platform Activity (real) */}
        <Panel
          title="Platform Activity"
          action={
            <Link href="/superadmin/health" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              Audit log →
            </Link>
          }
        >
          {data && data.activity.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {data.activity.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">
              {loading && !data ? "Loading activity…" : "No recent platform events recorded."}
            </p>
          )}
        </Panel>

        {/* Open Findings (real) */}
        <Panel
          title="Findings by Type"
          action={<span className="text-xs font-semibold text-slate-500">All tenants</span>}
        >
          {hasFindings ? (
            <FindingsDonut data={findingsData} />
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">
              {loading && !data ? "Loading findings…" : "No safety records recorded yet."}
            </p>
          )}
        </Panel>

        {/* System Health (real) */}
        <Panel
          title="System Health"
          action={
            <Link href="/superadmin/system-health" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              Details →
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {SYSTEM_HEALTH_TILES.map((tile) => {
              const cat = data?.healthCategories?.[tile.key];
              const score = cat?.score ?? null;
              const status = cat?.status ?? "pending";
              const Icon = tile.icon;
              return (
                <div
                  key={tile.key}
                  className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} aria-hidden />
                    <span className="truncate text-[11px] font-semibold text-slate-300">
                      {tile.label}
                    </span>
                    <span className={cx("ml-auto h-2 w-2 rounded-full", healthDot(score, status))} />
                  </div>
                  <p className="sa-nums mt-1.5 text-lg font-bold text-white">
                    {score != null ? `${score}` : "—"}
                    {score != null ? <span className="text-xs text-slate-500">/100</span> : null}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* AI Approval Memory bank (real) */}
      <Panel
        title="AI Approval Memory"
        action={
          <Link href="/superadmin/prediction-validation" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
            Review queue →
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4">
            <div className="flex items-center gap-2">
              <LibraryBig className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Decisions logged</span>
            </div>
            <p className="sa-nums mt-1.5 text-2xl font-black text-white">{memory ? memory.total : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-500">Training corpus size</p>
          </div>
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Approved</span>
            <p className="sa-nums mt-1.5 text-2xl font-black text-emerald-300">{memory ? memory.approved : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-500">Marked approvable</p>
          </div>
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Rejected</span>
            <p className="sa-nums mt-1.5 text-2xl font-black text-rose-300">{memory ? memory.rejected : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-500">Marked not approvable</p>
          </div>
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Approvable rate</span>
            <p className="sa-nums mt-1.5 text-2xl font-black text-cyan-300">{approvableRate != null ? `${approvableRate}%` : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-500">{memoryDecided > 0 ? `of ${memoryDecided} decided` : "Awaiting decisions"}</p>
          </div>
        </div>
      </Panel>

      {/* Footnote: data provenance */}
      <p className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" aria-hidden />
        All widgets are wired to live platform data across all tenants. Empty states appear until the underlying records exist.
      </p>
    </div>
  );
}
