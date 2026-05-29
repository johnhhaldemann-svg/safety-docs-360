import type { AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";
import { nodeTypeLabel, riskTone } from "@/components/ai-knowledge-map/mapTheme";

export function NodeTooltip({ node, x, y }: { node: AiKnowledgeNode | null; x: number; y: number }) {
  if (!node) return null;
  const tone = riskTone(node.riskLevel);
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[260px] rounded-lg border border-sky-300/20 bg-slate-950/92 px-3 py-2 text-xs shadow-2xl backdrop-blur"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="font-black text-white">{node.title}</div>
      <div className="mt-1 flex items-center gap-2 text-slate-300">
        <span>{nodeTypeLabel(node.nodeType)}</span>
        <span className={tone.text}>{tone.label}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-slate-400">{node.description}</p>
    </div>
  );
}
