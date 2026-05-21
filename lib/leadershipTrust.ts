export type LeadershipConfidenceLabel = "High" | "Medium" | "Low";

export type LeadershipSourceCoverage = {
  key: string;
  label: string;
  count: number;
  href?: string;
  status: "connected" | "partial" | "missing";
  note?: string;
};

export type LeadershipEvidenceRef = {
  id: string;
  label: string;
  href: string;
  sourceModule: string;
  sourceId?: string | null;
  detail?: string;
};

export type LeadershipNextAction = {
  id: string;
  label: string;
  href: string;
  priority: "high" | "medium" | "low";
  detail: string;
};

export type LeadershipTrustMetadata = {
  lastUpdatedAt: string;
  dateWindowLabel: string;
  confidenceLabel: LeadershipConfidenceLabel;
  confidencePercent: number;
  sourceCoverage: LeadershipSourceCoverage[];
  missingSignals: string[];
  evidenceRefs: LeadershipEvidenceRef[];
  nextActions: LeadershipNextAction[];
  executiveSummary: string;
  provenanceNote: string;
};

export type ExplainableRecommendation = {
  id: string;
  kind: string;
  title: string;
  body: string;
  confidence: number;
  created_at: string;
  status?: "active" | "accepted" | "assigned" | "field_used" | "resolved" | "dismissed" | "needs_review";
  priority?: "low" | "medium" | "high" | "critical";
  actionType?:
    | "assign"
    | "request_documentation"
    | "request_inspection"
    | "create_corrective_action"
    | "request_permit"
    | "accountability_review"
    | "stop_work_review";
  ownerTarget?: string;
  ownerUserId?: string | null;
  dueAt?: string | null;
  linkedModule?: string | null;
  linkedRecordId?: string | null;
  verificationRequired?: boolean;
  mitigationState?: string;
  riskReductionPoints?: number;
  sourceModule?: string;
  sourceId?: string | null;
  evidence?: string;
  evidenceRefs?: LeadershipEvidenceRef[];
  businessImpact?: string;
  actionHref?: string;
  acceptedAt?: string | null;
  fieldUsedAt?: string | null;
  resolvedAt?: string | null;
  dismissedAt?: string | null;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function confidenceLabelFromPercent(percent: number): LeadershipConfidenceLabel {
  if (percent >= 75) return "High";
  if (percent >= 45) return "Medium";
  return "Low";
}

export function coverageStatus(count: number): LeadershipSourceCoverage["status"] {
  return count > 0 ? "connected" : "missing";
}

export function trustConfidenceFromCoverage(params: {
  sourceCoverage: LeadershipSourceCoverage[];
  missingSignals?: string[];
  evidenceRefs?: LeadershipEvidenceRef[];
  floor?: number;
}) {
  const sources = params.sourceCoverage;
  if (sources.length === 0) return params.floor ?? 0;
  const connected = sources.filter((source) => source.status === "connected").length;
  const partial = sources.filter((source) => source.status === "partial").length;
  const coverageScore = ((connected + partial * 0.55) / sources.length) * 100;
  const evidenceBoost = Math.min(12, (params.evidenceRefs?.length ?? 0) * 3);
  const missingPenalty = Math.min(30, (params.missingSignals?.length ?? 0) * 5);
  return clampPercent(Math.max(params.floor ?? 0, coverageScore + evidenceBoost - missingPenalty));
}

export function missingSignalsFromCoverage(sourceCoverage: LeadershipSourceCoverage[]) {
  return sourceCoverage
    .filter((source) => source.status === "missing")
    .map((source) => `${source.label} has no records in this window.`);
}

export function buildLeadershipTrustMetadata(params: {
  lastUpdatedAt?: string | null;
  dateWindowLabel: string;
  sourceCoverage: LeadershipSourceCoverage[];
  missingSignals?: string[];
  evidenceRefs?: LeadershipEvidenceRef[];
  nextActions?: LeadershipNextAction[];
  executiveSummary: string;
  provenanceNote: string;
  confidencePercent?: number;
}) {
  const missingSignals = params.missingSignals ?? missingSignalsFromCoverage(params.sourceCoverage);
  const evidenceRefs = params.evidenceRefs ?? [];
  const confidencePercent =
    params.confidencePercent ??
    trustConfidenceFromCoverage({
      sourceCoverage: params.sourceCoverage,
      missingSignals,
      evidenceRefs,
    });

  return {
    lastUpdatedAt: params.lastUpdatedAt || new Date().toISOString(),
    dateWindowLabel: params.dateWindowLabel,
    confidenceLabel: confidenceLabelFromPercent(confidencePercent),
    confidencePercent: clampPercent(confidencePercent),
    sourceCoverage: params.sourceCoverage,
    missingSignals,
    evidenceRefs,
    nextActions: params.nextActions ?? [],
    executiveSummary: params.executiveSummary,
    provenanceNote: params.provenanceNote,
  } satisfies LeadershipTrustMetadata;
}

export function explainRecommendation(params: {
  id: string;
  kind: string;
  title: string;
  body: string;
  confidence: number;
  created_at: string;
  evidence?: string | null;
  sourceModule?: string | null;
  sourceId?: string | null;
  actionHref?: string | null;
  status?: ExplainableRecommendation["status"] | null;
  priority?: ExplainableRecommendation["priority"] | null;
  actionType?: ExplainableRecommendation["actionType"] | null;
  ownerUserId?: string | null;
  dueAt?: string | null;
  linkedModule?: string | null;
  linkedRecordId?: string | null;
  verificationRequired?: boolean | null;
  mitigationState?: string | null;
  riskReductionPoints?: number | null;
  evidenceRefs?: LeadershipEvidenceRef[];
  acceptedAt?: string | null;
  fieldUsedAt?: string | null;
  resolvedAt?: string | null;
  dismissedAt?: string | null;
}) {
  const confidencePercent = clampPercent(params.confidence * 100);
  const kindLabel = params.kind.replace(/[_-]+/g, " ");
  const sourceModule = params.sourceModule || "risk_memory";
  return {
    id: params.id,
    kind: params.kind,
    title: params.title,
    body: params.body,
    confidence: params.confidence,
    created_at: params.created_at,
    status: params.status ?? "active",
    priority: params.priority ?? "medium",
    actionType: params.actionType ?? "assign",
    ownerTarget: "Safety leadership",
    ownerUserId: params.ownerUserId ?? null,
    dueAt: params.dueAt ?? null,
    linkedModule: params.linkedModule ?? null,
    linkedRecordId: params.linkedRecordId ?? null,
    verificationRequired: params.verificationRequired ?? true,
    mitigationState: params.mitigationState ?? "unverified",
    riskReductionPoints: params.riskReductionPoints ?? 0,
    sourceModule,
    sourceId: params.sourceId ?? null,
    evidenceRefs: params.evidenceRefs ?? [],
    evidence:
      params.evidence ||
      `Generated from ${kindLabel} signals with ${confidencePercent}% confidence. Review the source workspace records before assigning work.`,
    businessImpact:
      confidencePercent >= 75
        ? "High confidence recommendation that can reduce near-term exposure if acted on."
        : confidencePercent >= 45
          ? "Moderate confidence recommendation; useful for triage with supervisor review."
          : "Low confidence recommendation; treat as a prompt for review, not a decision.",
    actionHref: params.actionHref || "/analytics?tab=risk",
    acceptedAt: params.acceptedAt ?? null,
    fieldUsedAt: params.fieldUsedAt ?? null,
    resolvedAt: params.resolvedAt ?? null,
    dismissedAt: params.dismissedAt ?? null,
  } satisfies ExplainableRecommendation;
}
