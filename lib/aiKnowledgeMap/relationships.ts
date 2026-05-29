import { sourceKey } from "@/lib/aiKnowledgeMap/normalize";
import type {
  AiKnowledgeEdge,
  AiKnowledgeEvidence,
  AiKnowledgeNode,
  AiKnowledgeRelationshipType,
  AiKnowledgeValidationStatus,
} from "@/lib/aiKnowledgeMap/types";

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "work", "safety", "record", "required", "company", "project"]);
const HAZARD_TERMS = ["hot work", "fire", "burn", "weld", "torch", "fall", "ladder", "scaffold", "electrical", "arc flash", "excavation", "trench", "confined space", "line of fire", "struck", "caught", "silica", "chemical", "heat", "loto", "lockout"];
const CONTROL_TERMS = ["fire watch", "extinguisher", "permit", "ppe", "barricade", "guardrail", "fall protection", "lockout", "inspection", "ventilation", "monitor", "spotter", "training", "supervisor", "signage"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function searchableText(node: AiKnowledgeNode) {
  return normalize([node.title, node.category, node.nodeType, node.description, node.trade, node.project, node.semanticSummary].filter(Boolean).join(" "));
}

function tokenSet(node: AiKnowledgeNode) {
  return new Set(searchableText(node).split(/\s+/).filter((token) => token.length >= 3 && !STOPWORDS.has(token)));
}

function keywordHits(node: AiKnowledgeNode, terms: string[]) {
  const text = searchableText(node);
  return terms.filter((term) => text.includes(term));
}

function tokenSimilarity(left: AiKnowledgeNode, right: AiKnowledgeNode) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function evidenceFor(left: AiKnowledgeNode, right: AiKnowledgeNode, detail: string): AiKnowledgeEvidence[] {
  return [
    { sourceTable: left.sourceTable, sourceRecordId: left.sourceId, label: left.title, detail },
    { sourceTable: right.sourceTable, sourceRecordId: right.sourceId, label: right.title, detail },
  ];
}

function validationStatus(confidence: number): AiKnowledgeValidationStatus {
  if (confidence >= 0.88) return "approved";
  if (confidence < 0.45) return "needs_review";
  return "pending_review";
}

function makeEdge(params: {
  from: AiKnowledgeNode;
  to: AiKnowledgeNode;
  relationshipType: AiKnowledgeRelationshipType;
  strengthScore: number;
  confidenceScore: number;
  reason: string;
  detail: string;
  createdByType?: "system" | "ai";
  metadata?: Record<string, unknown>;
}): AiKnowledgeEdge {
  const strength = Number(params.strengthScore.toFixed(3));
  return {
    companyId: params.from.companyId,
    fromNodeKey: sourceKey(params.from.sourceTable, params.from.sourceId),
    toNodeKey: sourceKey(params.to.sourceTable, params.to.sourceId),
    relationshipType: params.relationshipType,
    relationshipStrength: strength,
    strengthScore: strength,
    reason: params.reason,
    sourceEvidence: evidenceFor(params.from, params.to, params.detail),
    confidenceScore: Number(params.confidenceScore.toFixed(3)),
    createdByType: params.createdByType ?? "system",
    validationStatus: validationStatus(params.confidenceScore),
    metadata: params.metadata ?? {},
  };
}

function sameScope(left: AiKnowledgeNode, right: AiKnowledgeNode) {
  return left.companyId === right.companyId && (!left.jobsiteId || !right.jobsiteId || left.jobsiteId === right.jobsiteId);
}

function pushUnique(edges: AiKnowledgeEdge[], edge: AiKnowledgeEdge) {
  const key = `${edge.fromNodeKey}:${edge.toNodeKey}:${edge.relationshipType}`;
  if (!edges.some((existing) => `${existing.fromNodeKey}:${existing.toNodeKey}:${existing.relationshipType}` === key)) {
    edges.push(edge);
  }
}

export function generateKnowledgeRelationships(nodes: AiKnowledgeNode[], options?: { maxEdges?: number }) {
  const maxEdges = options?.maxEdges ?? 280;
  const edges: AiKnowledgeEdge[] = [];
  const hazards = nodes.filter((node) => node.nodeType === "hazard" || keywordHits(node, HAZARD_TERMS).length > 0);
  const controls = nodes.filter((node) => node.nodeType === "control" || keywordHits(node, CONTROL_TERMS).length > 0);
  const tasks = nodes.filter((node) => node.nodeType === "task" || node.nodeType === "permit");
  const training = nodes.filter((node) => node.nodeType === "training");
  const incidents = nodes.filter((node) => node.nodeType === "incident");
  const observations = nodes.filter((node) => node.nodeType === "observation");
  const correctiveActions = nodes.filter((node) => node.nodeType === "corrective_action");
  const documents = nodes.filter((node) => node.nodeType === "document");
  const risks = nodes.filter((node) => node.nodeType === "risk_record");

  for (const permit of nodes.filter((node) => node.nodeType === "permit")) {
    const permitHits = keywordHits(permit, [...HAZARD_TERMS, ...CONTROL_TERMS]);
    for (const control of controls) {
      if (permit === control || !sameScope(permit, control)) continue;
      const overlap = tokenSimilarity(permit, control);
      const controlHits = keywordHits(control, permitHits.length ? permitHits : CONTROL_TERMS);
      if (overlap < 0.05 && controlHits.length === 0) continue;
      pushUnique(edges, makeEdge({
        from: permit,
        to: control,
        relationshipType: "permit_requires_control",
        strengthScore: Math.min(0.95, 0.62 + overlap + controlHits.length * 0.06),
        confidenceScore: Math.min(0.94, 0.68 + overlap + controlHits.length * 0.05),
        reason: `${permit.title} requires related control verification because the permit context shares ${controlHits[0] ?? "safety-control"} language with ${control.title}.`,
        detail: "Permit/control semantic overlap",
      }));
    }
  }

  for (const task of tasks) {
    for (const hazard of hazards) {
      if (task === hazard || !sameScope(task, hazard)) continue;
      const hits = keywordHits(task, HAZARD_TERMS).filter((hit) => searchableText(hazard).includes(hit));
      const overlap = tokenSimilarity(task, hazard);
      if (hits.length === 0 && overlap < 0.08) continue;
      pushUnique(edges, makeEdge({
        from: task,
        to: hazard,
        relationshipType: "task_has_hazard",
        strengthScore: Math.min(0.96, 0.58 + overlap + hits.length * 0.07),
        confidenceScore: Math.min(0.93, 0.64 + overlap + hits.length * 0.06),
        reason: `${task.title} connects to ${hazard.title} through ${hits.join(", ") || "shared hazard terms"}.`,
        detail: "Task/hazard match",
      }));
    }
    for (const permit of nodes.filter((node) => node.nodeType === "permit")) {
      if (task === permit || !sameScope(task, permit)) continue;
      const overlap = tokenSimilarity(task, permit);
      if (overlap < 0.08) continue;
      pushUnique(edges, makeEdge({
        from: permit,
        to: task,
        relationshipType: "permit_required_for_task",
        strengthScore: Math.min(0.9, 0.52 + overlap),
        confidenceScore: Math.min(0.86, 0.55 + overlap),
        reason: `${permit.title} appears required for ${task.title} because the permit and task share work-scope, hazard, or trade language.`,
        detail: "Permit/task scope overlap",
      }));
    }
    for (const trainingNode of training) {
      if (!sameScope(task, trainingNode)) continue;
      const overlap = tokenSimilarity(task, trainingNode);
      const hits = keywordHits(task, HAZARD_TERMS).filter((hit) => searchableText(trainingNode).includes(hit));
      if (overlap < 0.07 && hits.length === 0) continue;
      pushUnique(edges, makeEdge({
        from: task,
        to: trainingNode,
        relationshipType: "training_required_for_task",
        strengthScore: Math.min(0.93, 0.55 + overlap + hits.length * 0.06),
        confidenceScore: Math.min(0.9, 0.58 + overlap + hits.length * 0.05),
        reason: `${trainingNode.title} is relevant to ${task.title} based on task, trade, hazard, or keyword overlap.`,
        detail: "Task/training requirement match",
      }));
    }
  }

  for (const hazard of hazards) {
    for (const control of controls) {
      if (hazard === control || !sameScope(hazard, control)) continue;
      const overlap = tokenSimilarity(hazard, control);
      const controlHits = keywordHits(control, CONTROL_TERMS);
      if (overlap < 0.06 && controlHits.length === 0) continue;
      pushUnique(edges, makeEdge({
        from: hazard,
        to: control,
        relationshipType: "hazard_mitigated_by_control",
        strengthScore: Math.min(0.94, 0.54 + overlap + controlHits.length * 0.05),
        confidenceScore: Math.min(0.91, 0.6 + overlap + controlHits.length * 0.04),
        reason: `${control.title} appears to reduce ${hazard.title} because it references ${controlHits[0] ?? "a matching control"} in the same safety context.`,
        detail: "Hazard/control mitigation match",
      }));
    }
  }

  for (const incident of incidents) {
    for (const task of tasks) {
      if (!sameScope(incident, task)) continue;
      const overlap = tokenSimilarity(incident, task);
      if (overlap < 0.08) continue;
      pushUnique(edges, makeEdge({
        from: incident,
        to: task,
        relationshipType: "incident_related_to_task",
        strengthScore: Math.min(0.9, 0.52 + overlap),
        confidenceScore: Math.min(0.86, 0.55 + overlap),
        reason: `${incident.title} is related to ${task.title} because incident language overlaps with task or permit context.`,
        detail: "Incident/task historical similarity",
      }));
    }
    for (const hazard of hazards) {
      if (!sameScope(incident, hazard)) continue;
      const hits = keywordHits(incident, HAZARD_TERMS).filter((hit) => searchableText(hazard).includes(hit));
      if (hits.length === 0) continue;
      pushUnique(edges, makeEdge({
        from: incident,
        to: hazard,
        relationshipType: "incident_caused_by_hazard",
        strengthScore: Math.min(0.95, 0.62 + hits.length * 0.08),
        confidenceScore: Math.min(0.9, 0.64 + hits.length * 0.06),
        reason: `${incident.title} points to ${hazard.title} through ${hits.join(", ")} hazard evidence.`,
        detail: "Incident/hazard cause signal",
      }));
    }
  }

  for (const observation of observations) {
    for (const action of correctiveActions) {
      if (!sameScope(observation, action)) continue;
      const overlap = tokenSimilarity(observation, action);
      if (overlap < 0.08) continue;
      pushUnique(edges, makeEdge({
        from: observation,
        to: action,
        relationshipType: "observation_created_corrective_action",
        strengthScore: Math.min(0.92, 0.5 + overlap),
        confidenceScore: Math.min(0.85, 0.52 + overlap),
        reason: `${action.title} appears connected to ${observation.title} through shared observation/corrective-action details.`,
        detail: "Observation/action overlap",
      }));
    }
  }

  for (const action of correctiveActions) {
    for (const hazard of hazards) {
      if (!sameScope(action, hazard)) continue;
      const overlap = tokenSimilarity(action, hazard);
      if (overlap < 0.08) continue;
      pushUnique(edges, makeEdge({
        from: action,
        to: hazard,
        relationshipType: "corrective_action_closes_hazard",
        strengthScore: Math.min(0.9, 0.5 + overlap),
        confidenceScore: Math.min(0.84, 0.52 + overlap),
        reason: `${action.title} may close or reduce ${hazard.title} because both records reference the same hazard context.`,
        detail: "Corrective action/hazard overlap",
      }));
    }
  }

  for (const risk of risks) {
    for (const trainingNode of training) {
      if (!sameScope(risk, trainingNode)) continue;
      const riskText = searchableText(risk);
      if (!riskText.includes("training") && !riskText.includes("gap")) continue;
      pushUnique(edges, makeEdge({
        from: risk,
        to: trainingNode,
        relationshipType: "risk_increased_by_training_gap",
        strengthScore: 0.78,
        confidenceScore: 0.72,
        reason: `${risk.title} references training-gap risk and ${trainingNode.title} is a matching training requirement.`,
        detail: "Training gap risk signal",
      }));
    }
    for (const control of controls) {
      if (!sameScope(risk, control)) continue;
      const overlap = tokenSimilarity(risk, control);
      if (overlap < 0.07) continue;
      pushUnique(edges, makeEdge({
        from: risk,
        to: control,
        relationshipType: "risk_reduced_by_control",
        strengthScore: Math.min(0.9, 0.55 + overlap),
        confidenceScore: Math.min(0.86, 0.58 + overlap),
        reason: `${control.title} is a likely risk-reduction control for ${risk.title}.`,
        detail: "Risk/control overlap",
      }));
    }
  }

  for (const doc of documents) {
    for (const node of [...hazards, ...controls, ...training].slice(0, 120)) {
      if (doc === node || !sameScope(doc, node)) continue;
      const overlap = tokenSimilarity(doc, node);
      if (overlap < 0.1) continue;
      pushUnique(edges, makeEdge({
        from: doc,
        to: node,
        relationshipType: "document_supports_requirement",
        strengthScore: Math.min(0.88, 0.5 + overlap),
        confidenceScore: Math.min(0.82, 0.52 + overlap),
        reason: `${doc.title} supports ${node.title} because their requirement language overlaps.`,
        detail: "Document/requirement overlap",
      }));
    }
  }

  const candidateNodes = nodes.filter((node) => node.semanticSummary.length > 0);
  for (let leftIndex = 0; leftIndex < candidateNodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidateNodes.length; rightIndex += 1) {
      if (edges.length >= maxEdges) return edges;
      const left = candidateNodes[leftIndex];
      const right = candidateNodes[rightIndex];
      if (!sameScope(left, right) || left.nodeType === right.nodeType) continue;
      const similarity = tokenSimilarity(left, right);
      if (similarity < 0.18) continue;
      pushUnique(edges, makeEdge({
        from: left,
        to: right,
        relationshipType: "similar_record_by_vector_match",
        strengthScore: Math.min(0.84, similarity + 0.42),
        confidenceScore: Math.min(0.78, similarity + 0.38),
        reason: `${left.title} and ${right.title} are semantically similar by shared safety terms. Vector embeddings can strengthen this match after indexing.`,
        detail: "Semantic similarity fallback",
        createdByType: "ai",
        metadata: { tokenSimilarity: Number(similarity.toFixed(3)), vectorFallback: true },
      }));
    }
  }

  return edges.slice(0, maxEdges);
}
