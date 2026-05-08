"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  FileText,
  Info,
  ShieldCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  riskLabel,
  riskToneClasses,
  type SafePredictCorrectiveAction,
  type SafePredictEvent,
  type SafePredictForecastPoint,
  type SafePredictRiskLevel,
} from "@/lib/safePredictMockData";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useHasMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

export function Card({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("min-w-0 rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]", className)}>
      {children}
    </section>
  );
}

function defaultSectionHint(title: string) {
  const hints: Record<string, string> = {
    "Data Mode": "Switches between authenticated live beta data and the built-in demo fallback used when live workspace records are unavailable.",
    "Risk Thresholds": "Defines how SafetyDoc360 groups numeric risk scores into low, medium, high, and critical bands.",
    "Connected SafetyDoc360 Workflows": "Links this SafePredict screen back to the original SafetyDoc360 operating workflows.",
    "Risk Forecast": "Shows projected risk movement using recent events, actions, training readiness, permits, and inspection signals.",
    "Risk Heat Map": "Groups risk by area, trade, or jobsite so high-priority work is easier to spot.",
    "Launch Readiness Snapshot": "Summarizes whether the current workspace has enough records to support a useful SafePredict rollout.",
    "Activity Timeline": "Lists recent safety events and workflow changes feeding the current SafePredict view.",
  };

  return hints[title] ?? `Explains the ${title.toLowerCase()} section and how it supports the current SafePredict workflow.`;
}

function defaultMetricHint(title: string, value: string | number, detail: string, trend?: string) {
  const extra = trend ? ` ${trend}` : "";
  return `${title} is currently ${value}. ${detail}.${extra}`;
}

export function InfoHint({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={cx("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute right-0 top-7 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-semibold leading-5 text-slate-600 shadow-[0_16px_36px_rgba(15,23,42,0.16)]"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function SectionTitle({
  title,
  action,
  hint,
}: {
  title: string;
  action?: React.ReactNode;
  hint?: React.ReactNode | false;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <h2 className="text-xl font-black leading-tight tracking-tight text-slate-950">{title}</h2>
        {hint !== false ? <InfoHint label={`About ${title}`}>{hint ?? defaultSectionHint(title)}</InfoHint> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 py-6 sm:px-7 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="font-app-display text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-base text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto xl:justify-end">{actions}</div> : null}
    </div>
  );
}

export function SelectShell({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  className?: string;
}) {
  return (
    <label className={cx("block w-full sm:min-w-[160px]", className)}>
      {label ? <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span> : null}
      <select
        {...(onChange
          ? {
              value,
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
            }
          : { defaultValue: value })}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExportButton({
  fileName,
  label,
  payload,
  className,
  children,
}: {
  fileName: string;
  label: string;
  payload: unknown;
  className: string;
  children?: React.ReactNode;
}) {
  function exportPayload() {
    const content = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={exportPayload} className={className} aria-label={label}>
      {children ?? label}
    </button>
  );
}

export function RiskBadge({ level, label }: { level: SafePredictRiskLevel; label?: string }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", riskToneClasses(level))}>
      {label ?? riskLabel(level)}
    </span>
  );
}

export function MetricCard({
  title,
  value,
  suffix,
  detail,
  trend,
  tone = "blue",
  icon,
  sparkline,
  href,
  sourceLabel = "View source",
  hint,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  detail: string;
  trend?: string;
  tone?: "red" | "orange" | "green" | "blue" | "purple" | "amber";
  icon: React.ReactNode;
  sparkline?: React.ReactNode;
  href?: string;
  sourceLabel?: string;
  hint?: React.ReactNode;
}) {
  const toneMap = {
    red: "text-red-600 bg-red-50",
    orange: "text-orange-600 bg-orange-50",
    green: "text-emerald-600 bg-emerald-50",
    blue: "text-blue-600 bg-blue-50",
    purple: "text-purple-600 bg-purple-50",
    amber: "text-amber-600 bg-amber-50",
  } as const;

  return (
    <Card className={cx("p-4 transition", href ? "h-full hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)]" : undefined)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-full", toneMap[tone])}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-slate-800">{title}</p>
            <InfoHint label={`About ${title}`}>
              {hint ?? defaultMetricHint(title, value, detail, trend)}
            </InfoHint>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <p className={cx("font-app-display text-4xl font-black leading-none", toneMap[tone].split(" ")[0])}>
              {value}
            </p>
            {suffix ? <p className="pb-1 text-sm font-bold text-slate-500">{suffix}</p> : null}
          </div>
          <p className={cx("mt-2 text-sm font-bold", toneMap[tone].split(" ")[0])}>{detail}</p>
        </div>
        {sparkline ? <div className="hidden w-28 self-end lg:block">{sparkline}</div> : null}
      </div>
      {trend ? <p className="mt-4 text-sm text-slate-600">{trend}</p> : null}
      {href ? (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-blue-600">
          {sourceLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </Card>
  );
}

export function MiniSparkline({ data, color = "#ef4444" }: { data: number[]; color?: string }) {
  const hasMounted = useHasMounted();
  const points = data.map((value, index) => ({ index, value }));
  if (!hasMounted) return <div className="h-[42px] w-full" aria-hidden />;

  return (
    <ResponsiveContainer width="100%" height={42} minWidth={0} minHeight={0}>
      <LineChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastTrendChart({ data, compact = false }: { data: SafePredictForecastPoint[]; compact?: boolean }) {
  const hasMounted = useHasMounted();

  return (
    <div className={compact ? "h-[285px]" : "h-[330px]"}>
      {hasMounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 22, right: 18, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="highRiskBand" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fee2e2" stopOpacity={0.92} />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity={0.42} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={{ fill: "#475569", fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #dbe3ee",
              boxShadow: "0 12px 22px rgba(15,23,42,0.12)",
            }}
          />
          <Area type="monotone" dataKey="predictedRisk" stroke="none" fill="url(#highRiskBand)" fillOpacity={0.8} />
          <Line type="monotone" dataKey="historicalRisk" name="Historical Risk" stroke="#ef4444" strokeWidth={2.5} dot={false} connectNulls />
          <Line
            type="monotone"
            dataKey="predictedRisk"
            name="Predicted Risk"
            stroke="#f97316"
            strokeWidth={3}
            dot={false}
            strokeDasharray={compact ? undefined : "4 4"}
          />
        </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function RiskHeatMap({ variant = "dashboard" }: { variant?: "dashboard" | "mitigation" }) {
  const zones =
    variant === "dashboard"
      ? [
          { label: "Steel Erection", level: "High", className: "left-[2%] top-[4%] h-[34%] w-[38%] border-red-400 bg-red-100/72", dot: "bg-red-500" },
          { label: "Electrical", level: "High", className: "right-[2%] top-[5%] h-[38%] w-[26%] border-orange-400 bg-orange-100/72", dot: "bg-red-500" },
          { label: "Concrete", level: "Medium", className: "bottom-[4%] left-[2%] h-[36%] w-[35%] border-amber-400 bg-amber-100/72", dot: "bg-orange-500" },
          { label: "Finishing", level: "Low", className: "bottom-[4%] right-[2%] h-[34%] w-[28%] border-emerald-400 bg-emerald-100/72", dot: "bg-emerald-500" },
          { label: "General Conditions", level: "Medium", className: "left-[45%] top-[42%] h-[18%] w-[30%] border-slate-300 bg-white/82", dot: "bg-orange-500" },
        ]
      : [
          { label: "Warehouse A", level: "78", className: "left-[4%] top-[5%] h-[28%] w-[46%] border-slate-300 bg-white/65", dot: "bg-orange-500" },
          { label: "Assembly", level: "52", className: "right-[3%] top-[5%] h-[28%] w-[34%] border-slate-300 bg-white/65", dot: "bg-amber-400" },
          { label: "Press Area", level: "92", className: "left-[24%] top-[39%] h-[25%] w-[40%] border-red-300 bg-red-50/60", dot: "bg-red-500" },
          { label: "Paint Booth", level: "28", className: "right-[4%] top-[43%] h-[28%] w-[30%] border-emerald-300 bg-emerald-50/60", dot: "bg-emerald-500" },
          { label: "Shipping", level: "44", className: "left-[4%] bottom-[5%] h-[26%] w-[34%] border-amber-300 bg-amber-50/70", dot: "bg-amber-400" },
          { label: "Break Room", level: "62", className: "right-[4%] bottom-[5%] h-[21%] w-[31%] border-amber-300 bg-amber-50/70", dot: "bg-amber-400" },
        ];

  const label =
    variant === "dashboard"
      ? "Risk heat map by trade and area"
      : "Work area risk heat map";

  return (
    <div
      className="relative h-[230px] overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(90deg,#eef2f7_1px,transparent_1px),linear-gradient(#eef2f7_1px,transparent_1px)] bg-[length:30px_30px] sm:h-[255px] sm:bg-[length:38px_38px]"
      role="img"
      aria-label={label}
      data-testid={`safe-predict-${variant}-heat-map`}
    >
      <div className="absolute inset-x-4 top-1/2 h-px bg-slate-300" />
      <div className="absolute inset-y-4 left-1/2 w-px bg-slate-300" />
      {zones.map((zone) => (
        <div key={zone.label} className={cx("absolute rounded-sm border p-2 sm:p-3", zone.className)}>
          <p className="text-center text-[11px] font-black leading-tight text-slate-800 sm:text-sm">{zone.label}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-black text-slate-700 sm:mt-2 sm:gap-2 sm:text-sm">
            <span className={cx("h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5", zone.dot)} />
            {zone.level}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ConfidenceGauge({ value }: { value: number }) {
  return (
    <div className="relative mx-auto h-24 w-40">
      <div
        className="absolute inset-x-0 bottom-0 h-20 rounded-t-full"
        style={{ background: `conic-gradient(from 270deg, #16a34a 0deg ${value * 1.8}deg, #dbeafe ${value * 1.8}deg 180deg, transparent 180deg)` }}
      />
      <div className="absolute inset-x-4 bottom-0 h-16 rounded-t-full bg-white" />
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className="text-3xl font-black text-slate-950">{value}%</p>
        <p className="text-xs font-bold text-slate-500">High Confidence</p>
      </div>
    </div>
  );
}

export function DriverDots({ count, level }: { count: number; level: SafePredictRiskLevel }) {
  const color = level === "critical" ? "bg-red-500" : level === "high" ? "bg-orange-500" : "bg-amber-500";
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={cx("h-3.5 w-3.5 rounded-full border", index < count ? color : "border-slate-300 bg-white")} />
      ))}
    </div>
  );
}

export function StatusIcon({ status }: { status: "compliant" | "expiring" | "overdue" }) {
  if (status === "compliant") return <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" aria-label="Compliant" />;
  if (status === "expiring") return <Clock className="mx-auto h-5 w-5 text-amber-500" aria-label="Expiring soon" />;
  return <CircleAlert className="mx-auto h-5 w-5 text-red-500" aria-label="Overdue" />;
}

export function ReadinessDonut() {
  return (
    <div
      className="mx-auto h-[190px] w-[190px] rounded-full p-5"
      style={{
        background: "conic-gradient(#16a34a 0 78%, #f59e0b 78% 93%, #ef4444 93% 100%)",
      }}
      aria-label="Worker readiness: 78% compliant, 15% expiring soon, 7% overdue"
      role="img"
    >
      <div className="h-full w-full rounded-full bg-white shadow-inner" />
    </div>
  );
}

export function EventTimeline({ events }: { events: SafePredictEvent[] }) {
  return (
    <div className="space-y-5">
      {events.map((event) => (
        <div key={event.id} className="grid grid-cols-[64px_28px_1fr] gap-3">
          <p className="pt-1 text-xs font-semibold text-slate-500">{event.time}</p>
          <span
            className={cx(
              "grid h-7 w-7 place-items-center rounded-full text-white",
              event.tone === "critical"
                ? "bg-red-500"
                : event.tone === "high"
                  ? "bg-orange-500"
                  : event.tone === "action"
                    ? "bg-blue-600"
                    : "bg-emerald-600"
            )}
          >
            {event.tone === "action" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">{event.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{event.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CorrectiveActionCard({
  action,
  highlighted,
  onStatusChange,
}: {
  action: SafePredictCorrectiveAction;
  highlighted?: boolean;
  onStatusChange?: (id: string, status: SafePredictCorrectiveAction["status"]) => void;
}) {
  const statusOptions: SafePredictCorrectiveAction["status"][] = ["New", "In Progress", "Awaiting Verification", "Closed"];
  return (
    <article
      className={cx(
        "rounded-lg border bg-white p-3 shadow-sm transition",
        highlighted ? "border-blue-400 ring-4 ring-blue-100" : "border-slate-200"
      )}
    >
      <p className="text-sm font-black leading-5 text-slate-950">{action.title}</p>
      <p className="mt-2 text-xs text-slate-600">Linked: {action.linkedRisk}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10px] font-black text-slate-700">
          {action.assignee.split(" ").map((part) => part[0]).join("")}
        </span>
        {action.assignee}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{action.dueDate}</span>
        <RiskBadge level={action.priority} label={riskLabel(action.priority)} />
      </div>
      {action.status === "In Progress" ? (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${action.progress}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-slate-500">{action.progress}%</p>
        </div>
      ) : null}
      {action.aiRecommended ? <span className="mt-3 inline-flex rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">AI Rec.</span> : null}
      {action.effectiveness ? <p className="mt-3 text-xs font-bold text-emerald-700">Effectiveness {action.effectiveness}/5</p> : null}
      {onStatusChange ? (
        <select
          value={action.status}
          onChange={(event) => onStatusChange(action.id, event.target.value as SafePredictCorrectiveAction["status"])}
          className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700"
          aria-label={`Change status for ${action.title}`}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      ) : null}
    </article>
  );
}

export function NextStepRow({
  icon,
  title,
  detail,
  tone,
  href,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
  tone: SafePredictRiskLevel | "blue";
  href?: string;
}) {
  const color =
    tone === "critical" || tone === "high"
      ? "border-red-200 bg-red-50 text-red-600"
      : tone === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-600"
        : tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-600"
          : "border-emerald-200 bg-emerald-50 text-emerald-600";
  const content = (
    <>
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full border", color)}>{icon ?? <ShieldCheck className="h-5 w-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-900">{title}</span>
        <span className="mt-1 block text-xs text-slate-600">{detail}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
    </>
  );

  const className = "flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-left hover:bg-white";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

export function InsightWorkflow() {
  const steps = [
    { title: "1. AI Detects Risk", detail: "Predictive model or event triggers alert", icon: AlertTriangle, color: "red" },
    { title: "2. Risk Assessed", detail: "Risk scored and prioritized", icon: FileText, color: "violet" },
    { title: "3. Action Created", detail: "AI recommends corrective actions", icon: CheckCircle2, color: "blue" },
    { title: "4. Action Completed", detail: "Verified effective and risk reduced", icon: ShieldCheck, color: "emerald" },
  ];
  const colorClass: Record<string, string> = {
    red: "border-red-500 text-red-600",
    violet: "border-violet-500 text-violet-600",
    blue: "border-blue-500 text-blue-600",
    emerald: "border-emerald-500 text-emerald-600",
  };
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="relative flex items-center gap-3">
            <div className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 bg-white", colorClass[step.color])}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-blue-700">{step.title}</p>
              <p className="mt-1 text-xs leading-4 text-slate-600">{step.detail}</p>
            </div>
            {index < steps.length - 1 ? <ArrowRight className="absolute -right-2 top-5 hidden h-5 w-5 text-blue-500 md:block" /> : null}
          </div>
        );
      })}
    </div>
  );
}
