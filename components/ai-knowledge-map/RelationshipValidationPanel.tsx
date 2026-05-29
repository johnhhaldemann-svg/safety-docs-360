import type { AiKnowledgeEdge } from "@/lib/aiKnowledgeMap/types";
import { relationshipLabel, validationTone } from "@/components/ai-knowledge-map/mapTheme";

export function RelationshipValidationPanel({
  edges,
  onValidate,
}: {
  edges: AiKnowledgeEdge[];
  onValidate: (edge: AiKnowledgeEdge, status: "approved" | "rejected" | "incorrect") => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <h2 className="text-sm font-black text-white">Relationship Review</h2>
      <div className="mt-3 max-h-[260px] space-y-3 overflow-auto">
        {edges.slice(0, 8).map((edge) => (
          <article key={edge.id ?? `${edge.sourceNodeId}-${edge.targetNodeId}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-white">{relationshipLabel(edge.relationshipType)}</span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${validationTone(edge.validationStatus)}`}>{edge.validationStatus.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">{edge.reason}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => onValidate(edge, "approved")} className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1.5 text-xs font-black text-emerald-100">Approve</button>
              <button type="button" onClick={() => onValidate(edge, "rejected")} className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1.5 text-xs font-black text-amber-100">Reject</button>
              <button type="button" onClick={() => onValidate(edge, "incorrect")} className="rounded-md border border-red-300/25 bg-red-300/10 px-2 py-1.5 text-xs font-black text-red-100">Incorrect</button>
            </div>
          </article>
        ))}
        {edges.length === 0 ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">No relationships need review in this view.</p> : null}
      </div>
    </section>
  );
}
