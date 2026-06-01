import { BrainCircuit, CheckCircle2, Database, ShieldAlert } from "lucide-react";
import type { AiKnowledgeGraphSummary } from "@/lib/aiKnowledgeMap/types";

const CORE_SURFACES = [
  "Gus answers",
  "Smart Safety",
  "Permit Copilot",
  "Document Assist",
  "Risk recs",
  "Action queue",
];

export function BrainHealthCard({ summary }: { summary: AiKnowledgeGraphSummary }) {
  const approvedRelationships = summary.humanApprovedRelationshipCount ?? 0;
  const graphReady = summary.nodeCount > 0 && approvedRelationships > 0;
  const fallbackLikely = summary.nodeCount < 8 || summary.edgeCount < 10;

  return (
    <section className="overflow-hidden rounded-xl border border-sky-200 bg-white p-3 text-slate-900 shadow-xl">
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-sky-100 p-1.5 text-sky-700">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-slate-950">AI Engine Brain</h2>
          <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-700">
            Human Review approved memory gateway.
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric icon={Database} label="Nodes" value={summary.nodeCount} />
        <Metric icon={CheckCircle2} label="Links" value={approvedRelationships} />
      </div>

      <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] font-black leading-4 ${graphReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        {graphReady ? "Approved graph memory available." : "Needs approved graph links."}
      </div>

      {fallbackLikely ? (
        <div className="mt-2 flex gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-bold leading-4 text-amber-950">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Thin graph: fallback is supporting context only.
        </div>
      ) : null}

      <div className="mt-2 grid gap-1.5">
        {CORE_SURFACES.map((surface) => (
          <div key={surface} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700">
            <span className="min-w-0 truncate">{surface}</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-sky-800">
              Brain
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
        <Icon className="h-3 w-3 shrink-0 text-sky-600" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-base font-black text-slate-950">{value}</div>
    </div>
  );
}
