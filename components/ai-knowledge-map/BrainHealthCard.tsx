import { BrainCircuit, CheckCircle2, Database, ShieldAlert } from "lucide-react";
import type { AiKnowledgeGraphSummary } from "@/lib/aiKnowledgeMap/types";

const CORE_SURFACES = [
  "Gus verified answers",
  "Smart Safety",
  "Permit Copilot",
  "Document AI Assist",
  "Risk recommendations",
  "AI safety action queue",
];

export function BrainHealthCard({ summary }: { summary: AiKnowledgeGraphSummary }) {
  const approvedRelationships = summary.humanApprovedRelationshipCount ?? 0;
  const graphReady = summary.nodeCount > 0 && approvedRelationships > 0;
  const fallbackLikely = summary.nodeCount < 8 || summary.edgeCount < 10;

  return (
    <section className="rounded-xl border border-sky-200 bg-white p-4 text-slate-900 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-950">AI Engine Brain Health</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">
            Core AI surfaces now retrieve through the same Human Review approved memory gateway.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
        <Metric icon={Database} label="Trusted nodes" value={summary.nodeCount} />
        <Metric icon={CheckCircle2} label="Approved links" value={approvedRelationships} />
      </div>

      <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-black ${graphReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        {graphReady ? "Brain gateway has approved graph memory available." : "Brain gateway will warn and use approved fallback or legacy support when graph memory is thin."}
      </div>

      {fallbackLikely ? (
        <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Company graph memory is still thin. AI outputs must label fallback guidance as general support.
        </div>
      ) : null}

      <div className="mt-3 space-y-1">
        {CORE_SURFACES.map((surface) => (
          <div key={surface} className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
            <span>{surface}</span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-sky-800">
              Brain gateway
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-sky-600" />
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
    </div>
  );
}
