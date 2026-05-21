import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileSearch, ShieldCheck } from "lucide-react";
import type { LeadershipTrustMetadata } from "@/lib/leadershipTrust";

function confidenceTone(confidence: LeadershipTrustMetadata["confidenceLabel"]) {
  if (confidence === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function priorityTone(priority: "high" | "medium" | "low") {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function sourceTone(status: "connected" | "partial" | "missing") {
  if (status === "connected") return "bg-emerald-500";
  if (status === "partial") return "bg-amber-500";
  return "bg-slate-300";
}

export function TrustSummaryPanel({
  trust,
  compact = false,
  className = "",
}: {
  trust: LeadershipTrustMetadata;
  compact?: boolean;
  className?: string;
}) {
  const connected = trust.sourceCoverage.filter((source) => source.status === "connected").length;
  const totalSources = trust.sourceCoverage.length;
  const evidenceCount = trust.evidenceRefs.length;
  const confidenceMeaning =
    totalSources > 0
      ? [
          `Confidence means this summary is backed by ${connected} of ${totalSources} active data sources`,
          evidenceCount > 0
            ? `and ${evidenceCount} evidence reference${evidenceCount === 1 ? "" : "s"}`
            : "",
          "for this window. It is not a safety grade.",
        ]
          .filter(Boolean)
          .join(" ")
      : "Confidence means no leadership data sources are configured for this window. It is not a safety grade.";

  return (
    <section
      className={`rounded-xl border border-[var(--app-border)] bg-white/95 p-4 text-sm text-[var(--app-text)] shadow-[0_10px_24px_rgba(44,58,86,0.055)] ${className}`.trim()}
      aria-label="Leadership trust summary"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--app-accent-primary)]" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Leadership trust layer
            </p>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--app-text-strong)]">{trust.executiveSummary}</p>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-[var(--app-muted)]">{trust.provenanceNote}</p>
        </div>
        <div className="flex max-w-full flex-col items-start gap-1.5 lg:max-w-[24rem] lg:items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${confidenceTone(trust.confidenceLabel)}`}
              title={confidenceMeaning}
            >
              {trust.confidenceLabel} confidence ({trust.confidencePercent}%)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {new Date(trust.lastUpdatedAt).toLocaleString()}
            </span>
          </div>
          <p className="max-w-full text-left text-xs leading-5 text-[var(--app-muted)] lg:text-right">
            {confidenceMeaning}
          </p>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-2" : "lg:grid-cols-[1.05fr_0.95fr]"}`}>
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Source coverage</p>
            <span className="text-xs font-semibold text-[var(--app-text)]">
              {connected}/{trust.sourceCoverage.length} active
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {trust.sourceCoverage.map((source) => {
              const content = (
                <span className="flex items-center justify-between gap-2 rounded-md bg-white/80 px-2.5 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sourceTone(source.status)}`} />
                    <span className="truncate font-semibold text-[var(--app-text-strong)]">{source.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[var(--app-muted)]">{source.count}</span>
                </span>
              );
              return source.href ? (
                <Link key={source.key} href={source.href} className="focus:outline-none focus:ring-2 focus:ring-[var(--app-accent-surface-18)]">
                  {content}
                </Link>
              ) : (
                <div key={source.key}>{content}</div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          {trust.nextActions.length > 0 ? (
            <div className="rounded-lg border border-[var(--app-border)] bg-white/90 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Next 3 actions</p>
              <div className="mt-2 space-y-2">
                {trust.nextActions.slice(0, 3).map((action) => (
                  <Link key={action.id} href={action.href} className="block rounded-md border border-[var(--app-border)] px-3 py-2 transition hover:bg-[var(--app-panel-soft)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--app-text-strong)]">{action.label}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTone(action.priority)}`}>
                        {action.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{action.detail}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--app-border)] bg-white/90 p-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
              <FileSearch className="h-3.5 w-3.5" aria-hidden />
              Evidence and gaps
            </p>
            {trust.evidenceRefs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {trust.evidenceRefs.slice(0, 5).map((evidence) => (
                  <Link key={evidence.id} href={evidence.href} className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-strong)] hover:bg-white">
                    {evidence.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--app-muted)]">No direct evidence refs were attached to this summary yet.</p>
            )}
            {trust.missingSignals.length > 0 ? (
              <div className="mt-3 space-y-1">
                {trust.missingSignals.slice(0, 3).map((signal) => (
                  <p key={signal} className="flex gap-2 text-xs leading-5 text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{signal}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 flex gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Key leadership signals are present for this window.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
