import { AlertTriangle } from "lucide-react";
import type { AiKnowledgeEdge } from "@/lib/aiKnowledgeMap/types";
import { relationshipLabel } from "@/components/ai-knowledge-map/mapTheme";

export function LowConfidenceQueue({ edges }: { edges: AiKnowledgeEdge[] }) {
  const low = edges.filter((edge) => edge.confidenceScore < 0.55 || edge.validationStatus === "needs_review").slice(0, 6);
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-black text-white">Low Confidence</h2>
      </div>
      <div className="mt-3 space-y-2">
        {low.map((edge) => (
          <div key={edge.id ?? `${edge.sourceNodeId}-${edge.targetNodeId}`} className="rounded-lg border border-amber-300/18 bg-amber-300/8 p-3">
            <p className="text-xs font-black text-amber-100">{relationshipLabel(edge.relationshipType)}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">{edge.reason}</p>
          </div>
        ))}
        {low.length === 0 ? <p className="text-sm font-semibold text-slate-400">No low-confidence matches in this view.</p> : null}
      </div>
    </section>
  );
}
