import type { ContractorRiskScore } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { Users } from "lucide-react";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";

export type ContractorRiskTableProps = {
  contractors: ContractorRiskScore[];
  title?: string;
  description?: string;
  className?: string;
};

function riskTraffic(score: number): "green" | "yellow" | "red" {
  if (score >= 70) return "red";
  if (score >= 40) return "yellow";
  return "green";
}

/**
 * Responsive contractor scorecard table (stacks on small screens).
 */
export function ContractorRiskTable({
  contractors,
  title = "Contractor risk scorecards",
  description = "Derived from open work, overdue items, observations, incidents, and compliance signals.",
  className = "",
}: ContractorRiskTableProps) {
  if (contractors.length === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={Users}
          title="No contractor risk rows"
          description="When evaluations and compliance documents are available, scorecards appear here so you can target contractor coordination and field verification."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-strong)] bg-white/92 shadow-[var(--app-shadow-soft)]">
        <table className="min-w-[640px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--app-border)] bg-[var(--app-panel)]">
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Contractor</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Risk</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Open</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Overdue</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Obs.</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Inc.</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Training</th>
              <th className="px-4 py-3 font-semibold text-[var(--app-text-strong)]">Permits</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c, i) => (
              <tr key={`${c.contractorName}-${i}`} className="border-b border-[var(--app-border-subtle)] last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--app-text-strong)]">{c.contractorName}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-app-display font-bold text-[var(--app-text-strong)]">{Math.round(c.riskScore)}</span>
                    <StatusBadge label="Exposure band" trafficLight={riskTraffic(c.riskScore)} />
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--app-text)]">{c.openItems}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{c.overdueItems}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{c.observations}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{c.incidents}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{Math.round(c.trainingCompliance)}%</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{Math.round(c.permitCompliance)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
