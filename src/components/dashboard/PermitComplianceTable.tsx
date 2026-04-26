import type { PermitCompliance } from "@/src/lib/dashboard/types";
import { PERMITS_EMPTY } from "@/src/lib/dashboard/dashboardOverviewEmptyMessages";
import { permitComplianceRowBand, readinessPercentBand } from "@/src/lib/dashboard/dashboardStatusSemantics";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { ClipboardCheck } from "lucide-react";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";

export type PermitComplianceTableProps = {
  permits: PermitCompliance[];
  /** JSA / activity completion rate from summary (0–100) for the JSA & permit header strip */
  jsaCompletionRate?: number;
  title?: string;
  description?: string;
  className?: string;
};

/**
 * Permit-type compliance grid plus optional JSA completion headline from the same overview payload.
 */
export function PermitComplianceTable({
  permits,
  jsaCompletionRate,
  title = "JSA and permit posture",
  description = "Required versus completed permits by type, with gap counts. Treat missing rows as a missing control until documented before work continues.",
  className = "",
}: PermitComplianceTableProps) {
  if (permits.length === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        {jsaCompletionRate != null && jsaCompletionRate > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-accent-primary-soft)] px-3 py-2 text-xs text-[var(--app-text)]">
            <span className="font-semibold text-[var(--app-text-strong)]">JSA completion (summary): </span>
            <span className="font-app-display font-bold text-[var(--app-text-strong)]">{Math.round(jsaCompletionRate)}%</span>
            <StatusBadge label="JSA status" trafficLight={readinessPercentBand(jsaCompletionRate, true)} />
          </div>
        ) : null}
        <EmptyState align="left" icon={ClipboardCheck} title={PERMITS_EMPTY.title} description={PERMITS_EMPTY.description} />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        {jsaCompletionRate != null && jsaCompletionRate > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-xs">
            <span className="font-semibold text-[var(--app-text-strong)]">JSA completion</span>
            <span className="font-app-display text-base font-bold text-[var(--app-text-strong)]">{Math.round(jsaCompletionRate)}%</span>
            <StatusBadge label="JSA status" trafficLight={readinessPercentBand(jsaCompletionRate, true)} />
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-strong)] bg-white/92 shadow-[var(--app-shadow-soft)]">
        <table className="min-w-[520px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--app-border)] bg-[var(--app-panel)]">
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Permit type</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Required</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Completed</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Missing</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Rate</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Health</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p, i) => (
              <tr key={`${p.permitType}-${i}`} className="border-b border-[var(--app-border-subtle)] last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--app-text-strong)]">{p.permitType}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{p.required}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{p.completed}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{p.missing}</td>
                <td className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">{Math.round(p.complianceRate)}%</td>
                <td className="px-4 py-3">
                  <StatusBadge label="Compliance" trafficLight={permitComplianceRowBand(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
