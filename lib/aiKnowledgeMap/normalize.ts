import type { AiKnowledgeNode, AiKnowledgeNodeType, AiKnowledgeRiskLevel, AiKnowledgeSourceRow } from "@/lib/aiKnowledgeMap/types";
import { nodeTypeForSourceTable } from "@/lib/aiKnowledgeMap/sourceAdapters";
import { isPredictionGatedTable, passesPredictionGate, predictionConfidenceDelta } from "@/lib/aiKnowledgeMap/predictionGate";
import { normalizePredictionReviewRating, normalizePredictionValidationStatus } from "@/lib/predictionValidation";

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
  if (table === "company_employee_training_records") return text(row.title, text(row.training_title, "Employee training record"));
  if (table === "company_induction_programs") return text(row.name, "Induction program");
  if (table === "company_induction_requirements") return text(row.title, text(row.name, "Induction requirement"));
  if (table === "company_induction_completions") return text(row.title, "Induction completion");
  if (table === "company_toolbox_sessions") return text(row.topic, text(row.title, "Toolbox briefing"));
  if (table === "company_toolbox_attendees") return text(row.attendee_name, text(row.user_name, "Toolbox attendee"));
  if (table === "company_incidents") return text(row.title, "Incident");
  if (table === "company_sor_records") return text(row.description, "Observation").slice(0, 140);
  if (table === "company_jobsite_audits") return text(row.auditors, text(row.selected_trade, "Field audit"));
  if (table === "company_jobsite_audit_observations") return text(row.item_label, text(row.category_label, "Field audit observation"));
  if (table === "company_corrective_actions") return text(row.title, "Corrective action");
  if (table === "company_jobsite_chemicals") return text(row.chemical_name, "Chemical / SDS record");
  if (table === "company_jobsite_visual_zones") return text(row.label, "Site visual risk zone");
  if (table === "company_crews") return text(row.name, "Crew");
  if (table === "company_employee_profiles") return text(row.full_name, text(row.name, "Worker profile"));
  if (table === "company_employee_jobsite_assignments") return text(row.assignment_label, "Worker jobsite assignment");
  if (table === "company_jobsites") return text(row.name, text(row.project_name, "Jobsite"));
  if (table === "documents") return text(row.document_title, text(row.title, text(row.file_name, "Document")));
  if (table === "company_generated_documents") return text(row.title, text(row.document_type, "Generated document"));
  if (table === "company_risk_ai_recommendations") return text(row.title, "Risk recommendation");
  return text(row.title, table);
}

function categoryFor(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return text(row.category, text(row.permit_type, "permit"));
  if (table === "company_training_requirements" || table === "company_employee_training_records") return "training";
  if (table.startsWith("company_induction_")) return "induction";
  if (table.startsWith("company_toolbox_")) return "toolbox briefing";
  if (table === "company_jobsite_chemicals") return "chemical / SDS";
  if (table === "company_jobsite_visual_zones") return text(row.source_type, "site visual zone");
  if (table === "company_jobsite_audits" || table === "company_jobsite_audit_observations") return text(row.category_label, text(row.category_code, "field audit"));
  if (table === "company_crews" || table === "company_employee_profiles" || table === "company_employee_jobsite_assignments") return "workforce";
  if (table === "company_jobsites") return "jobsite";
  if (table === "company_risk_ai_recommendations") return text(row.kind, "risk");
  if (table === "documents") return text(row.category, text(row.document_type, "document"));
  return text(row.category, text(row.status, nodeTypeForSourceTable(table) ?? "record"));
}

function descriptionFor(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return compactSummary([row.description, row.assignment_rationale, row.permit_type, row.stop_work_status]);
  if (table === "company_training_requirements") return compactSummary([row.match_keywords, row.match_fields, row.apply_trades, row.apply_positions]);
  if (table === "company_employee_training_records") return compactSummary([row.provider, row.completed_on, row.expires_on, row.notes, row.evidence]);
  if (table === "company_induction_programs") return compactSummary([row.description, row.audience, row.active]);
  if (table === "company_induction_requirements") return compactSummary([row.program_id, row.jobsite_id, row.active, row.required_for_role]);
  if (table === "company_induction_completions") return compactSummary([row.subject_type, row.user_id, row.completed_at, row.expires_at]);
  if (table === "company_toolbox_sessions") return compactSummary([row.topic, row.status, row.scheduled_for, row.completed_at, row.notes]);
  if (table === "company_toolbox_attendees") return compactSummary([row.attendee_name, row.user_id, row.signed_at, row.status]);
  if (table === "company_sor_records") return compactSummary([row.description, row.subcategory, row.hazard_category_code, row.location]);
  if (table === "company_jobsite_audits") return compactSummary([row.selected_trade, row.template_source, row.status, row.score_summary, row.payload]);
  if (table === "company_jobsite_audit_observations") return compactSummary([row.item_label, row.category_label, row.status, row.severity, row.notes, row.evidence_metadata]);
  if (table === "company_risk_ai_recommendations") return compactSummary([row.body, row.kind, row.confidence]);
  if (table === "company_jobsite_chemicals") return compactSummary([row.chemical_name, row.manufacturer, row.quantity_note, row.sds_file_path, row.sds_effective_date, row.next_review_date]);
  if (table === "company_jobsite_visual_zones") return compactSummary([row.label, row.zone_type, row.source_type, row.risk_level, row.notes, row.metadata]);
  if (table === "company_crews") return compactSummary([row.name, row.active, row.jobsite_id]);
  if (table === "company_employee_profiles") return compactSummary([row.full_name, row.name, row.trade, row.position, row.status, row.equipment, row.certifications]);
  if (table === "company_employee_jobsite_assignments") return compactSummary([row.employee_id, row.jobsite_id, row.role, row.starts_on, row.ends_on, row.status]);
  if (table === "company_jobsites") return compactSummary([row.name, row.address, row.status, row.safety_lead, row.project_type]);
  if (table === "documents") return compactSummary([row.notes, row.document_type, row.category, row.project_name]);
  return compactSummary([row.description, row.summary, row.notes, row.status]);
}

function riskInputs(table: string, row: AiKnowledgeSourceRow) {
  if (table === "company_permits") return [row.severity, row.stop_work_status, row.escalation_level];
  if (table === "company_incidents") return [row.severity, row.escalation_level, row.stop_work_status];
  if (table === "company_sor_records" || table === "company_jobsite_audit_observations") return [row.severity, row.hazard_category_code, row.category_code];
  if (table === "company_corrective_actions") return [row.priority, row.severity, row.sif_potential];
  if (table === "company_risk_ai_recommendations") return [row.severity, row.kind, row.confidence];
  if (table === "company_jobsite_chemicals") return [row.risk_level, row.sds_file_path ? null : "high", row.next_review_date];
  if (table === "company_jobsite_visual_zones") return [row.risk_level, row.severity, row.zone_type];
  if (table === "company_employee_training_records" || table === "company_induction_completions") return [row.expires_on, row.expired, row.status];
  return [row.risk_level, row.severity, row.priority];
}

function sourceEvidenceFor(table: string, row: AiKnowledgeSourceRow, title: string, summary: string) {
  return [
    {
      sourceTable: table,
      sourceRecordId: text(row.id),
      label: title,
      detail: summary.slice(0, 500) || `${table} record indexed into the AI Knowledge Map.`,
    },
  ];
}

function confidenceFor(table: string, row: AiKnowledgeSourceRow, summary: string) {
  let confidence = 0.72;
  if (table === "company_jobsite_audit_observations" && text(row.status) === "fail") confidence += 0.08;
  if (table === "company_employee_training_records" && text(row.evidence)) confidence += 0.08;
  if (table === "company_jobsite_chemicals" && text(row.sds_file_path)) confidence += 0.08;
  if (table === "company_jobsite_visual_zones") confidence += 0.04;
  // Prediction Validation quality rating (1–5) weights records it reviews.
  if (isPredictionGatedTable(table)) confidence += predictionConfidenceDelta(row);
  if (!summary) confidence -= 0.12;
  return Math.max(0.45, Math.min(0.9, Number(confidence.toFixed(2))));
}

export function sourceKey(table: string, sourceId: string) {
  return `${table}:${sourceId}`;
}

export function normalizeSourceRowToKnowledgeNode(table: string, row: AiKnowledgeSourceRow): AiKnowledgeNode | null {
  const companyId = text(row.company_id);
  const sourceId = text(row.id);
  const type = nodeTypeForSourceTable(table);
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
      sourceEvidence: sourceEvidenceFor(table, row, title, semanticSummary),
      indexedSourceFamily: categoryFor(table, row),
      rawMetadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
      ...(isPredictionGatedTable(table)
        ? {
            predictionValidationStatus: normalizePredictionValidationStatus(row.prediction_validation_status),
            predictionReviewRating: normalizePredictionReviewRating(row.prediction_review_rating),
          }
        : {}),
    },
    semanticSummary: semanticSummary || title,
    vectorStatus: "pending",
    vectorCoordinates,
    confidenceScore: confidenceFor(table, row, semanticSummary),
    validationStatus: "unreviewed",
    createdByType: "system",
  };
}

export function normalizeSourceRowsToKnowledgeNodes(table: string, rows: AiKnowledgeSourceRow[]) {
  // Strict prediction gate: records from Prediction-Validation-reviewed tables only
  // enter the graph once approved. Non-gated tables pass through unchanged.
  return rows
    .filter((row) => passesPredictionGate(table, row))
    .map((row) => normalizeSourceRowToKnowledgeNode(table, row))
    .filter((node): node is AiKnowledgeNode => Boolean(node));
}
