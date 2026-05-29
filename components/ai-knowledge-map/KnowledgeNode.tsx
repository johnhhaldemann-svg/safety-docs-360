import type { AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";
import { categoryColors, nodeTypeLabel, riskTone } from "@/components/ai-knowledge-map/mapTheme";

export function KnowledgeNode({ node, selected, onSelect }: { node: AiKnowledgeNode; selected?: boolean; onSelect: (node: AiKnowledgeNode) => void }) {
  const tone = riskTone(node.riskLevel);
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={`w-full rounded-lg border px-3 py-2 text-left transition ${selected ? "border-sky-300/70 bg-sky-300/15" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}
    >
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]" style={{ color: categoryColors[node.nodeType], backgroundColor: categoryColors[node.nodeType] }} />
        <span className="truncate text-sm font-bold text-white">{node.title}</span>
      </span>
      <span className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <span>{nodeTypeLabel(node.nodeType)}</span>
        <span className={`rounded px-1.5 py-0.5 ${tone.bg} ${tone.text}`}>{tone.label}</span>
      </span>
    </button>
  );
}
