"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Database,
  HardDrive,
  Info,
  Server,
  ShieldCheck,
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

/** Marks a widget (or value) as representative sample data, not yet wired to a live source. */
function SampleTag({ className }: { className?: string }) {
  return (
    <span
      title="Sample data — not yet wired to a live source"
      className={cx(
        "inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300",
        className
      )}
    >
      <Info className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
      Sample
    </span>
  );
}

function Panel({
  title,
  action,
  sample = false,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  sample?: boolean;
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
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-tight text-white">{title}</h2>
          {sample ? <SampleTag /> : null}
        </div>
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
  sample = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: KpiTone;
  loading: boolean;
  sample?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-panel)] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-0.5", KPI_BAR[tone])} />
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        {sample ? <SampleTag /> : null}
      </div>
      <p className={cx("sa-nums mt-2 text-3xl font-black tracking-tight", KPI_ACCENT[tone])}>
        {loading ? <span className="text-slate-600">—</span> : value}
      </p>
      {sub ? <p className="mt-1 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sample datasets (clearly labelled in the UI)
 * ------------------------------------------------------------------ */

const SAMPLE_SITES = [
  { name: "Northeast Hub", meta: "Newark, NJ · Bio-Level 2", score: 94, status: "Active", open: 2, last: "Jun 3" },
  { name: "Gulf Coast Facility", meta: "Houston, TX · BSL-3", score: 61, status: "Critical", open: 11, last: "May 28" },
  { name: "Pacific Research Ctr", meta: "San Diego, CA · BSL-2", score: 78, status: "Review", open: 6, last: "Jun 1" },
  { name: "Midwest Campus", meta: "Chicago, IL · Bio-Level 2", score: 91, status: "Active", open: 3, last: "Jun 4" },
  { name: "Southeast Lab", meta: "Atlanta, GA · BSL-1", score: 88, status: "Active", open: 4, last: "Jun 2" },
] as const;

const SAMPLE_DEADLINES = [
  { day: "08", mon: "JUN", title: "OSHA 300A Posting Deadline", meta: "Gulf Coast · OSHA 29 CFR 1904" },
  { day: "15", mon: "JUN", title: "BSL-3 Annual IBC Review", meta: "Gulf Coast · NIH Guidelines §III-D" },
  { day: "22", mon: "JUN", title: "Chemical Inventory Report", meta: "All Sites · EPCRA Tier II" },
  { day: "01", mon: "JUL", title: "Waste Manifest Reconciliation", meta: "Northeast + Midwest · EPA 40 CFR 262" },
] as const;

const SAMPLE_FINDINGS = [
  { label: "CAPA", value: 9, color: "#fb923c" },
  { label: "Inspection", value: 7, color: "#22d3ee" },
  { label: "Observation", value: 5, color: "#a855f7" },
  { label: "Chemical", value: 3, color: "#f472b6" },
  { label: "Other", value: 2, color: "#64748b" },
] as const;

function statusTone(status: string): string {
  if (status === "Critical") return "text-rose-400";
  if (status === "Review") return "text-amber-400";
  return "text-emerald-400";
}
function scoreBar(score: number): string {
  if (score < 70) return "bg-rose-500";
  if (score < 85) return "bg-amber-500";
  return "bg-emerald-500";
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
          value="148"
          sub="↑ 22% vs prior MTD"
          tone="emerald"
          loading={false}
          sample
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Site Compliance */}
        <Panel
          title="Site Compliance Overview"
          sample
          className="xl:col-span-2"
          action={
            <Link href="/superadmin/organizations" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              View all sites →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="pb-2 font-semibold">Site</th>
                  <th className="pb-2 font-semibold">Compliance</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Open</th>
                  <th className="pb-2 text-right font-semibold">Last Insp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {SAMPLE_SITES.map((site) => (
                  <tr key={site.name} className="text-sm">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-100">{site.name}</div>
                      <div className="text-[11px] text-slate-500">{site.meta}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cx("h-full rounded-full", scoreBar(site.score))}
                            style={{ width: `${site.score}%` }}
                          />
                        </div>
                        <span className="sa-nums text-xs font-bold text-slate-300">{site.score}%</span>
                      </div>
                    </td>
                    <td className={cx("py-3 pr-3 text-xs font-semibold", statusTone(site.status))}>
                      ● {site.status}
                    </td>
                    <td className={cx("sa-nums py-3 text-right text-sm font-bold", site.open > 8 ? "text-rose-400" : "text-slate-300")}>
                      {site.open}
                    </td>
                    <td className="sa-nums py-3 text-right text-xs text-slate-400">{site.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Regulatory Deadlines */}
        <Panel title="Regulatory Deadlines" sample>
          <ul className="space-y-3">
            {SAMPLE_DEADLINES.map((d) => (
              <li key={d.title} className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--sa-border-strong)] bg-[var(--sa-panel-soft)]">
                  <span className="sa-nums text-sm font-black leading-none text-cyan-300">{d.day}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{d.mon}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-100">{d.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{d.meta}</p>
                </div>
              </li>
            ))}
          </ul>
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

        {/* Open Findings */}
        <Panel
          title="Open Findings by Type"
          sample
          action={
            <span className="text-xs font-semibold text-slate-500">Breakdown</span>
          }
        >
          <FindingsDonut data={SAMPLE_FINDINGS} />
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
          <div className="grid grid-cols-2 gap-2.5">
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

      {/* Footnote: data provenance */}
      <p className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" aria-hidden />
        KPIs, Platform Activity, and System Health are wired to live platform data.
        Widgets marked <SampleTag className="mx-0.5" /> use representative sample values pending a live source.
      </p>
    </div>
  );
}
