import { Activity, BrainCircuit, GitBranch, ShieldAlert, Database, Clock, CheckCircle2, XCircle, Link2Off, Percent } from "lucide-react";
import type { AiKnowledgeGraphSummary } from "@/lib/aiKnowledgeMap/types";

export function StatsBar({ summary, generatedAt }: { summary: AiKnowledgeGraphSummary; generatedAt: string }) {
  const approvedRelationships = summary.humanApprovedRelationshipCount ?? 0;
  const graphReady = summary.nodeCount > 0 && approvedRelationships > 0;
  const graphThin = summary.nodeCount < 8 || summary.edgeCount < 10;
  const stats = [
    { label: "Total nodes", value: summary.nodeCount, icon: Database },
    { label: "Connections", value: summary.edgeCount, icon: GitBranch },
    { label: "Data sources", value: summary.dataSourceCount, icon: Activity },
    { label: "High risk", value: summary.highRiskNodeCount, icon: ShieldAlert },
    { label: "Suggested", value: summary.suggestedRelationshipCount ?? 0, icon: Activity },
    { label: "Human approved", value: approvedRelationships, icon: CheckCircle2 },
    { label: "Rejected", value: summary.rejectedRelationshipCount ?? 0, icon: XCircle },
    { label: "Unlinked risk", value: summary.unlinkedHighRiskNodeCount ?? 0, icon: Link2Off },
    { label: "Low confidence", value: summary.lowConfidenceCount, icon: ShieldAlert },
    { label: "Avg confidence", value: `${Math.round((summary.averageConfidence ?? 0) * 100)}%`, icon: Percent },
    { label: "Approval rate", value: `${Math.round((summary.relationshipApprovalRate ?? 0) * 100)}%`, icon: CheckCircle2 },
    { label: "False positive", value: `${Math.round((summary.falsePositiveRate ?? 0) * 100)}%`, icon: XCircle },
    { label: "Missed link", value: `${Math.round((summary.missedLinkRate ?? 0) * 100)}%`, icon: Link2Off },
    { label: "Documents", value: summary.documentNodeCount ?? 0, icon: Database },
    { label: "Library", value: summary.sharedLibraryNodeCount ?? 0, icon: Activity },
    { label: "Last updated", value: summary.latestUpdate ? new Date(summary.latestUpdate).toLocaleTimeString() : new Date(generatedAt).toLocaleTimeString(), icon: Clock },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/78 p-3 shadow-2xl backdrop-blur">
      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-sky-50 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">
              AI Engine Brain
            </div>
            <div className="mt-0.5 text-sm font-bold leading-5 text-white">
              Core AI surfaces use Human Review approved graph memory first.
            </div>
          </div>
        </div>
        <div className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${graphReady ? "bg-emerald-300/20 text-emerald-100 ring-1 ring-emerald-300/30" : "bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30"}`}>
          {graphReady ? "Brain active" : "Needs approved links"}
        </div>
      </div>
      {graphThin ? (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-950">
          Approved company graph memory is thin. AI will warn and label fallback or legacy memory as supporting context only.
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              <stat.icon className="h-3.5 w-3.5 text-sky-300" />
              <span className="truncate">{stat.label}</span>
            </div>
            <div className="mt-1 truncate text-lg font-black text-white">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
