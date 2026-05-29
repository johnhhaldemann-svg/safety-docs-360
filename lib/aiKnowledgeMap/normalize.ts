import type { AiKnowledgeNode, AiKnowledgeNodeType, AiKnowledgeRiskLevel, AiKnowledgeSourceRow } from "@/lib/aiKnowledgeMap/types";

const SOURCE_NODE_TYPES: Record<string, AiKnowledgeNodeType> = {
  company_permits: "permit",
  company_jsas: "task",
  company_hazards: "hazard",
  company_controls: "control",
  company_training_requirements: "training",
  company_incidents: "incident",
  company_sor_records: "observation",
  company_corrective_actions: "corrective_action",
  documents: "document",
  company_generated_documents: "document",
  company_risk_ai_recommendations: "risk_record",
};

function text(value: unknown, fallback = ""): string {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => text(item)).filter(Boolean).join(", ");
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

function nullableText(value: unknown) {
  const next = text(value);
  return next || null;
}

export function normalizeRiskLevel(value: unknown, fallback?: unknown): AiKnowledgeRiskLevel {
  const raw = text(value || fallback).toLowerCase();
  if (raw.includes("critical") || raw.includes("stop_work")) return "critical";
  if (raw.includes("high") || raw.includes("urgent") || raw.includes("sif")) return "high";
  if (raw.includes("moderate") || raw.includes("medium") || raw.includes("elevated")) return "moderate";
  if (raw.includes("low")) return "low";
  return "unknown";
}

function riskScoreForLevel(level: AiKnowledgeRiskLevel, explicit: unknown) {
  const score = typeof explicit === "number" ? explicit : Number(text(explicit));
  if (Number.isFinite(score)) return Math.max(0, Math.min(100, score));
  if (level === "critical") return 92;
  if (level === "high") return 78;
  if (level === "moderate") return 55;
  if (level === "low") return 25;
  return null;
}

function minimumRiskScoreForRecord(table: string, row: AiKnowledgeSourceRow, summary: string) {
  const haystack = compactSummary([
    summary,
    row.severity,
    row.incident_type,
    row.injury_type,
    row.treatment_type,
    row.medical_treatment,
    row.recordable,
    row.sif_potential,
    row.stop_work_status,
    row.status,
    row.category,
    row.hazard_category_code,
  ]).toLowerCase();

  if (table === "company_incidents") {
    if (haystack.includes("serious") || haystack.includes("sif") || haystack.includes("high potential") || haystack.includes("critical")) return 80;
    if (haystack.includes("recordable") || haystack.includes("osha recordable") || haystack.includes("lost time")) return 65;
    if (haystack.includes("first aid") || haystack.includes("first-aid")) return 45;
    if (haystack.includes("near miss") || haystack.includes("near-miss") || haystack.includes("nearmiss")) return 25;
    return 35;
  }

  if (table === "company_sor_records") return 5;
  if (table === "company_hazards") return 15;
  return 0;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function vectorCoordinatesForNode(input: {
  sourceTable: string;
  sourceId: string;
  type: AiKnowledgeNodeType;
  riskLevel: AiKnowledgeRiskLevel;
}) {
  const seed = hashString(`${input.sourceTable}:${input.sourceId}:${input.type}`);
  const theta = ((seed % 360) * Math.PI) / 180;
  const phi = ((((seed >>> 8) % 160) + 10) * Math.PI) / 180;
  const riskRadius = input.riskLevel === "critical" ? 1.18 : input.riskLevel === "high" ? 1.08 : input.riskLevel === "moderate" ? 0.96 : 0.86;
  return {
    x: Number((riskRadius * Math.sin(phi) * Math.cos(theta)).toFixed(4)),
    y: Number((riskRadius * Math.sin(phi) * Math.sin(theta)).toFixed(4)),
    z: Number((riskRadius * Math.cos(phi)).toFixed(4)),
    cluster: input.type,
  };
}

function compactSummary(parts: unknown[]) {
  return parts.map((part) => text(part)).filter(Boolean).join(" | ").replace(/\s+/g, " ").slice(0, 1800);
}

function titleFor(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return text(row.title, text(row.permit_type, "Permit"));
  if (table === "company_jsas") return text(row.title, "JSA task");
  if (table === "company_hazards") return text(row.title, text(row.name, "Hazard"));
  if (table === "company_controls") return text(row.title, text(row.name, "Control"));
  if (table === "company_training_requirements") return text(row.title, "Training requirement");
  if (table === "company_incidents") return text(row.title, "Incident");
  if (table === "company_sor_records") return text(row.description, "Observation").slice(0, 140);
  if (table === "company_corrective_actions") return text(row.title, "Corrective action");
  if (table === "documents") return text(row.document_title, text(row.title, text(row.file_name, "Document")));
  if (table === "company_generated_documents") return text(row.title, text(row.document_type, "Generated document"));
  if (table === "company_risk_ai_recommendations") return text(row.title, "Risk recommendation");
  return text(row.title, table);
}

function categoryFor(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return text(row.category, text(row.permit_type, "permit"));
  if (table === "company_training_requirements") return "training";
  if (table === "company_risk_ai_recommendations") return text(row.kind, "risk");
  if (table === "documents") return text(row.category, text(row.document_type, "document"));
  return text(row.category, text(row.status, SOURCE_NODE_TYPES[table] ?? "record"));
}

function descriptionFor(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return compactSummary([row.description, row.assignment_rationale, row.permit_type, row.stop_work_status]);
  if (table === "company_training_requirements") return compactSummary([row.match_keywords, row.match_fields, row.apply_trades, row.apply_positions]);
  if (table === "company_sor_records") return compactSummary([row.description, row.subcategory, row.hazard_category_code, row.location]);
  if (table === "company_risk_ai_recommendations") return compactSummary([row.body, row.kind, row.confidence]);
  if (table === "documents") return compactSummary([row.notes, row.document_type, row.category, row.project_name]);
  return compactSummary([row.description, row.summary, row.notes, row.status]);
}

function riskInputs(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return [row.severity, row.stop_work_status, row.escalation_level];
  if (table === "company_incidents") return [row.severity, row.escalation_level, row.stop_work_status];
  if (table === "company_sor_records") return [row.severity, row.hazard_category_code];
  if (table === "company_corrective_actions") return [row.priority, row.severity, row.sif_potential];
  if (table === "company_risk_ai_recommendations") return [row.severity, row.kind, row.confidence];
  return [row.risk_level, row.severity, row.priority];
}

export function sourceKey(table: string, sourceId: string) {
  return `${table}:${sourceId}`;
}

export function normalizeSourceRowToKnowledgeNode(table: string, row: AiKnowledgeSourceRow): AiKnowledgeNode | null {
  const companyId = text(row.company_id);
  const sourceId = text(row.id);
  const type = SOURCE_NODE_TYPES[table];
  if (!companyId || !sourceId || !type) return null;

  const riskLevel = normalizeRiskLevel(riskInputs(table, row).find(Boolean));
  const title = titleFor(table, row).slice(0, 500);
  const description = descriptionFor(table, row);
  const semanticSummary = compactSummary([
    title,
    categoryFor(table, row),
    type,
    description,
    row.project,
    row.project_name,
    row.trade,
    row.location,
    row.hazard_category_code,
    row.permit_type,
    row.injury_type,
    row.apply_trades,
    row.apply_positions,
    row.match_keywords,
  ]);
  const vectorCoordinates = vectorCoordinatesForNode({ sourceTable: table, sourceId, type, riskLevel });
  const baseRiskScore = riskScoreForLevel(riskLevel, row.risk_score ?? row.score);
  const minimumRiskScore = minimumRiskScoreForRecord(table, row, semanticSummary);
  const riskScore = baseRiskScore == null ? (minimumRiskScore > 0 ? minimumRiskScore : null) : Math.max(baseRiskScore, minimumRiskScore);

  return {
    companyId,
    jobsiteId: nullableText(row.jobsite_id),
    projectId: nullableText(row.project_id),
    sourceTable: table,
    sourceId,
    sourceRecordId: sourceId,
    title,
    category: categoryFor(table, row).slice(0, 120) || "uncategorized",
    nodeType: type,
    type,
    description,
    project: nullableText(row.project ?? row.project_name),
    trade: nullableText(row.trade ?? row.apply_trades),
    riskLevel,
    riskScore,
    sourceUrl: nullableText(row.source_url ?? row.final_file_path ?? row.file_name),
    sourceDocument: nullableText(row.final_file_path ?? row.file_name ?? row.source_url),
    metadata: {
      source: "rebuild-index",
      originalStatus: nullableText(row.status),
      originalCategory: nullableText(row.category),
      minimumRiskScore,
      rawMetadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
    },
    semanticSummary: semanticSummary || title,
    vectorStatus: "pending",
    vectorCoordinates,
    confidenceScore: 0.72,
    validationStatus: "unreviewed",
    createdByType: "system",
  };
}

export function normalizeSourceRowsToKnowledgeNodes(table: string, rows: AiKnowledgeSourceRow[]) {
  return rows.map((row) => normalizeSourceRowToKnowledgeNode(table, row)).filter((node): node is AiKnowledgeNode => Boolean(node));
}
