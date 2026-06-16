import type { AiKnowledgeNode, AiKnowledgeNodeType } from "@/lib/aiKnowledgeMap/types";

export type AiKnowledgeSourceDomain =
  | "permits"
  | "jsas"
  | "hazards_controls"
  | "training"
  | "audits_observations"
  | "incidents_actions"
  | "chemicals_sds"
  | "site_visuals"
  | "workforce_equipment"
  | "jobsites_context"
  | "documents"
  | "risk_intelligence";

export type AiKnowledgeSourceAdapter = {
  table: string;
  owner: "platform" | "company" | "superadmin";
  domain: AiKnowledgeSourceDomain;
  nodeType: AiKnowledgeNodeType;
  requiredFields: string[];
  riskFields: string[];
  evidenceFields: string[];
  confidenceSignals: string[];
  blocksHighRiskRelease: boolean;
};

export const AI_KNOWLEDGE_SOURCE_ADAPTERS = [
  source("company_permits", "permits", "permit", ["id", "company_id"], ["severity", "stop_work_status", "escalation_level"], ["description", "permit_type", "assignment_rationale"], true),
  source("company_jsas", "jsas", "task", ["id", "company_id"], ["risk_level", "severity", "priority"], ["title", "description", "project_name"], true),
  source("company_hazards", "hazards_controls", "hazard", ["id", "company_id"], ["risk_level", "severity", "priority"], ["name", "description"], true),
  source("company_controls", "hazards_controls", "control", ["id", "company_id"], ["risk_level", "severity", "priority"], ["name", "description"], true),
  source("company_training_requirements", "training", "training", ["id", "company_id"], ["risk_level", "severity", "priority"], ["match_keywords", "apply_trades", "apply_positions"], true),
  source("company_employee_training_records", "training", "training", ["id", "company_id"], ["expires_on", "expired", "status"], ["training_title", "provider", "evidence"], true, ["evidence"]),
  source("company_induction_programs", "training", "training", ["id", "company_id"], ["risk_level", "severity", "priority"], ["name", "description", "audience"], true),
  source("company_induction_requirements", "training", "training", ["id", "company_id"], ["risk_level", "severity", "priority"], ["title", "required_for_role", "jobsite_id"], true),
  source("company_induction_completions", "training", "training", ["id", "company_id"], ["expires_at", "expired", "status"], ["subject_type", "completed_at", "user_id"], true),
  source("company_toolbox_sessions", "training", "training", ["id", "company_id"], ["risk_level", "severity", "priority"], ["topic", "notes", "completed_at"], true),
  source("company_toolbox_attendees", "training", "training", ["id", "company_id"], ["risk_level", "severity", "priority"], ["attendee_name", "signed_at", "status"], false),
  source("company_incidents", "incidents_actions", "incident", ["id", "company_id"], ["severity", "escalation_level", "stop_work_status"], ["title", "description", "injury_type"], true),
  source("company_sor_records", "audits_observations", "observation", ["id", "company_id"], ["severity", "hazard_category_code", "category_code"], ["description", "location", "subcategory"], true),
  source("company_jobsite_audits", "audits_observations", "observation", ["id", "company_id"], ["risk_level", "severity", "priority"], ["selected_trade", "score_summary", "payload"], true),
  source("company_jobsite_audit_observations", "audits_observations", "observation", ["id", "company_id"], ["severity", "hazard_category_code", "category_code"], ["item_label", "notes", "evidence_metadata"], true, ["status:fail"]),
  source("company_corrective_actions", "incidents_actions", "corrective_action", ["id", "company_id"], ["priority", "severity", "sif_potential"], ["title", "description", "status"], true),
  source("company_jobsite_chemicals", "chemicals_sds", "hazard", ["id", "company_id"], ["risk_level", "next_review_date"], ["chemical_name", "manufacturer", "sds_file_path"], true, ["sds_file_path"]),
  source("company_jobsite_visual_zones", "site_visuals", "risk_record", ["id", "company_id"], ["risk_level", "severity", "zone_type"], ["label", "notes", "metadata"], true, ["zone_type"]),
  source("company_crews", "workforce_equipment", "user_role", ["id", "company_id"], ["risk_level", "severity", "priority"], ["name", "jobsite_id", "active"], false),
  source("company_employee_profiles", "workforce_equipment", "user_role", ["id", "company_id"], ["risk_level", "severity", "priority"], ["full_name", "trade", "certifications"], true),
  source("company_employee_jobsite_assignments", "workforce_equipment", "task", ["id", "company_id"], ["risk_level", "severity", "priority"], ["employee_id", "jobsite_id", "role"], true),
  source("company_jobsites", "jobsites_context", "project", ["id", "company_id"], ["risk_level", "severity", "priority"], ["name", "address", "safety_lead"], false),
  source("documents", "documents", "document", ["id", "company_id"], ["risk_level", "severity", "priority"], ["document_title", "notes", "document_type"], true),
  source("company_generated_documents", "documents", "document", ["id", "company_id"], ["risk_level", "severity", "priority"], ["title", "document_type", "final_file_path"], true),
  source("company_risk_ai_recommendations", "risk_intelligence", "risk_record", ["id", "company_id"], ["severity", "kind", "confidence"], ["title", "body", "kind"], true),
] as const satisfies readonly AiKnowledgeSourceAdapter[];

export const AI_KNOWLEDGE_SOURCE_TABLES = AI_KNOWLEDGE_SOURCE_ADAPTERS.map((adapter) => adapter.table);

export function adapterForSourceTable(table: string) {
  return AI_KNOWLEDGE_SOURCE_ADAPTERS.find((adapter) => adapter.table === table) ?? null;
}

export function nodeTypeForSourceTable(table: string) {
  return adapterForSourceTable(table)?.nodeType ?? null;
}

export function domainCoverageForNodes(nodes: Pick<AiKnowledgeNode, "sourceTable" | "validationStatus" | "metadata" | "confidenceScore">[]) {
  return AI_KNOWLEDGE_SOURCE_ADAPTERS.map((adapter) => {
    const domainNodes = nodes.filter((node) => node.sourceTable === adapter.table);
    const approved = domainNodes.filter((node) => node.validationStatus === "approved");
    return {
      domain: adapter.domain,
      table: adapter.table,
      owner: adapter.owner,
      nodeType: adapter.nodeType,
      indexedNodeCount: domainNodes.length,
      approvedNodeCount: approved.length,
      staleNodeCount: domainNodes.filter((node) => node.metadata?.reviewDueAt && Date.parse(String(node.metadata.reviewDueAt)) < Date.now()).length,
      lowConfidenceNodeCount: domainNodes.filter((node) => (node.confidenceScore ?? 0.72) < 0.55).length,
      blocksHighRiskRelease: adapter.blocksHighRiskRelease,
    };
  });
}

function source(
  table: string,
  domain: AiKnowledgeSourceDomain,
  nodeType: AiKnowledgeNodeType,
  requiredFields: string[],
  riskFields: string[],
  evidenceFields: string[],
  blocksHighRiskRelease: boolean,
  confidenceSignals: string[] = [],
): AiKnowledgeSourceAdapter {
  return {
    table,
    owner: table === "documents" ? "platform" : "company",
    domain,
    nodeType,
    requiredFields,
    riskFields,
    evidenceFields,
    confidenceSignals,
    blocksHighRiskRelease,
  };
}
