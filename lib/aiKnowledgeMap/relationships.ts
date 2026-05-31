import { sourceKey } from "@/lib/aiKnowledgeMap/normalize";
import type {
  AiKnowledgeEdge,
  AiKnowledgeEvidence,
  AiKnowledgeNode,
  AiKnowledgeRelationshipSuggestion,
  AiKnowledgeRelationshipType,
  AiKnowledgeValidationStatus,
} from "@/lib/aiKnowledgeMap/types";

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "work", "safety", "record", "required", "company", "project"]);

const HAZARD_TERMS = [
  "hot work",
  "fire",
  "burn",
  "weld",
  "torch",
  "fall",
  "trip",
  "tripped",
  "slip",
  "cord",
  "cable",
  "walkway",
  "housekeeping",
  "ladder",
  "scaffold",
  "electrical",
  "arc flash",
  "excavation",
  "trench",
  "confined space",
  "line of fire",
  "struck",
  "struck by",
  "caught",
  "caught between",
  "silica",
  "chemical",
  "heat",
  "loto",
  "lockout",
  "ergonomic",
  "body part",
  "knee",
  "hand",
  "back",
  "shoulder",
  "eye",
  "mewp",
  "lift",
  "ppe",
];

const CONTROL_TERMS = [
  "fire watch",
  "extinguisher",
  "permit",
  "ppe",
  "barricade",
  "guardrail",
  "fall protection",
  "lockout",
  "loto",
  "cord management",
  "cable management",
  "walkway inspection",
  "housekeeping",
  "inspection",
  "ventilation",
  "monitor",
  "spotter",
  "training",
  "supervisor",
  "signage",
  "corrective action",
];

const BODY_PART_TERMS = ["knee", "hand", "back", "shoulder", "eye", "arm", "leg", "foot", "ankle", "head"];
const EQUIPMENT_TERMS = ["cord", "cable", "ladder", "lift", "mewp", "forklift", "scaffold", "tool", "machine", "equipment"];

type RelationshipFeedbackProfile = {
  approved: Set<string>;
  rejected: Set<string>;
};

type RelationshipOptions = {
  maxEdges?: number;
  feedback?: RelationshipFeedbackProfile;
};

type SignalDefinition = {
  id: string;
  terms: string[];
  suggestions: Array<{
    relationshipType: AiKnowledgeRelationshipType;
    label: string;
    reason: string;
  }>;
};

const SIGNALS: SignalDefinition[] = [
  {
    id: "trip_fall_housekeeping",
    terms: ["trip", "tripped", "slip", "fall", "cord", "cable", "walkway", "housekeeping"],
    suggestions: [
      { relationshipType: "related_hazard", label: "Housekeeping / walking-working surface hazard", reason: "Text includes trip, slip, fall, cord, cable, walkway, or housekeeping signals." },
      { relationshipType: "required_control", label: "Cord management / walkway control", reason: "Trip or cord language indicates a likely control need for clear walking-working surfaces." },
      { relationshipType: "corrective_action_required", label: "Corrective action follow-up", reason: "A trip/fall exposure should be checked for corrective action assignment and closure." },
      { relationshipType: "repeat_trend", label: "Trip/fall trend", reason: "Trip and fall language should be tracked for repeat trend detection." },
    ],
  },
  {
    id: "body_part_exposure",
    terms: BODY_PART_TERMS,
    suggestions: [
      { relationshipType: "body_part_related", label: "Body part exposure", reason: "Text identifies a potentially affected body part." },
    ],
  },
  {
    id: "hot_work",
    terms: ["hot work", "weld", "welding", "torch", "fire", "burn", "spark", "extinguisher", "fire watch"],
    suggestions: [
      { relationshipType: "permit_related", label: "Hot work permit relationship", reason: "Hot work terms usually require permit, fire watch, extinguisher, PPE, and procedure review." },
      { relationshipType: "required_control", label: "Fire watch / extinguisher control", reason: "Fire and hot work language indicate required fire prevention controls." },
      { relationshipType: "required_training", label: "Hot work training", reason: "Hot work tasks should be checked against required training." },
    ],
  },
  {
    id: "loto_electrical",
    terms: ["loto", "lockout", "tagout", "electrical", "arc flash", "energized"],
    suggestions: [
      { relationshipType: "required_control", label: "LOTO / electrical isolation control", reason: "Energy isolation terms indicate required lockout or electrical controls." },
      { relationshipType: "required_training", label: "Authorized worker training", reason: "LOTO and electrical work should be checked against training requirements." },
    ],
  },
  {
    id: "confined_excavation",
    terms: ["confined space", "excavation", "trench", "soil", "atmosphere", "rescue", "entry"],
    suggestions: [
      { relationshipType: "permit_related", label: "Permit-required high-risk work", reason: "Confined space or excavation language usually requires permit and procedure controls." },
      { relationshipType: "predictive_risk_signal", label: "High potential risk cluster", reason: "Confined space and excavation are high-consequence work categories." },
    ],
  },
  {
    id: "elevated_work",
    terms: ["ladder", "lift", "mewp", "scaffold", "fall protection", "elevated", "height"],
    suggestions: [
      { relationshipType: "related_hazard", label: "Elevated work / fall hazard", reason: "Elevated work terms indicate fall exposure." },
      { relationshipType: "required_control", label: "Fall protection control", reason: "Ladders, lifts, and scaffolds should be tied to fall prevention controls." },
      { relationshipType: "required_training", label: "Elevated work training", reason: "Elevated work should be checked against ladder, lift, MEWP, or fall protection training." },
    ],
  },
  {
    id: "chemical_ppe_ergonomic",
    terms: ["chemical", "ppe", "ergonomic", "strain", "overexertion", "respirator", "glove", "eye protection"],
    suggestions: [
      { relationshipType: "required_control", label: "PPE / exposure control", reason: "PPE, chemical, or ergonomic signals should be tied to exposure controls." },
      { relationshipType: "required_training", label: "Exposure training", reason: "Exposure-control language should be checked against training requirements." },
    ],
  },
];

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

function signalHits(node: AiKnowledgeNode) {
  const text = searchableText(node);
  return SIGNALS.map((signal) => ({
    ...signal,
    hits: signal.terms.filter((term) => text.includes(term)),
  })).filter((signal) => signal.hits.length > 0);
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
  if (confidence < 0.45) return "needs_review";
  return "pending_review";
}

function reviewStatus(confidence: number, status: AiKnowledgeValidationStatus) {
  if (status === "approved") return "auto_linked";
  if (status === "rejected" || status === "incorrect") return "rejected";
  if (status === "needs_review" || confidence < 0.45) return "needs_more_data";
  if (status === "unreviewed") return "draft";
  return "suggested";
}

function feedbackKey(relationshipType: AiKnowledgeRelationshipType, signal: string) {
  return `${relationshipType}:${signal}`;
}

function applyFeedback(confidence: number, keys: string[], feedback?: RelationshipFeedbackProfile) {
  if (!feedback || keys.length === 0) return confidence;
  const approvedHits = keys.filter((key) => feedback.approved.has(key)).length;
  const rejectedHits = keys.filter((key) => feedback.rejected.has(key)).length;
  return Math.max(0.2, Math.min(0.97, confidence + Math.min(0.12, approvedHits * 0.04) - Math.min(0.18, rejectedHits * 0.08)));
}

function makeEdge(params: {
  from: AiKnowledgeNode;
  to: AiKnowledgeNode;
  relationshipType: AiKnowledgeRelationshipType;
  strengthScore: number;
  confidenceScore: number;
  reason: string;
  detail: string;
  evidenceText?: string;
  createdByType?: "system" | "ai";
  metadata?: Record<string, unknown>;
  feedback?: RelationshipFeedbackProfile;
}): AiKnowledgeEdge {
  const signalKeys = Array.isArray(params.metadata?.signalKeys) ? params.metadata.signalKeys.map(String) : [];
  const confidence = applyFeedback(params.confidenceScore, signalKeys, params.feedback);
  const status = validationStatus(confidence);
  const strength = Number(params.strengthScore.toFixed(3));
  const evidenceText = params.evidenceText ?? params.detail;
  return {
    companyId: params.from.companyId,
    fromNodeKey: sourceKey(params.from.sourceTable, params.from.sourceId),
    toNodeKey: sourceKey(params.to.sourceTable, params.to.sourceId),
    relationshipType: params.relationshipType,
    relationshipStrength: strength,
    strengthScore: strength,
    reason: params.reason,
    evidenceText,
    sourceEvidence: evidenceFor(params.from, params.to, evidenceText),
    confidenceScore: Number(confidence.toFixed(3)),
    createdByType: params.createdByType ?? "system",
    validationStatus: status,
    relationshipStatus: reviewStatus(confidence, status),
    createdBy: null,
    reviewedBy: null,
    reviewedAt: null,
    metadata: {
      ...(params.metadata ?? {}),
      evidenceText,
      relationshipStatus: reviewStatus(confidence, status),
      signalKeys,
    },
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

function targetMatchesSignal(target: AiKnowledgeNode, terms: string[]) {
  const text = searchableText(target);
  return terms.filter((term) => text.includes(term));
}

function confidenceForSignal(hitCount: number, overlap: number, base = 0.6) {
  return Math.min(0.92, base + hitCount * 0.055 + overlap);
}

export function suggestPotentialRelationshipsForNode(node: AiKnowledgeNode, nodes: AiKnowledgeNode[] = []): AiKnowledgeRelationshipSuggestion[] {
  const hits = signalHits(node);
  if (hits.length === 0) return [];
  const suggestions: AiKnowledgeRelationshipSuggestion[] = [];
  const text = searchableText(node);
  for (const signal of hits) {
    for (const suggestion of signal.suggestions) {
      const target = nodes.find((candidate) =>
        candidate.id !== node.id
        && candidate.companyId === node.companyId
        && targetMatchesSignal(candidate, signal.hits).length > 0
        && (
          suggestion.relationshipType === "required_control" ? candidate.nodeType === "control" :
          suggestion.relationshipType === "required_training" ? candidate.nodeType === "training" :
          suggestion.relationshipType === "corrective_action_required" ? candidate.nodeType === "corrective_action" :
          suggestion.relationshipType === "document_reference" ? candidate.nodeType === "document" :
          true
        ),
      );
      const evidence = signal.hits.join(", ");
      suggestions.push({
        relationshipType: suggestion.relationshipType,
        label: target ? `${suggestion.label}: ${target.title}` : suggestion.label,
        confidenceScore: Number(Math.min(0.86, 0.56 + signal.hits.length * 0.05).toFixed(3)),
        reason: suggestion.reason,
        evidenceText: `Detected safety signal(s): ${evidence}. Source text: ${text.slice(0, 220)}`,
        status: "suggested",
        createdBy: "ai",
        targetTitle: target?.title ?? null,
      });
    }
  }
  return suggestions.slice(0, 8);
}

function createSignalEdges(edges: AiKnowledgeEdge[], source: AiKnowledgeNode, targets: AiKnowledgeNode[], options: RelationshipOptions) {
  const signals = signalHits(source);
  if (signals.length === 0) return;
  for (const signal of signals) {
    const signalTargetHits = targets
      .filter((target) => target !== source && sameScope(source, target))
      .map((target) => ({ target, hits: targetMatchesSignal(target, signal.terms), overlap: tokenSimilarity(source, target) }))
      .filter((match) => match.hits.length > 0 || match.overlap >= 0.08);

    for (const suggestion of signal.suggestions) {
      const typedTargets = signalTargetHits.filter(({ target }) => {
        if (suggestion.relationshipType === "related_hazard") return target.nodeType === "hazard";
        if (suggestion.relationshipType === "required_control") return target.nodeType === "control";
        if (suggestion.relationshipType === "required_training") return target.nodeType === "training";
        if (suggestion.relationshipType === "corrective_action_required") return target.nodeType === "corrective_action";
        if (suggestion.relationshipType === "permit_related") return target.nodeType === "permit";
        if (suggestion.relationshipType === "jsa_related") return target.nodeType === "task";
        if (suggestion.relationshipType === "document_reference") return target.nodeType === "document";
        return true;
      });

      for (const { target, hits, overlap } of typedTargets.slice(0, 8)) {
        const evidence = [...new Set([...signal.hits, ...hits])].join(", ");
        const signalKeys = [feedbackKey(suggestion.relationshipType, signal.id), ...signal.hits.map((hit) => feedbackKey(suggestion.relationshipType, hit))];
        pushUnique(edges, makeEdge({
          from: source,
          to: target,
          relationshipType: suggestion.relationshipType,
          strengthScore: Math.min(0.94, 0.56 + overlap + hits.length * 0.04 + signal.hits.length * 0.03),
          confidenceScore: confidenceForSignal(hits.length + signal.hits.length, overlap),
          reason: `${source.title} connects to ${target.title}. ${suggestion.reason}`,
          detail: "Safety keyword and semantic signal match",
          evidenceText: `Matched safety signal(s): ${evidence || signal.id}.`,
          createdByType: "ai",
          metadata: { signal: signal.id, signalHits: signal.hits, targetHits: hits, signalKeys },
          feedback: options.feedback,
        }));
      }
    }
  }
}

export function generateKnowledgeRelationships(nodes: AiKnowledgeNode[], options: RelationshipOptions = {}) {
  const maxEdges = options.maxEdges ?? 280;
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

  for (const node of [...incidents, ...observations, ...hazards, ...correctiveActions]) {
    createSignalEdges(edges, node, nodes, options);
    if (edges.length >= maxEdges) return edges.slice(0, maxEdges);
  }

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
        evidenceText: `Permit/control overlap: ${controlHits.join(", ") || "shared safety controls"}.`,
        metadata: { signalKeys: controlHits.map((hit) => feedbackKey("permit_requires_control", hit)) },
        feedback: options.feedback,
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
        evidenceText: `Task/hazard evidence: ${hits.join(", ") || "shared hazard terms"}.`,
        metadata: { signalKeys: hits.map((hit) => feedbackKey("task_has_hazard", hit)) },
        feedback: options.feedback,
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
        evidenceText: "Permit/task semantic overlap.",
        feedback: options.feedback,
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
        evidenceText: `Training evidence: ${hits.join(", ") || "task/training overlap"}.`,
        metadata: { signalKeys: hits.map((hit) => feedbackKey("training_required_for_task", hit)) },
        feedback: options.feedback,
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
        evidenceText: `Hazard/control evidence: ${controlHits.join(", ") || "matching control language"}.`,
        metadata: { signalKeys: controlHits.map((hit) => feedbackKey("hazard_mitigated_by_control", hit)) },
        feedback: options.feedback,
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
        evidenceText: "Incident/task semantic overlap.",
        feedback: options.feedback,
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
        evidenceText: `Incident/hazard evidence: ${hits.join(", ")}.`,
        metadata: { signalKeys: hits.map((hit) => feedbackKey("incident_caused_by_hazard", hit)) },
        feedback: options.feedback,
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
        evidenceText: "Observation/corrective-action semantic overlap.",
        feedback: options.feedback,
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
        evidenceText: "Corrective action/hazard semantic overlap.",
        feedback: options.feedback,
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
        evidenceText: "Training gap risk signal.",
        metadata: { signalKeys: [feedbackKey("risk_increased_by_training_gap", "training_gap")] },
        feedback: options.feedback,
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
        evidenceText: "Risk/control semantic overlap.",
        feedback: options.feedback,
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
        evidenceText: "Document/requirement semantic overlap.",
        feedback: options.feedback,
      }));
      pushUnique(edges, makeEdge({
        from: doc,
        to: node,
        relationshipType: "document_reference",
        strengthScore: Math.min(0.86, 0.48 + overlap),
        confidenceScore: Math.min(0.8, 0.5 + overlap),
        reason: `${doc.title} is a document reference for ${node.title}.`,
        detail: "Document/reference overlap",
        evidenceText: "Document reference evidence from shared requirement language.",
        feedback: options.feedback,
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
        evidenceText: `Shared semantic similarity score ${similarity.toFixed(3)}.`,
        createdByType: "ai",
        metadata: { tokenSimilarity: Number(similarity.toFixed(3)), vectorFallback: true },
        feedback: options.feedback,
      }));
    }
  }

  for (const node of nodes) {
    for (const term of BODY_PART_TERMS) {
      if (!searchableText(node).includes(term)) continue;
      for (const other of nodes.filter((candidate) => candidate.id !== node.id && sameScope(node, candidate) && searchableText(candidate).includes(term)).slice(0, 4)) {
        pushUnique(edges, makeEdge({
          from: node,
          to: other,
          relationshipType: "body_part_related",
          strengthScore: 0.66,
          confidenceScore: 0.62,
          reason: `${node.title} and ${other.title} both reference ${term} body-part exposure.`,
          detail: "Body part safety signal",
          evidenceText: `Shared body-part term: ${term}.`,
          createdByType: "ai",
          metadata: { signal: "body_part_exposure", signalHits: [term], signalKeys: [feedbackKey("body_part_related", term)] },
          feedback: options.feedback,
        }));
      }
    }
    for (const term of EQUIPMENT_TERMS) {
      if (!searchableText(node).includes(term)) continue;
      for (const other of nodes.filter((candidate) => candidate.id !== node.id && sameScope(node, candidate) && searchableText(candidate).includes(term)).slice(0, 4)) {
        pushUnique(edges, makeEdge({
          from: node,
          to: other,
          relationshipType: "equipment_related",
          strengthScore: 0.66,
          confidenceScore: 0.62,
          reason: `${node.title} and ${other.title} both reference ${term} equipment or work-area exposure.`,
          detail: "Equipment safety signal",
          evidenceText: `Shared equipment/work-area term: ${term}.`,
          createdByType: "ai",
          metadata: { signal: "equipment_exposure", signalHits: [term], signalKeys: [feedbackKey("equipment_related", term)] },
          feedback: options.feedback,
        }));
      }
    }
  }

  return edges.slice(0, maxEdges);
}
