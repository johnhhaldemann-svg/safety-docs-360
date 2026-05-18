"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileCheck2,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  InlineMessage,
  PageHero,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  workspaceSectionEyebrowClassName,
} from "@/components/WorkspacePrimitives";
import type {
  CyberSecurityCheck,
  CyberSecuritySnapshot,
  CyberSecurityStatus,
} from "@/lib/superadmin/cyberSecurityMonitor";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusLabel(status: CyberSecurityStatus) {
  if (status === "healthy") return "Healthy";
  if (status === "warning") return "Review";
  if (status === "critical") return "Critical";
  return "Unknown";
}

function statusClasses(status: CyberSecurityStatus) {
  if (status === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusIconMark({
  status,
  className,
}: {
  status: CyberSecurityStatus;
  className: string;
}) {
  if (status === "healthy") {
    return <CheckCircle2 className={className} strokeWidth={2.25} aria-hidden />;
  }
  if (status === "warning") {
    return <AlertTriangle className={className} strokeWidth={2.25} aria-hidden />;
  }
  if (status === "critical") {
    return <XCircle className={className} strokeWidth={2.25} aria-hidden />;
  }
  return <ShieldAlert className={className} strokeWidth={2.25} aria-hidden />;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat().format(value);
}

function StatusPill({ status }: { status: CyberSecurityStatus }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em]",
        statusClasses(status)
      )}
    >
      <StatusIconMark status={status} className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className={workspaceSectionEyebrowClassName}>{eyebrow}</p>
      <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--app-text-strong)]">
        {title}
      </h2>
      <p className="mt-1 max-w-4xl text-sm leading-relaxed text-[var(--app-muted)]">
        {description}
      </p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  status,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  status?: CyberSecurityStatus;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--app-text-strong)]">
            {value}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--app-accent-surface-18)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
          <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--app-muted)]">{detail}</p>
        {status ? <StatusPill status={status} /> : null}
      </div>
    </div>
  );
}

function CheckRow({ item }: { item: CyberSecurityCheck }) {
  return (
    <li className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(44,58,86,0.045)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIconMark
              status={item.status}
              className={cx(
                "h-4 w-4",
                item.status === "healthy" && "text-emerald-600",
                item.status === "warning" && "text-amber-600",
                item.status === "critical" && "text-red-600",
                item.status === "unknown" && "text-slate-500"
              )}
            />
            <p className="font-semibold text-[var(--app-text-strong)]">{item.label}</p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--app-text)]">{item.message}</p>
          {item.evidence ? (
            <p className="mt-2 break-words font-mono text-xs text-[var(--app-muted)]">
              {item.evidence}
            </p>
          ) : null}
          {item.recommendedAction ? (
            <p className="mt-2 text-xs font-semibold text-amber-900">
              {item.recommendedAction}
            </p>
          ) : null}
        </div>
        <StatusPill status={item.status} />
      </div>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {["Posture", "Website", "Events", "Requests"].map((label) => (
        <div
          key={label}
          className="h-[148px] animate-pulse rounded-lg border border-[var(--app-border)] bg-white/80"
        />
      ))}
    </div>
  );
}

export default function SuperadminCyberSecurityPage() {
  const [payload, setPayload] = useState<CyberSecuritySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSnapshot = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const response = await fetch("/api/superadmin/cyber-security", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as CyberSecuritySnapshot & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.error || "Cyber security monitor failed.");
      }
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cyber security monitor failed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSnapshot();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSnapshot]);

  const orderedHeaderChecks = useMemo(
    () => [...(payload?.website.headers ?? [])],
    [payload?.website.headers]
  );
  const recentEvents = payload?.telemetry.recentEvents ?? [];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Super Admin / Cyber"
        title="Cyber Security Monitor"
        description="Website security posture, browser header checks, enterprise readiness evidence, and sensitive platform activity for superadmin review."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadSnapshot()}
              disabled={refreshing}
              className={appButtonPrimaryClassName}
            >
              <RefreshCw
                className={cx("h-4 w-4", refreshing && "animate-spin")}
                strokeWidth={2.25}
                aria-hidden
              />
              Run Cyber Check
            </button>
            <Link href="/superadmin/system-health" className={appButtonSecondaryClassName}>
              <Activity className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              System Health
            </Link>
          </>
        }
      />

      {error ? (
        <InlineMessage tone="error" onRetry={() => void loadSnapshot()} retryLabel="Retry">
          {error}
        </InlineMessage>
      ) : null}

      {loading && !payload ? (
        <LoadingState />
      ) : payload ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Posture score"
              value={`${payload.postureScore}`}
              detail={`${payload.summary.critical} critical / ${payload.summary.warning} review`}
              status={payload.overallStatus}
              icon={ShieldCheck}
            />
            <MetricTile
              label="Website"
              value={payload.website.statusCode ? `HTTP ${payload.website.statusCode}` : "No response"}
              detail={
                payload.website.responseTimeMs === null
                  ? payload.monitoredUrl
                  : `${payload.website.responseTimeMs} ms`
              }
              status={payload.website.checks[0]?.status ?? "unknown"}
              icon={Globe2}
            />
            <MetricTile
              label="Security events"
              value={formatNumber(payload.telemetry.securityEventsLast7d)}
              detail={`${formatNumber(payload.telemetry.sensitiveEventsLast7d)} sensitive in 7 days`}
              status={
                payload.telemetry.checks.find((item) => item.id === "security-events-table")
                  ?.status ?? "unknown"
              }
              icon={Database}
            />
            <MetricTile
              label="Open data requests"
              value={formatNumber(payload.telemetry.pendingDataRequests)}
              detail={`${formatNumber(payload.telemetry.suspendedAccounts)} suspended account rows`}
              status={
                payload.telemetry.checks.find((item) => item.id === "data-request-controls")
                  ?.status ?? "unknown"
              }
              icon={FileCheck2}
            />
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Website Monitor"
              title="Public Site Security Checks"
              description="Live response and browser security header checks for the origin serving this app."
            />
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-[var(--app-border)] bg-white p-5 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">
                      Monitored origin
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-[var(--app-muted)]">
                      {payload.monitoredUrl}
                    </p>
                  </div>
                  <a
                    href={payload.monitoredUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs font-bold text-[var(--app-accent-primary)] transition hover:bg-[var(--app-accent-primary-soft)]"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </a>
                </div>
                <ul className="mt-5 space-y-3">
                  {payload.website.checks.map((item) => (
                    <CheckRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>

              <ul className="space-y-3">
                {orderedHeaderChecks.map((item) => (
                  <CheckRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Controls"
              title="Cyber Compliance Control Groups"
              description="Aggregated control status across web perimeter, audit logging, access governance, and evidence readiness."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {payload.controlGroups.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[0_10px_22px_rgba(44,58,86,0.055)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-[var(--app-text-strong)]">{item.label}</p>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--app-text)]">{item.message}</p>
                  {item.recommendedAction ? (
                    <p className="mt-3 text-xs font-semibold text-amber-900">
                      {item.recommendedAction}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <SectionHeader
                eyebrow="Telemetry"
                title="Recent Sensitive Activity"
                description="Latest company security events captured by the enterprise readiness audit trail."
              />
              {recentEvents.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-white shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[var(--app-border)] text-sm">
                      <thead className="bg-[var(--app-panel-soft)] text-left text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        <tr>
                          <th className="px-4 py-3 font-bold">Event</th>
                          <th className="px-4 py-3 font-bold">Resource</th>
                          <th className="px-4 py-3 font-bold">Actor</th>
                          <th className="px-4 py-3 font-bold">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--app-border)]">
                        {recentEvents.map((event) => (
                          <tr key={event.id}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[var(--app-text-strong)]">
                                {event.title}
                              </p>
                              <p className="mt-1 font-mono text-xs text-[var(--app-muted)]">
                                {event.event_type}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-[var(--app-text)]">
                              {event.resource_type}
                            </td>
                            <td className="px-4 py-3 text-[var(--app-text)]">
                              {event.actor_role ?? "n/a"}
                            </td>
                            <td className="px-4 py-3 text-[var(--app-muted)]">
                              {formatDate(event.occurred_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white p-6 text-sm text-[var(--app-muted)]">
                  No recent security events are available for this monitor run.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <SectionHeader
                eyebrow="Evidence"
                title="Cyber Compliance Documents"
                description="Local enterprise IT readiness files bundled with the repo for audits and customer questionnaires."
              />
              <ul className="space-y-3">
                {payload.compliance.documents.map((doc) => (
                  <li
                    key={doc.path}
                    className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[0_8px_18px_rgba(44,58,86,0.045)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--app-text-strong)]">{doc.title}</p>
                        <p className="mt-1 text-sm text-[var(--app-text)]">{doc.purpose}</p>
                        <p className="mt-2 break-all font-mono text-xs text-[var(--app-muted)]">
                          {doc.path}
                        </p>
                      </div>
                      <span
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em]",
                          doc.status === "available"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        )}
                      >
                        {doc.status === "available" ? (
                          <LockKeyhole className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                        )}
                        {doc.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <p className="text-xs text-[var(--app-muted)]">
            Last checked: <span className="font-semibold">{formatDate(payload.generatedAt)}</span>
          </p>
        </>
      ) : null}
    </div>
  );
}
