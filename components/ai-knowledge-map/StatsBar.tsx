import { Activity, GitBranch, ShieldAlert, Database, Clock, CheckCircle2, XCircle, Link2Off, Percent } from "lucide-react";
import type { AiKnowledgeGraphSummary } from "@/lib/aiKnowledgeMap/types";

export function StatsBar({ summary, generatedAt }: { summary: AiKnowledgeGraphSummary; generatedAt: string }) {
  const stats = [
    { label: "Total nodes", value: summary.nodeCount, icon: Database },
    { label: "Connections", value: summary.edgeCount, icon: GitBranch },
    { label: "Data sources", value: summary.dataSourceCount, icon: Activity },
    { label: "High risk", value: summary.highRiskNodeCount, icon: ShieldAlert },
    { label: "Suggested", value: summary.suggestedRelationshipCount ?? 0, icon: Activity },
    { label: "Human approved", value: summary.humanApprovedRelationshipCount ?? 0, icon: CheckCircle2 },
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
    <div className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/78 p-3 shadow-2xl backdrop-blur md:grid-cols-4 xl:grid-cols-8">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            <stat.icon className="h-3.5 w-3.5 text-sky-300" />
            {stat.label}
          </div>
          <div className="mt-1 text-lg font-black text-white">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
