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
  status?: "active" | "accepted" | "dismissed" | "needs_review";
  ownerTarget?: string;
  sourceModule?: string;
  sourceId?: string | null;
  evidence?: string;
  businessImpact?: string;
  actionHref?: string;
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
    status: "active",
    ownerTarget: "Safety leadership",
    sourceModule,
    sourceId: params.sourceId ?? null,
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
  } satisfies ExplainableRecommendation;
}
