import type { AiKnowledgeNodeType, AiKnowledgeRiskLevel, AiKnowledgeValidationStatus } from "@/lib/aiKnowledgeMap/types";

export const categoryColors: Record<AiKnowledgeNodeType, string> = {
  permit: "#3b82f6",
  task: "#22d3ee",
  hazard: "#f97316",
  control: "#a855f7",
  training: "#22c55e",
  incident: "#ef4444",
  risk_record: "#eab308",
  document: "#7dd3fc",
  observation: "#ec4899",
  corrective_action: "#14b8a6",
  company: "#94a3b8",
  project: "#38bdf8",
  trade: "#c084fc",
  user_role: "#facc15",
};

export function nodeTypeLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function relationshipLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function riskTone(level: AiKnowledgeRiskLevel) {
  if (level === "critical") return { label: "Critical", text: "text-red-200", bg: "bg-red-500/16", border: "border-red-400/35", glow: "#ef4444" };
  if (level === "high") return { label: "High", text: "text-orange-200", bg: "bg-orange-500/16", border: "border-orange-400/35", glow: "#f97316" };
  if (level === "moderate") return { label: "Moderate", text: "text-amber-100", bg: "bg-amber-500/14", border: "border-amber-300/30", glow: "#eab308" };
  if (level === "low") return { label: "Low", text: "text-emerald-100", bg: "bg-emerald-500/14", border: "border-emerald-300/30", glow: "#22c55e" };
  return { label: "Unknown", text: "text-slate-200", bg: "bg-slate-500/14", border: "border-slate-300/20", glow: "#94a3b8" };
}

export function validationTone(status: AiKnowledgeValidationStatus) {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (status === "rejected" || status === "incorrect") return "border-red-400/30 bg-red-400/10 text-red-100";
  if (status === "needs_review") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return "border-sky-300/25 bg-sky-300/10 text-sky-100";
}
