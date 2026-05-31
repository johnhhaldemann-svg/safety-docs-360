"use client";

import { useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { ConnectionLine } from "@/components/ai-knowledge-map/ConnectionLine";
import { nodeTypeLabel, riskTone, validationTone } from "@/components/ai-knowledge-map/mapTheme";
import { suggestPotentialRelationshipsForNode } from "@/lib/aiKnowledgeMap/relationships";
import { isTrustedMemoryStale } from "@/lib/aiKnowledgeMap/reviewGate";
import type { AiKnowledgeEdge, AiKnowledgeNode, AiKnowledgeProvenanceCertificate } from "@/lib/aiKnowledgeMap/types";

type ReviewStatus = "approved" | "rejected" | "incorrect";

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
  onValidate: (edge: AiKnowledgeEdge, status: ReviewStatus, reason?: string) => void;
}) {
  const [pendingReview, setPendingReview] = useState<{ edgeKey: string; status: Exclude<ReviewStatus, "approved">; reason: string } | null>(null);

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
  const isSharedLibrary = node.metadata.sharedLibrary === true;
  const isCompanyDocument = !isFallback && !isSharedLibrary && node.nodeType === "document";
  const memoryLabel = isFallback ? "General fallback guidance" : isSharedLibrary ? "Shared approved library guidance" : isCompanyDocument ? "Company document memory" : "Company graph memory";
  const companyName = isFallback || isSharedLibrary ? memoryLabel : companies.find((company) => company.id === node.companyId)?.name ?? node.companyId ?? "All companies";
  const related = edges.filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id || edge.fromNodeId === node.id || edge.toNodeId === node.id).slice(0, 10);
  const approvedRelationships = related.filter((edge) => edge.validationStatus === "approved");
  const suggestedRelationships = related.filter((edge) => edge.validationStatus !== "approved");
  const potentialRelationships = related.length === 0 ? suggestPotentialRelationshipsForNode(node, nodes) : [];
  const recommendedControls = related
    .filter((edge) => edge.relationshipType.includes("control") || edge.relationshipType === "required_control")
    .map((edge) => edge.reason)
    .slice(0, 3);
  const connectedRisks = related
    .filter((edge) => edge.relationshipType.includes("risk") || edge.relationshipType === "repeat_trend" || edge.relationshipType === "predictive_risk_signal" || edge.relationshipType === "related_hazard")
    .map((edge) => edge.reason)
    .slice(0, 3);
  const hasHighRisk = node.riskLevel === "critical" || node.riskLevel === "high" || (node.riskScore ?? 0) >= 65;
  const trend = node.riskLevel === "critical" || node.riskLevel === "high" ? "Increasing attention" : "Stable";
  const provenance = provenanceCertificate(node.metadata);
  const reviewDueAt = text(node.metadata.reviewDueAt) ?? provenance?.reviewDueAt ?? null;
  const stale = isTrustedMemoryStale(node.metadata);

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
      <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-xs font-bold text-amber-100">
        This AI Knowledge Map item does not prove compliance. Confirm source records, site conditions, and required controls before relying on it.
      </p>
      <dl className="mt-4 grid gap-2 text-xs text-slate-300">
        <Row label="Category" value={node.category} />
        <Row label="Risk score" value={node.riskScore == null ? "Not scored" : String(node.riskScore)} />
        <Row label="Trend" value={trend} />
        <Row label="Confidence" value={`${Math.round((node.confidenceScore ?? 0.72) * 100)}%`} />
        <Row label="Validation" value={node.validationStatus.replace(/_/g, " ")} badgeClass={validationTone(node.validationStatus)} />
        <Row label="Memory layer" value={memoryLabel} badgeClass={isSharedLibrary ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : isFallback ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : undefined} />
        {reviewDueAt ? <Row label="Review due" value={new Date(reviewDueAt).toLocaleDateString()} badgeClass={stale ? "border-red-300/25 bg-red-300/10 text-red-100" : undefined} /> : null}
        {isFallback || isSharedLibrary ? <Row label="Company-specific" value="No, approved general guidance" /> : null}
        <Row label="Company" value={companyName} />
        <Row label="Source" value={isFallback ? String(node.metadata.fallbackSource ?? "approved fallback") : isSharedLibrary ? String(node.metadata.sharedLibrarySource ?? node.sourceTable) : `${node.sourceTable}:${node.sourceId}`} />
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
        <InsightSection
          title="Node summary"
          items={[
            node.semanticSummary || node.description || node.title,
            `AI interpretation: ${node.nodeType} memory from ${node.sourceTable} with ${node.riskLevel} risk context.`,
          ]}
        />
        <InsightSection
          title="Connected risks"
          items={connectedRisks.length > 0 ? connectedRisks : [hasHighRisk ? "High-risk node needs confirmed relationships, controls, and follow-up." : "No approved risk connections are visible yet."]}
        />
        <InsightSection
          title="Recommended controls"
          items={recommendedControls.length > 0 ? recommendedControls : [potentialRelationships.some((item) => item.relationshipType === "required_control") ? "Potential control relationship exists but needs Human Review approval." : "No control recommendation has been approved for this node yet."]}
        />
        <InsightSection
          title="Predictive risk impact"
          items={[related.some((edge) => edge.relationshipType === "repeat_trend" || edge.relationshipType === "predictive_risk_signal") ? "This node contributes to trend or predictive-risk review." : hasHighRisk ? "Potential predictive-risk signal until relationships are reviewed." : "No predictive-risk signal confirmed yet."]}
        />
        <InsightSection
          title="Required follow-up"
          items={[approvedRelationships.length === 0 && potentialRelationships.length > 0 ? "Review suggested relationships before this node is treated as trusted connected memory." : hasHighRisk ? "Confirm controls, training, and corrective actions are connected and current." : "Continue normal review cadence."]}
        />
        <InsightSection
          title="Learning impact"
          items={["Approving accurate relationships increases confidence for similar future matches. Rejecting or marking incorrect lowers confidence for similar signals."]}
        />
        {provenance ? (
          <section className="mb-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
            <h3 className="text-xs font-black uppercase tracking-[0.12em] text-emerald-100">Provenance certificate</h3>
            <div className="mt-2 space-y-1.5 text-xs leading-5 text-emerald-50/90">
              <p>Promoted from candidate {provenance.candidateId} by {provenance.reviewerIds.length} reviewer{provenance.reviewerIds.length === 1 ? "" : "s"}.</p>
              <p>Source: {provenance.sourceTable ?? "unknown"}:{provenance.sourceId ?? "unknown"}; compliance proof: no.</p>
              <p>Use: {provenance.safetyUse}. Review due {new Date(provenance.reviewDueAt).toLocaleDateString()}.</p>
              {stale ? <p className="font-black text-red-100">This trusted memory is stale and needs Super Admin review before being treated as current.</p> : null}
            </div>
          </section>
        ) : null}
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-300" />
          <h3 className="text-sm font-black text-white">Why it connects</h3>
        </div>
        <div className="mt-3 space-y-3">
          {approvedRelationships.length > 0 ? <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-200">Approved relationships</p> : null}
          {related.map((edge) => {
            const edgeKey = reviewEdgeKey(edge);
            const activeReview = pendingReview?.edgeKey === edgeKey ? pendingReview : null;
            const canConfirm = activeReview ? activeReview.reason.replace(/\s+/g, " ").trim().length >= 12 : false;
            const otherId = edge.sourceNodeId === node.id || edge.fromNodeId === node.id ? edge.targetNodeId ?? edge.toNodeId : edge.sourceNodeId ?? edge.fromNodeId;
            const other = byId.get(otherId);
            return (
              <div key={edgeKey} className="space-y-2">
                <ConnectionLine edge={edge} />
                {edge.evidenceText ? <p className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-[11px] font-semibold leading-5 text-slate-400">Evidence: {edge.evidenceText}</p> : null}
                {other ? <p className="text-[11px] font-semibold text-slate-500">Related record: {other.title}</p> : null}
                {edge.createdByType === "ai" || edge.validationStatus !== "approved" ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <ReviewButton label="Approve" onClick={() => onValidate(edge, "approved")} />
                    <ReviewButton label="Reject" onClick={() => setPendingReview({ edgeKey, status: "rejected", reason: "" })} />
                    <ReviewButton label="Incorrect" onClick={() => setPendingReview({ edgeKey, status: "incorrect", reason: "" })} danger />
                  </div>
                ) : null}
                {activeReview ? (
                  <div className="rounded-lg border border-white/10 bg-black/15 p-3">
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300" htmlFor={`selected-node-review-${edgeKey}`}>
                      Reason for marking {activeReview.status.replace(/_/g, " ")}
                    </label>
                    <textarea
                      id={`selected-node-review-${edgeKey}`}
                      value={activeReview.reason}
                      onChange={(event) => setPendingReview({ ...activeReview, reason: event.target.value })}
                      className="mt-2 min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      placeholder="Example: This relationship is incorrect because the source evidence does not support this connection."
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ReviewButton
                        label={`Confirm ${activeReview.status === "incorrect" ? "Incorrect" : "Reject"}`}
                        danger={activeReview.status === "incorrect"}
                        disabled={!canConfirm}
                        onClick={() => {
                          if (!canConfirm) return;
                          onValidate(edge, activeReview.status, activeReview.reason.trim());
                          setPendingReview(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setPendingReview(null)}
                        className="min-h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-slate-200 hover:bg-white/[0.08]"
                      >
                        Cancel
                      </button>
                    </div>
                    {!canConfirm ? <p className="mt-2 text-[11px] font-bold text-amber-100">Add a meaningful reason, at least 12 characters, before submitting.</p> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {suggestedRelationships.length > 0 ? <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-200">Suggested relationships need review: {suggestedRelationships.length}</p> : null}
          {related.length === 0 && potentialRelationships.length > 0 ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
              <p className="text-sm font-black text-amber-100">Potential relationships found but not yet approved.</p>
              <div className="mt-3 space-y-2">
                {potentialRelationships.map((suggestion) => (
                  <div key={`${suggestion.relationshipType}-${suggestion.label}`} className="rounded-md border border-amber-200/20 bg-black/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-amber-50">{suggestion.label}</p>
                      <span className="rounded border border-amber-200/25 px-2 py-0.5 text-[10px] font-black text-amber-100">{Math.round(suggestion.confidenceScore * 100)}%</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-amber-100/90">{suggestion.reason}</p>
                    <p className="mt-1 text-[11px] leading-5 text-amber-100/70">{suggestion.evidenceText}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {related.length === 0 && potentialRelationships.length === 0 ? <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">No relationships generated for this node yet.</p> : null}
        </div>
      </div>
    </aside>
  );
}

function provenanceCertificate(metadata: Record<string, unknown>) {
  const certificate = metadata.provenanceCertificate;
  return certificate && typeof certificate === "object" && !Array.isArray(certificate)
    ? certificate as AiKnowledgeProvenanceCertificate
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function reviewEdgeKey(edge: AiKnowledgeEdge) {
  return edge.id ?? `${edge.sourceNodeId}-${edge.targetNodeId}-${edge.relationshipType}`;
}

function InsightSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <h3 className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{title}</h3>
      <div className="mt-2 space-y-1.5">
        {items.filter(Boolean).map((item) => (
          <p key={item} className="text-xs leading-5 text-slate-300">{item}</p>
        ))}
      </div>
    </section>
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

function ReviewButton({ label, onClick, danger, disabled = false }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      className={`min-h-10 rounded-md border px-2 py-1.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45 ${danger ? "border-red-400/25 bg-red-400/10 text-red-100 hover:bg-red-400/16" : "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"}`}
    >
      {label}
    </button>
  );
}
