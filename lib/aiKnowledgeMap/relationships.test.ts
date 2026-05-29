import { describe, expect, it } from "vitest";
import { vectorCoordinatesForNode } from "@/lib/aiKnowledgeMap/normalize";
import { generateKnowledgeRelationships } from "@/lib/aiKnowledgeMap/relationships";
import type { AiKnowledgeNode, AiKnowledgeNodeType, AiKnowledgeRelationshipType, AiKnowledgeRiskLevel } from "@/lib/aiKnowledgeMap/types";

function node(params: { id: string; sourceTable: string; type: AiKnowledgeNodeType; title: string; description: string; riskLevel?: AiKnowledgeRiskLevel; companyId?: string }): AiKnowledgeNode {
  const riskLevel = params.riskLevel ?? "moderate";
  return {
    id: params.id,
    companyId: params.companyId ?? "company-1",
    jobsiteId: "jobsite-1",
    projectId: null,
    sourceTable: params.sourceTable,
    sourceId: params.id,
    sourceRecordId: params.id,
    title: params.title,
    nodeType: params.type,
    type: params.type,
    category: params.type,
    description: params.description,
    project: "Tower A",
    trade: "Steel",
    riskLevel,
    riskScore: null,
    sourceUrl: null,
    sourceDocument: null,
    metadata: {},
    semanticSummary: `${params.title}. ${params.description}`,
    vectorStatus: "pending",
    vectorCoordinates: vectorCoordinatesForNode({ sourceTable: params.sourceTable, sourceId: params.id, type: params.type, riskLevel }),
    confidenceScore: 0.72,
    validationStatus: "unreviewed",
    createdByType: "system",
  };
}

describe("AI Knowledge Map relationship generation", () => {
  it("creates explainable hot work safety relationships", () => {
    const nodes = [
      node({ id: "permit-1", sourceTable: "company_permits", type: "permit", title: "Hot work permit", description: "Welding and hot work require fire watch, extinguisher, PPE, and supervisor control.", riskLevel: "high" }),
      node({ id: "hazard-1", sourceTable: "company_hazards", type: "hazard", title: "Fire hazard", description: "Hot work sparks and welding slag can ignite combustible material.", riskLevel: "high" }),
      node({ id: "control-1", sourceTable: "company_controls", type: "control", title: "Fire watch control", description: "Fire watch uses extinguisher access and PPE checks during hot work.", riskLevel: "low" }),
      node({ id: "training-1", sourceTable: "company_training_requirements", type: "training", title: "Hot work training", description: "Training covers hot work, fire watch, extinguisher use, and PPE." }),
      node({ id: "incident-1", sourceTable: "company_incidents", type: "incident", title: "Hot work near miss", description: "Sparks from welding caused a fire near combustible packaging.", riskLevel: "high" }),
      node({ id: "document-1", sourceTable: "documents", type: "document", title: "Hot work procedure", description: "Procedure supports hot work permit, fire watch, extinguisher, PPE, and training requirements." }),
      node({ id: "risk-1", sourceTable: "company_risk_ai_recommendations", type: "risk_record", title: "Hot work training gap risk", description: "Training gap increases hot work fire risk unless fire watch control is verified.", riskLevel: "critical" }),
    ];

    const edges = generateKnowledgeRelationships(nodes, { maxEdges: 80 });
    const types = new Set(edges.map((edge) => edge.relationshipType));

    expect([...types]).toEqual(expect.arrayContaining([
      "permit_requires_control",
      "task_has_hazard",
      "hazard_mitigated_by_control",
      "training_required_for_task",
      "incident_related_to_task",
      "incident_caused_by_hazard",
      "risk_increased_by_training_gap",
      "risk_reduced_by_control",
      "document_supports_requirement",
    ] satisfies AiKnowledgeRelationshipType[]));
    expect(edges.every((edge) => edge.reason.length > 20)).toBe(true);
    expect(edges.every((edge) => edge.sourceEvidence.length === 2)).toBe(true);
  });

  it("does not connect records across company scope", () => {
    const permit = node({ id: "permit-1", sourceTable: "company_permits", type: "permit", title: "Hot work permit", description: "Hot work requires fire watch." });
    const control = node({ id: "control-1", sourceTable: "company_controls", type: "control", title: "Fire watch", description: "Fire watch controls hot work.", companyId: "company-2" });
    expect(generateKnowledgeRelationships([permit, control])).toHaveLength(0);
  });
});
