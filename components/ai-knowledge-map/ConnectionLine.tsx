import type { AiKnowledgeEdge } from "@/lib/aiKnowledgeMap/types";
import { relationshipLabel, validationTone } from "@/components/ai-knowledge-map/mapTheme";

export function ConnectionLine({ edge }: { edge: AiKnowledgeEdge }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-slate-100">{relationshipLabel(edge.relationshipType)}</span>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${validationTone(edge.validationStatus)}`}>
          {edge.validationStatus.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300">{edge.reason}</p>
      <div className="mt-2 text-[11px] font-semibold text-slate-500">
        Strength {Math.round(edge.relationshipStrength * 100)}% / Confidence {Math.round(edge.confidenceScore * 100)}%
      </div>
    </div>
  );
}
