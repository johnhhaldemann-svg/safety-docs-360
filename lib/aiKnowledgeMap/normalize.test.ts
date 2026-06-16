import { describe, expect, it } from "vitest";
import { normalizeRiskLevel, normalizeSourceRowToKnowledgeNode, normalizeSourceRowsToKnowledgeNodes, sourceKey, vectorCoordinatesForNode } from "@/lib/aiKnowledgeMap/normalize";
import type { AiKnowledgeNodeType } from "@/lib/aiKnowledgeMap/types";

const fixtures: Array<{ table: string; expectedType: AiKnowledgeNodeType; row: Record<string, unknown> }> = [
  { table: "company_permits", expectedType: "permit", row: { id: "permit-1", company_id: "company-1", permit_type: "Hot Work", description: "Welding requires fire watch and extinguisher.", severity: "high" } },
  { table: "company_jsas", expectedType: "task", row: { id: "jsa-1", company_id: "company-1", title: "Excavation near gas line", description: "Task includes utility exposure.", risk_level: "critical" } },
  { table: "company_hazards", expectedType: "hazard", row: { id: "hazard-1", company_id: "company-1", name: "Fire hazard", description: "Sparks can ignite packaging." } },
  { table: "company_controls", expectedType: "control", row: { id: "control-1", company_id: "company-1", name: "Fire watch", description: "Assigned fire watch." } },
  { table: "company_training_requirements", expectedType: "training", row: { id: "training-1", company_id: "company-1", title: "Hot work training", match_keywords: ["hot work"] } },
  { table: "company_employee_training_records", expectedType: "training", row: { id: "employee-training-1", company_id: "company-1", training_title: "Forklift operator", provider: "ACME Safety", evidence: "certificate uploaded" } },
  { table: "company_induction_programs", expectedType: "training", row: { id: "induction-program-1", company_id: "company-1", name: "Site orientation", description: "Orientation for new workers." } },
  { table: "company_induction_requirements", expectedType: "training", row: { id: "induction-requirement-1", company_id: "company-1", title: "Orientation required", required_for_role: "all workers" } },
  { table: "company_induction_completions", expectedType: "training", row: { id: "induction-completion-1", company_id: "company-1", user_id: "worker-1", completed_at: "2026-05-01" } },
  { table: "company_toolbox_sessions", expectedType: "training", row: { id: "toolbox-session-1", company_id: "company-1", topic: "Heat stress briefing", status: "completed" } },
  { table: "company_toolbox_attendees", expectedType: "training", row: { id: "toolbox-attendee-1", company_id: "company-1", attendee_name: "Worker One", signed_at: "2026-05-01" } },
  { table: "company_incidents", expectedType: "incident", row: { id: "incident-1", company_id: "company-1", title: "Spark near miss", description: "Sparks ignited debris.", severity: "high" } },
  { table: "company_sor_records", expectedType: "observation", row: { id: "observation-1", company_id: "company-1", description: "Missing barricade at excavation.", severity: "high" } },
  { table: "company_jobsite_audits", expectedType: "observation", row: { id: "field-audit-1", company_id: "company-1", selected_trade: "Electrical", status: "submitted", score_summary: "Two failed items." } },
  { table: "company_jobsite_audit_observations", expectedType: "observation", row: { id: "field-audit-observation-1", company_id: "company-1", item_label: "Missing GFCI", status: "fail", severity: "high" } },
  { table: "company_corrective_actions", expectedType: "corrective_action", row: { id: "action-1", company_id: "company-1", title: "Install signage", description: "Install barricade signage." } },
  { table: "company_jobsite_chemicals", expectedType: "hazard", row: { id: "chemical-1", company_id: "company-1", chemical_name: "Solvent", manufacturer: "ACME", sds_file_path: "sds/solvent.pdf" } },
  { table: "company_jobsite_visual_zones", expectedType: "risk_record", row: { id: "visual-zone-1", company_id: "company-1", label: "Crane swing zone", zone_type: "exclusion", risk_level: "high" } },
  { table: "company_crews", expectedType: "user_role", row: { id: "crew-1", company_id: "company-1", name: "Concrete crew", active: true } },
  { table: "company_employee_profiles", expectedType: "user_role", row: { id: "employee-profile-1", company_id: "company-1", full_name: "Worker One", trade: "Electrical", certifications: ["NFPA 70E"] } },
  { table: "company_employee_jobsite_assignments", expectedType: "task", row: { id: "assignment-1", company_id: "company-1", employee_id: "worker-1", jobsite_id: "jobsite-1", role: "spotter" } },
  { table: "company_jobsites", expectedType: "project", row: { id: "jobsite-1", company_id: "company-1", name: "Downtown tower", safety_lead: "Jane Safety" } },
  { table: "documents", expectedType: "document", row: { id: "document-1", company_id: "company-1", document_title: "Hot Work Procedure", notes: "Procedure covers fire watch." } },
  { table: "company_risk_ai_recommendations", expectedType: "risk_record", row: { id: "risk-1", company_id: "company-1", title: "Training gap risk", body: "Training gap increases fire risk." } },
];

describe("AI Knowledge Map normalization", () => {
  it.each(fixtures)("normalizes $table records into semantic nodes", ({ table, expectedType, row }) => {
    const node = normalizeSourceRowToKnowledgeNode(table, row);

    expect(node).toMatchObject({
      companyId: "company-1",
      sourceTable: table,
      sourceId: row.id,
      nodeType: expectedType,
      type: expectedType,
      vectorStatus: "pending",
      validationStatus: "unreviewed",
    });
    expect(node?.semanticSummary).toContain(node?.title);
    expect(node?.vectorCoordinates.cluster).toBe(expectedType);
    expect(node?.metadata.sourceEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceTable: table, sourceRecordId: row.id }),
    ]));
    expect(node?.metadata.indexedSourceFamily).toBeTruthy();
  });

  it("drops rows without tenant or source identity", () => {
    expect(normalizeSourceRowToKnowledgeNode("company_permits", { id: "permit-1" })).toBeNull();
    expect(normalizeSourceRowToKnowledgeNode("company_permits", { company_id: "company-1" })).toBeNull();
  });

  it("normalizes risk and generates stable deterministic vector coordinates", () => {
    expect(normalizeRiskLevel("critical stop_work")).toBe("critical");
    expect(normalizeRiskLevel("urgent SIF exposure")).toBe("high");
    expect(normalizeRiskLevel("medium hazard")).toBe("moderate");
    expect(normalizeRiskLevel("")).toBe("unknown");

    const first = vectorCoordinatesForNode({ sourceTable: "company_permits", sourceId: "permit-1", type: "permit", riskLevel: "high" });
    const second = vectorCoordinatesForNode({ sourceTable: "company_permits", sourceId: "permit-1", type: "permit", riskLevel: "high" });
    expect(first).toEqual(second);
  });

  it("gates prediction-reviewed tables to approved rows and weights confidence by rating", () => {
    const rows = [
      { id: "incident-approved", company_id: "company-1", title: "Approved incident", description: "Reviewed and approved.", prediction_validation_status: "approved", prediction_review_rating: 5 },
      { id: "incident-pending", company_id: "company-1", title: "Pending incident", description: "Not yet reviewed.", prediction_validation_status: "pending" },
      { id: "incident-rejected", company_id: "company-1", title: "Rejected incident", description: "Reviewed and rejected.", prediction_validation_status: "rejected" },
      { id: "incident-missing", company_id: "company-1", title: "Unreviewed incident", description: "No status at all." },
    ];
    const nodes = normalizeSourceRowsToKnowledgeNodes("company_incidents", rows);
    expect(nodes.map((node) => node.sourceId)).toEqual(["incident-approved"]);

    const approved = nodes[0];
    const baseline = normalizeSourceRowToKnowledgeNode("company_incidents", {
      id: "incident-baseline",
      company_id: "company-1",
      title: "Approved incident",
      description: "Reviewed and approved.",
      prediction_validation_status: "approved",
      prediction_review_rating: 3,
    });
    expect(approved.confidenceScore).toBeGreaterThan(baseline?.confidenceScore ?? 0);
    expect(approved.metadata.predictionValidationStatus).toBe("approved");
    expect(approved.metadata.predictionReviewRating).toBe(5);
  });

  it("normalizes batches and preserves source keys", () => {
    const nodes = normalizeSourceRowsToKnowledgeNodes("company_controls", [
      { id: "control-1", company_id: "company-1", name: "Guardrail" },
      { id: "control-2", name: "No company" },
    ]);
    expect(nodes).toHaveLength(1);
    expect(sourceKey(nodes[0].sourceTable, nodes[0].sourceId)).toBe("company_controls:control-1");
  });

  it("applies minimum risk scores for incidents, observations, and hazards", () => {
    expect(normalizeSourceRowToKnowledgeNode("company_incidents", {
      id: "incident-no-aid",
      company_id: "company-1",
      title: "Trip",
      description: "Tripped on cord landed on knee no medical aid needed.",
      risk_score: 0,
    })?.riskScore).toBe(35);
    expect(normalizeSourceRowToKnowledgeNode("company_incidents", {
      id: "incident-first-aid",
      company_id: "company-1",
      title: "Hand cut",
      description: "First aid provided for hand cut.",
      risk_score: 0,
    })?.riskScore).toBe(45);
    expect(normalizeSourceRowToKnowledgeNode("company_sor_records", {
      id: "observation-2",
      company_id: "company-1",
      description: "Housekeeping observation.",
      risk_score: 0,
    })?.riskScore).toBe(5);
    expect(normalizeSourceRowToKnowledgeNode("company_hazards", {
      id: "hazard-2",
      company_id: "company-1",
      name: "Open edge",
      risk_score: 0,
    })?.riskScore).toBe(15);
  });

  it("raises confidence for source records with stronger evidence", () => {
    expect(normalizeSourceRowToKnowledgeNode("company_employee_training_records", {
      id: "employee-training-evidence",
      company_id: "company-1",
      training_title: "Aerial lift",
      evidence: "certificate uploaded",
    })?.confidenceScore).toBeGreaterThan(0.72);
    expect(normalizeSourceRowToKnowledgeNode("company_jobsite_chemicals", {
      id: "chemical-evidence",
      company_id: "company-1",
      chemical_name: "Epoxy",
      sds_file_path: "sds/epoxy.pdf",
    })?.confidenceScore).toBeGreaterThan(0.72);
    expect(normalizeSourceRowToKnowledgeNode("safety_data_bucket", {
      id: "bucket-ai-ready",
      company_id: "company-1",
      title: "Lightning proximity alert",
      ai_ready: true,
    })?.confidenceScore).toBeGreaterThan(0.72);
  });
});
