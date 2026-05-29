import { describe, expect, it } from "vitest";
import { normalizeRiskLevel, normalizeSourceRowToKnowledgeNode, normalizeSourceRowsToKnowledgeNodes, sourceKey, vectorCoordinatesForNode } from "@/lib/aiKnowledgeMap/normalize";
import type { AiKnowledgeNodeType } from "@/lib/aiKnowledgeMap/types";

const fixtures: Array<{ table: string; expectedType: AiKnowledgeNodeType; row: Record<string, unknown> }> = [
  { table: "company_permits", expectedType: "permit", row: { id: "permit-1", company_id: "company-1", permit_type: "Hot Work", description: "Welding requires fire watch and extinguisher.", severity: "high" } },
  { table: "company_jsas", expectedType: "task", row: { id: "jsa-1", company_id: "company-1", title: "Excavation near gas line", description: "Task includes utility exposure.", risk_level: "critical" } },
  { table: "company_hazards", expectedType: "hazard", row: { id: "hazard-1", company_id: "company-1", name: "Fire hazard", description: "Sparks can ignite packaging." } },
  { table: "company_controls", expectedType: "control", row: { id: "control-1", company_id: "company-1", name: "Fire watch", description: "Assigned fire watch." } },
  { table: "company_training_requirements", expectedType: "training", row: { id: "training-1", company_id: "company-1", title: "Hot work training", match_keywords: ["hot work"] } },
  { table: "company_incidents", expectedType: "incident", row: { id: "incident-1", company_id: "company-1", title: "Spark near miss", description: "Sparks ignited debris.", severity: "high" } },
  { table: "company_sor_records", expectedType: "observation", row: { id: "observation-1", company_id: "company-1", description: "Missing barricade at excavation.", severity: "high" } },
  { table: "company_corrective_actions", expectedType: "corrective_action", row: { id: "action-1", company_id: "company-1", title: "Install signage", description: "Install barricade signage." } },
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

  it("normalizes batches and preserves source keys", () => {
    const nodes = normalizeSourceRowsToKnowledgeNodes("company_controls", [
      { id: "control-1", company_id: "company-1", name: "Guardrail" },
      { id: "control-2", name: "No company" },
    ]);
    expect(nodes).toHaveLength(1);
    expect(sourceKey(nodes[0].sourceTable, nodes[0].sourceId)).toBe("company_controls:control-1");
  });
});
