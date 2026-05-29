import { createHash } from "node:crypto";
import type { CompanyMemoryItemRow } from "@/lib/companyMemory/types";
import type { TrustedKnowledgeGraphMemoryItem } from "@/lib/aiKnowledgeMap/types";
import type {
  ApprovedKnowledgeRow,
  GusCitationSnippet,
  GusLearningAnswer,
  GusGraphCitationSnippet,
  GusQualitySignals,
  GusRequiredControlType,
} from "@/lib/gusLearning/types";

export const UNSUPPORTED_REQUIREMENT_WARNING =
  "I do not have a verified source for that requirement. This should be reviewed by a qualified safety professional before being used as official guidance.";

const CONTROL_LABELS: Record<GusRequiredControlType, string> = {
  regulatory_requirement: "OSHA / regulatory requirement",
  company_policy: "company policy",
  site_requirement: "site-specific requirement",
  manufacturer_instruction: "manufacturer instruction",
  best_practice: "best practice",
  ai_suggestion: "AI recommendation",
};

function clean(value: string | null | undefined, max = 500) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isExpired(row: ApprovedKnowledgeRow, now = new Date()) {
  const due = Date.parse(row.review_due_date);
  if (!Number.isFinite(due)) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return due < today.getTime() || row.review_status === "needs_review";
}

function hasSpecificCitation(row: ApprovedKnowledgeRow) {
  return Boolean(clean(row.citation_excerpt, 1_000)) && Boolean(clean(row.citation_locator, 200));
}

export function calculateKnowledgeQualityScore(row: ApprovedKnowledgeRow, now = new Date()) {
  let score = 35;
  if (row.is_active) score += 10;
  if (!isExpired(row, now)) score += 18;
  if (hasSpecificCitation(row)) score += 18;
  else if (clean(row.citation_excerpt, 1_000) || clean(row.citation_locator, 200)) score += 8;
  if (row.source_content_hash) score += 6;
  if (clean(row.verification_notes, 500)) score += 4;
  if (row.required_control_type !== "ai_suggestion") score += 5;
  if (row.required_control_type === "regulatory_requirement" && row.regulation_reference) score += 4;

  const approved = Date.parse(row.approved_at);
  if (Number.isFinite(approved)) {
    const ageDays = Math.max(0, (now.getTime() - approved) / (24 * 60 * 60 * 1000));
    if (ageDays <= 180) score += 5;
    else if (ageDays > 730) score -= 6;
  }
  if (row.superseded_by_knowledge_id) score -= 35;
  if (row.review_status === "needs_review") score -= 18;
  if (!row.is_active) score -= 40;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function priority(row: ApprovedKnowledgeRow, projectId?: string | null) {
  if (projectId && row.project_id === projectId) return 0;
  if (row.required_control_type === "site_requirement") return 1;
  if (row.required_control_type === "company_policy") return 2;
  if (row.required_control_type === "regulatory_requirement") return 4;
  if (row.required_control_type === "manufacturer_instruction") return 5;
  if (row.required_control_type === "best_practice") return 6;
  return 7;
}

export function rankApprovedKnowledge(rows: ApprovedKnowledgeRow[], projectId?: string | null, now = new Date()) {
  return rows
    .slice()
    .sort((a, b) => {
      const activeDelta = Number(b.is_active) - Number(a.is_active);
      if (activeDelta) return activeDelta;
      const expiredDelta = Number(isExpired(a, now)) - Number(isExpired(b, now));
      if (expiredDelta) return expiredDelta;
      const priorityDelta = priority(a, projectId) - priority(b, projectId);
      if (priorityDelta) return priorityDelta;
      const qualityDelta = calculateKnowledgeQualityScore(b, now) - calculateKnowledgeQualityScore(a, now);
      if (qualityDelta) return qualityDelta;
      return Date.parse(b.approved_at) - Date.parse(a.approved_at);
    });
}

function sourceBasis(rows: ApprovedKnowledgeRow[]) {
  const byType: Record<string, string[]> = {
    "OSHA / regulatory": [],
    "Company policy": [],
    "Site-specific": [],
    Manufacturer: [],
    "Best practice": [],
  };

  for (const row of rows) {
    const label = `${row.knowledge_title}${row.regulation_reference ? ` (${row.regulation_reference})` : ""} - ${row.source_url}`;
    if (row.required_control_type === "regulatory_requirement") byType["OSHA / regulatory"].push(label);
    if (row.required_control_type === "company_policy") byType["Company policy"].push(label);
    if (row.required_control_type === "site_requirement") byType["Site-specific"].push(label);
    if (row.required_control_type === "manufacturer_instruction") byType.Manufacturer.push(label);
    if (row.required_control_type === "best_practice") byType["Best practice"].push(label);
  }

  return Object.entries(byType)
    .map(([label, values]) => `- ${label}: ${values.length ? values.slice(0, 3).join("; ") : "None found."}`)
    .join("\n");
}

function citationSnippet(row: ApprovedKnowledgeRow): GusCitationSnippet {
  return {
    knowledgeId: row.id,
    title: row.knowledge_title,
    url: row.source_url,
    classification: row.required_control_type,
    excerpt: clean(row.citation_excerpt, 700) || clean(row.approved_summary, 400) || null,
    locator: clean(row.citation_locator, 180) || row.regulation_reference || null,
    reviewStatus: row.review_status,
    qualityScore: Math.round(Number(row.quality_score || calculateKnowledgeQualityScore(row))),
  };
}

function graphCitationSnippet(item: TrustedKnowledgeGraphMemoryItem): GusGraphCitationSnippet {
  return {
    graphMemoryId: item.id,
    nodeId: item.nodeId,
    title: item.title,
    excerpt: clean(item.excerpt, 700),
    sourceTable: item.sourceTable,
    sourceId: item.sourceId,
    riskLevel: item.riskLevel,
    confidenceScore: item.confidenceScore,
  };
}

function qualitySignals(rows: ApprovedKnowledgeRow[], now = new Date()): GusQualitySignals {
  if (!rows.length) {
    return {
      averageQualityScore: 0,
      lowestQualityScore: 0,
      weakCitationCount: 0,
      expiredCitationCount: 0,
      selectedKnowledgeCount: 0,
    };
  }
  const scores = rows.map((row) => Math.round(Number(row.quality_score || calculateKnowledgeQualityScore(row, now))));
  return {
    averageQualityScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    lowestQualityScore: Math.min(...scores),
    weakCitationCount: rows.filter((row) => !hasSpecificCitation(row) || Number(row.quality_score || calculateKnowledgeQualityScore(row, now)) < 55).length,
    expiredCitationCount: rows.filter((row) => isExpired(row, now)).length,
    selectedKnowledgeCount: rows.length,
  };
}

function confidenceFor(rows: ApprovedKnowledgeRow[]) {
  if (rows.length === 0) return "Low" as const;
  if (rows.some((row) => row.required_control_type === "regulatory_requirement" || row.required_control_type === "company_policy" || row.required_control_type === "site_requirement")) {
    return rows.some((row) => row.review_status === "needs_review") ? ("Medium" as const) : ("High" as const);
  }
  if (rows.some((row) => row.required_control_type === "manufacturer_instruction")) return "Medium" as const;
  return "Low" as const;
}

function answerId(question: string, rows: ApprovedKnowledgeRow[]) {
  const hash = createHash("sha256");
  hash.update(question);
  for (const row of rows) hash.update(row.id);
  return `gus-${hash.digest("hex").slice(0, 16)}`;
}

export function buildVerifiedSafetyAnswer(params: {
  question: string;
  companyId: string | null;
  projectId?: string | null;
  knowledge: ApprovedKnowledgeRow[];
  uploadedDocumentMatches?: CompanyMemoryItemRow[];
  graphMemoryMatches?: TrustedKnowledgeGraphMemoryItem[];
  now?: Date;
}): GusLearningAnswer {
  const ranked = rankApprovedKnowledge(params.knowledge, params.projectId, params.now).slice(0, 8);
  const expired = ranked.filter((row) => isExpired(row, params.now));
  const current = ranked.filter((row) => !isExpired(row, params.now));
  const usable = current.length ? current : ranked;
  const uploadedDocs = (params.uploadedDocumentMatches ?? []).filter((row) => row.source === "document_upload").slice(0, 3);
  const graphMemory = (params.graphMemoryMatches ?? []).slice(0, 4);
  const graphBasis = graphMemory.length
    ? graphMemory.map((item) => `- ${item.title}: ${clean(item.excerpt, 260)} (${item.sourceTable}:${item.sourceId})`).join("\n")
    : "- None found.";

  if (usable.length === 0) {
    const text = [
      "Answer:",
      UNSUPPORTED_REQUIREMENT_WARNING,
      "",
      "Source Basis:",
      "- OSHA / regulatory: None found.",
      "- Company policy: None found.",
      "- Site-specific: None found.",
      "- Manufacturer: None found.",
      "- Best practice: None found.",
      "- Approved Knowledge Graph:",
      graphBasis,
      "",
      "Confidence:",
      "Low",
      "",
      "Limits:",
      UNSUPPORTED_REQUIREMENT_WARNING,
      uploadedDocs.length
        ? `Uploaded project documents were found (${uploadedDocs.map((doc) => doc.title).join(", ")}), but they are not approved knowledge records and cannot create official requirements by themselves.`
        : "No approved knowledge record matched this question.",
      graphMemory.length
        ? "Approved graph memory may describe related company records and risk context, but no approved requirement source matched this question."
        : null,
      "",
      "Recommended Action:",
      "Route this question to a qualified safety professional or company admin for source review before using it as official guidance.",
    ].filter(Boolean).join("\n");
    return {
      answerId: answerId(params.question, []),
      text,
      confidence: "Low",
      citations: [],
      citationSnippets: [],
      graphCitationSnippets: graphMemory.map(graphCitationSnippet),
      statements: [],
      qualitySignals: qualitySignals([]),
      unsupported: true,
      needsReview: true,
    };
  }

  const selected = usable.slice(0, 4);
  const statements = selected.map((row) => {
    return {
      classification: row.required_control_type,
      text: clean(row.approved_summary, 380),
      knowledgeId: row.id,
    };
  });
  const summaryLines = statements.map((statement) => `- ${CONTROL_LABELS[statement.classification]}: ${statement.text}`);
  const limits = [
    expired.length ? `${expired.length} matching knowledge item${expired.length === 1 ? " is" : "s are"} past review due date and may be outdated.` : null,
    uploadedDocs.length
      ? `Uploaded project documents may add context (${uploadedDocs.map((doc) => doc.title).join(", ")}), but only approved knowledge records are treated as verified safety knowledge.`
      : null,
    graphMemory.length
      ? "Approved Knowledge Graph records add company-specific context, relationships, and risk history; they do not override current law, procedures, competent-person review, or site conditions."
      : null,
    "Gus cannot approve work, guarantee compliance, or replace the competent person, qualified person, AHJ, or company safety professional.",
  ].filter(Boolean);

  const text = [
    "Answer:",
    summaryLines.join("\n"),
    "",
    "Source Basis:",
    sourceBasis(usable),
    "- Approved Knowledge Graph:",
    graphBasis,
    "",
    "Confidence:",
    confidenceFor(usable),
    "",
    "Limits:",
    limits.join("\n"),
    "",
    "Recommended Action:",
    "Verify the task, site conditions, crew qualifications, permits, and controls with the assigned safety reviewer before work proceeds.",
  ].join("\n");

  return {
    answerId: answerId(params.question, usable),
    text,
    confidence: confidenceFor(usable),
    citations: usable.map((row) => ({
      knowledgeId: row.id,
      title: row.knowledge_title,
      url: row.source_url,
      sourceType: row.source_type,
      classification: row.required_control_type,
      reviewStatus: row.review_status,
      qualityScore: Math.round(Number(row.quality_score || calculateKnowledgeQualityScore(row, params.now))),
    })),
    citationSnippets: usable.map(citationSnippet),
    graphCitationSnippets: graphMemory.map(graphCitationSnippet),
    statements,
    qualitySignals: qualitySignals(usable, params.now),
    unsupported: false,
    needsReview: expired.length > 0,
  };
}
