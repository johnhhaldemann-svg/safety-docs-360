import { categoryColors, nodeTypeLabel } from "@/components/ai-knowledge-map/mapTheme";
import type { AiKnowledgeNodeType } from "@/lib/aiKnowledgeMap/types";

const nodeTypes: AiKnowledgeNodeType[] = ["permit", "task", "hazard", "control", "training", "incident", "risk_record", "document", "observation", "corrective_action"];

export function LegendBar() {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-950/78 p-3 text-xs font-bold text-slate-300 shadow-2xl backdrop-blur">
      {nodeTypes.map((type) => (
        <span key={type} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColors[type] }} />
          {nodeTypeLabel(type)}
        </span>
      ))}
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1"><span className="h-px w-7 bg-sky-300" />Strong connection</span>
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1"><span className="h-px w-7 bg-sky-300/55" />Medium connection</span>
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1"><span className="h-px w-7 border-t border-dashed border-amber-300" />AI / low-confidence</span>
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1"><span className="h-px w-7 bg-emerald-300" />Validated</span>
    </div>
  );
}
