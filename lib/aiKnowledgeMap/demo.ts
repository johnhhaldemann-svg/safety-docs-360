import { sourceKey, vectorCoordinatesForNode } from "@/lib/aiKnowledgeMap/normalize";
import { generateKnowledgeRelationships } from "@/lib/aiKnowledgeMap/relationships";
import type { AiKnowledgeGraphPayload, AiKnowledgeNode, AiKnowledgeNodeType, AiKnowledgeRiskLevel } from "@/lib/aiKnowledgeMap/types";

const DEMO_COMPANY_ID = "demo-ai-knowledge-company";

function demoNode(params: {
  id: string;
  sourceTable: string;
  title: string;
  category: string;
  type: AiKnowledgeNodeType;
  description: string;
  riskLevel: AiKnowledgeRiskLevel;
  riskScore: number;
  project?: string;
  trade?: string | null;
}): AiKnowledgeNode {
  const vectorCoordinates = vectorCoordinatesForNode({
    sourceTable: params.sourceTable,
    sourceId: params.id,
    type: params.type,
    riskLevel: params.riskLevel,
  });
  return {
    id: params.id,
    companyId: DEMO_COMPANY_ID,
    jobsiteId: "demo-jobsite",
    projectId: null,
    sourceTable: params.sourceTable,
    sourceId: params.id,
    sourceRecordId: params.id,
    title: params.title,
    category: params.category,
    nodeType: params.type,
    type: params.type,
    description: params.description,
    project: params.project ?? "North Tower Demo",
    trade: params.trade ?? "General",
    riskLevel: params.riskLevel,
    riskScore: params.riskScore,
    sourceUrl: null,
    sourceDocument: null,
    metadata: { demo: true },
    semanticSummary: `${params.title}. ${params.description}`,
    vectorStatus: "indexed",
    vectorCoordinates,
    confidenceScore: 0.82,
    validationStatus: "unreviewed",
    createdByType: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildDemoKnowledgeGraph(): AiKnowledgeGraphPayload {
  const nodes = [
    demoNode({ id: "demo-hot-work-permit", sourceTable: "company_permits", title: "Hot Work Permit", category: "Permits", type: "permit", description: "Welding near combustible packaging requires fire watch, extinguisher, PPE, and supervisor verification.", riskLevel: "high", riskScore: 82, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-fire-hazard", sourceTable: "company_hazards", title: "Fire hazard", category: "Hazards", type: "hazard", description: "Ignition source, sparks, slag, and flammable material exposure from hot work.", riskLevel: "high", riskScore: 80, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-burn-hazard", sourceTable: "company_hazards", title: "Burn hazard", category: "Hazards", type: "hazard", description: "Thermal burn exposure from welding, torch work, hot material, and slag.", riskLevel: "moderate", riskScore: 61, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-fire-watch", sourceTable: "company_controls", title: "Fire watch control", category: "Controls", type: "control", description: "Dedicated fire watch remains during hot work and after completion with extinguisher nearby.", riskLevel: "low", riskScore: 24, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-extinguisher", sourceTable: "company_controls", title: "Extinguisher requirement", category: "Controls", type: "control", description: "Correct extinguisher type and access path required before hot work starts.", riskLevel: "low", riskScore: 22, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-hot-work-training", sourceTable: "company_training_requirements", title: "Hot work training requirement", category: "Training", type: "training", description: "Workers performing hot work must understand fire watch, extinguisher, PPE, and permit hold points.", riskLevel: "moderate", riskScore: 48, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-hot-work-incident", sourceTable: "company_incidents", title: "Prior hot work near miss", category: "Incidents", type: "incident", description: "Sparks from hot work ignited packaging before the fire watch corrected the condition.", riskLevel: "high", riskScore: 76, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-missing-fire-watch", sourceTable: "company_sor_records", title: "Observation: missing fire watch", category: "Observations/SORs", type: "observation", description: "Field observation noted hot work beginning before fire watch was assigned.", riskLevel: "high", riskScore: 72, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-fire-watch-action", sourceTable: "company_corrective_actions", title: "Corrective action: assign fire watch", category: "Corrective Actions", type: "corrective_action", description: "Supervisor must assign and document fire watch before hot work restarts.", riskLevel: "moderate", riskScore: 55, project: "South Mezzanine", trade: "Mechanical" }),
    demoNode({ id: "demo-hot-work-procedure", sourceTable: "documents", title: "Document: Hot Work Procedure", category: "Documents", type: "document", description: "Procedure defines permit, PPE, fire watch, extinguisher, and post-work inspection requirements.", riskLevel: "low", riskScore: 18, project: "South Mezzanine", trade: null }),
    demoNode({ id: "demo-excavation-gas-line", sourceTable: "company_jsas", title: "Excavation Near Gas Line", category: "Tasks", type: "task", description: "Excavation work near utility markings requires potholing, barricades, competent-person inspection, and stop-work triggers.", riskLevel: "critical", riskScore: 94, project: "East Utility Yard", trade: "Excavation" }),
    demoNode({ id: "demo-excavation-training", sourceTable: "company_training_requirements", title: "Training: Excavation Safety", category: "Training", type: "training", description: "Training covers trench hazards, competent person checks, utility exposure, access, and protective systems.", riskLevel: "moderate", riskScore: 58, project: "East Utility Yard", trade: "Excavation" }),
    demoNode({ id: "demo-fall-training-gap", sourceTable: "company_risk_ai_recommendations", title: "Fall Protection Training Gap", category: "Risk", type: "risk_record", description: "Risk increased by workers assigned to elevated work with missing or stale fall protection training.", riskLevel: "critical", riskScore: 91, project: "North Tower", trade: "Ironworker" }),
    demoNode({ id: "demo-open-action", sourceTable: "company_corrective_actions", title: "Open Corrective Action", category: "Corrective Actions", type: "corrective_action", description: "Open action to install guardrail signage and verify closure before elevated work resumes.", riskLevel: "high", riskScore: 74, project: "North Tower", trade: "Carpentry" }),
    demoNode({ id: "demo-housekeeping-observation", sourceTable: "company_sor_records", title: "Housekeeping Observation", category: "Observations/SORs", type: "observation", description: "Walk path clutter and stored material created struck-by and trip exposure near active work.", riskLevel: "moderate", riskScore: 60, project: "North Tower", trade: "General" }),
    demoNode({ id: "demo-loto-control", sourceTable: "company_controls", title: "LOTO Control", category: "Controls", type: "control", description: "Lockout/tagout verification before maintenance on energized equipment.", riskLevel: "high", riskScore: 79, project: "Central Plant", trade: "Electrical" }),
    demoNode({ id: "demo-confined-space-permit", sourceTable: "company_permits", title: "Confined Space Entry Permit", category: "Permits", type: "permit", description: "Entry permit requires atmospheric testing, attendant, rescue plan, ventilation, and authorization.", riskLevel: "critical", riskScore: 96, project: "Central Plant", trade: "Mechanical" }),
    demoNode({ id: "demo-hand-cut", sourceTable: "company_incidents", title: "Incident: Hand Cut", category: "Incidents", type: "incident", description: "Hand cut during material handling connected to glove selection and housekeeping controls.", riskLevel: "moderate", riskScore: 57, project: "North Tower", trade: "Laborer" }),
    demoNode({ id: "demo-missing-barricade", sourceTable: "company_sor_records", title: "Observation: Missing Barricade", category: "Observations/SORs", type: "observation", description: "Missing barricade at open excavation edge created pedestrian exposure.", riskLevel: "high", riskScore: 77, project: "East Utility Yard", trade: "Excavation" }),
    demoNode({ id: "demo-install-signage", sourceTable: "company_corrective_actions", title: "Corrective Action: Install Signage", category: "Corrective Actions", type: "corrective_action", description: "Install warning signage and barricade tape around excavation access point.", riskLevel: "moderate", riskScore: 52, project: "East Utility Yard", trade: "Excavation" }),
    demoNode({ id: "demo-risk-cluster", sourceTable: "company_risk_ai_recommendations", title: "Risk Forecast: High Risk Task Cluster", category: "Risk", type: "risk_record", description: "Predictive cluster formed by hot work, confined space, training gaps, open actions, and recent observations.", riskLevel: "critical", riskScore: 93, project: "Portfolio", trade: null }),
  ];

  const keyToId = new Map(nodes.map((node) => [sourceKey(node.sourceTable, node.sourceId), node.id]));
  const edges = generateKnowledgeRelationships(nodes, { maxEdges: 58 }).map((edge, index) => ({
    ...edge,
    id: `demo-edge-${index + 1}`,
    sourceNodeId: keyToId.get(edge.fromNodeKey ?? "") ?? edge.fromNodeId,
    targetNodeId: keyToId.get(edge.toNodeKey ?? "") ?? edge.toNodeId,
    fromNodeId: keyToId.get(edge.fromNodeKey ?? "") ?? edge.fromNodeId,
    toNodeId: keyToId.get(edge.toNodeKey ?? "") ?? edge.toNodeId,
  }));
  const validationQueue = edges.filter((edge) => edge.validationStatus !== "approved" || edge.confidenceScore < 0.55).slice(0, 10);

  return {
    companies: [{ id: DEMO_COMPANY_ID, name: "Demo Construction Workspace" }],
    selectedCompanyId: DEMO_COMPANY_ID,
    nodes,
    edges,
    validationQueue,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      dataSourceCount: new Set(nodes.map((node) => node.sourceTable)).size,
      highRiskNodeCount: nodes.filter((node) => node.riskLevel === "high" || node.riskLevel === "critical").length,
      lowConfidenceCount: edges.filter((edge) => edge.confidenceScore < 0.55).length,
      unreviewedRelationshipCount: edges.filter((edge) => edge.validationStatus === "unreviewed" || edge.validationStatus === "pending_review" || edge.validationStatus === "needs_review").length,
      pendingReviewCount: validationQueue.length,
      indexedVectorCount: nodes.length,
      companyCount: 1,
      latestUpdate: new Date().toISOString(),
    },
    generatedAt: new Date().toISOString(),
    warnings: ["Demo graph shown until a Super Admin rebuilds a company knowledge index."],
    demo: true,
  };
}
