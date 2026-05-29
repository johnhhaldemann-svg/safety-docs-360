import { ExternalLink, ShieldCheck } from "lucide-react";
import { ConnectionLine } from "@/components/ai-knowledge-map/ConnectionLine";
import { nodeTypeLabel, riskTone, validationTone } from "@/components/ai-knowledge-map/mapTheme";
import type { AiKnowledgeEdge, AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";

export function SelectedNodePanel({
  node,
  edges,
  nodes,
  companies,
  onValidate,
}: {
  node: AiKnowledgeNode | null;
  edges: AiKnowledgeEdge[];
  nodes: AiKnowledgeNode[];
  companies: Array<{ id: string; name: string }>;
  onValidate: (edge: AiKnowledgeEdge, status: "approved" | "rejected" | "incorrect") => void;
}) {
  if (!node) {
    return (
      <aside className="rounded-xl border border-white/10 bg-slate-950/72 p-4 text-sm text-slate-400 shadow-2xl backdrop-blur">
        Select a node to inspect meaning, risk, relationship reasons, evidence, and validation status.
      </aside>
    );
  }
  const tone = riskTone(node.riskLevel);
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const isFallback = node.metadata.fallback === true;
  const companyName = isFallback ? "General fallback guidance" : companies.find((company) => company.id === node.companyId)?.name ?? node.companyId ?? "All companies";
  const related = edges.filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id || edge.fromNodeId === node.id || edge.toNodeId === node.id).slice(0, 10);
  const trend = node.riskLevel === "critical" || node.riskLevel === "high" ? "Increasing attention" : "Stable";

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{nodeTypeLabel(node.nodeType)}</p>
          <h2 className="mt-1 text-xl font-black leading-tight text-white">{node.title}</h2>
        </div>
        <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-black ${tone.border} ${tone.bg} ${tone.text}`}>{tone.label}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{node.description || node.semanticSummary}</p>
      <dl className="mt-4 grid gap-2 text-xs text-slate-300">
        <Row label="Category" value={node.category} />
        <Row label="Risk score" value={node.riskScore == null ? "Not scored" : String(node.riskScore)} />
        <Row label="Trend" value={trend} />
        <Row label="Confidence" value={`${Math.round((node.confidenceScore ?? 0.72) * 100)}%`} />
        <Row label="Validation" value={node.validationStatus.replace(/_/g, " ")} badgeClass={validationTone(node.validationStatus)} />
        {isFallback ? <Row label="Fallback" value="Not company-specific" /> : null}
        <Row label="Company" value={companyName} />
        <Row label="Source" value={isFallback ? String(node.metadata.fallbackSource ?? "approved fallback") : `${node.sourceTable}:${node.sourceId}`} />
        <Row label="Project" value={node.project ?? "All projects"} />
        <Row label="Trade" value={node.trade ?? "All trades"} />
      </dl>
      <a
        href={node.sourceUrl ?? "#"}
        className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-sm font-black text-sky-100 ${node.sourceUrl ? "hover:bg-sky-300/16" : "pointer-events-none opacity-60"}`}
      >
        <ExternalLink className="h-4 w-4" />
        View full details
      </a>
      <div className="mt-5 min-h-0 overflow-auto">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-300" />
          <h3 className="text-sm font-black text-white">Why it connects</h3>
        </div>
        <div className="mt-3 space-y-3">
          {related.map((edge) => {
            const otherId = edge.sourceNodeId === node.id || edge.fromNodeId === node.id ? edge.targetNodeId ?? edge.toNodeId : edge.sourceNodeId ?? edge.fromNodeId;
            const other = byId.get(otherId);
            return (
              <div key={edge.id ?? `${edge.sourceNodeId}-${edge.targetNodeId}-${edge.relationshipType}`} className="space-y-2">
                <ConnectionLine edge={edge} />
                {other ? <p className="text-[11px] font-semibold text-slate-500">Related record: {other.title}</p> : null}
                {edge.createdByType === "ai" || edge.validationStatus !== "approved" ? (
                  <div className="grid grid-cols-3 gap-2">
                    <ReviewButton label="Approve" onClick={() => onValidate(edge, "approved")} />
                    <ReviewButton label="Reject" onClick={() => onValidate(edge, "rejected")} />
                    <ReviewButton label="Incorrect" onClick={() => onValidate(edge, "incorrect")} danger />
                  </div>
                ) : null}
              </div>
            );
          })}
          {related.length === 0 ? <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">No relationships generated for this node yet.</p> : null}
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value, badgeClass }: { label: string; value: string; badgeClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className={badgeClass ? `rounded-md border px-2 py-0.5 text-right font-black ${badgeClass}` : "max-w-[13rem] truncate text-right font-semibold"}>{value}</dd>
    </div>
  );
}

function ReviewButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md border px-2 py-1.5 text-xs font-black ${danger ? "border-red-400/25 bg-red-400/10 text-red-100 hover:bg-red-400/16" : "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"}`}>
      {label}
    </button>
  );
}
