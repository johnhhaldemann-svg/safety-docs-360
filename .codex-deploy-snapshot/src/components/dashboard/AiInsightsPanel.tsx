import type { DashboardAiInsight } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { formatTitleCase } from "@/lib/formatTitleCase";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export type AiInsightsPanelProps = {
  insights: DashboardAiInsight[];
  /** Section subheading when nested under a numbered prevention panel */
  title?: string;
  description?: string;
  className?: string;
};

/**
 * Curated / rule-based insights from {@link DashboardAiInsight} payloads (no client-side fabrication).
 */
export function AiInsightsPanel({
  insights,
  title = "Findings",
  description =
    "Rules-based takeaways from your metrics—what changed, why it matters, who is affected, recommended actions, and whether the signal is improving, worsening, or stable in this window.",
  className = "",
}: AiInsightsPanelProps) {
  const displayTitle = formatTitleCase(title) || title;

  if (insights.length === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{displayTitle}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={Sparkles}
          title="No insights for this snapshot"
          description="When correctives, observations, permits, and training data populate for your filters, prevention-focused findings will appear here."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{displayTitle}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>
      <ul className="space-y-2">
        {insights.map((ins) => (
          <li
            key={ins.id}
            className="rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(237,244,255,0.92)_100%)] px-4 py-3 shadow-[0_8px_18px_rgba(76,108,161,0.05)]"
          >
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">
              {formatTitleCase(ins.title) || ins.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-text)]">{ins.body}</p>
            {ins.href ? (
              <Link
                href={ins.href}
                className="mt-2 inline-flex text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-accent-primary)] hover:text-[var(--app-link-hover)]"
              >
                View detail →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
