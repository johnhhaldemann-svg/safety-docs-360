import type {
  GusPlanModule,
  GusWorkTypeDetection,
  GusWorkTypeDetectionResult,
} from "@/lib/gus/plans/basePlanningTypes";
import { gusPlanModules } from "@/lib/gus/plans/modules";

type PlanningSignal = {
  id: string;
  displayName: string;
  triggerKeywords: string[];
  reason: string;
};

const clarificationQuestion = "I can help plan this. What type of work is the crew performing?";
const lowConfidenceThreshold = 0.22;

const planningSignals: PlanningSignal[] = [
  {
    id: "firePrevention",
    displayName: "Fire prevention",
    triggerKeywords: ["grinding", "welding", "hot work", "torch", "spark", "combustible", "stored materials", "fire watch"],
    reason: "Task text suggests sparks, heat, combustible exposure, or fire watch planning.",
  },
  {
    id: "ppe",
    displayName: "PPE",
    triggerKeywords: ["grinding", "welding", "cutting", "chemical", "concrete", "silica", "overhead", "hot weather"],
    reason: "Task text suggests exposure that may require PPE review against company policy.",
  },
  {
    id: "housekeeping",
    displayName: "Housekeeping / material storage",
    triggerKeywords: ["stored materials", "materials", "storage", "debris", "housekeeping", "near stored", "access"],
    reason: "Task text suggests material storage, access, or housekeeping controls may need review.",
  },
  {
    id: "fallingObjects",
    displayName: "Falling object controls",
    triggerKeywords: ["overhead", "above", "lift", "height", "ductwork", "install overhead", "dropped object"],
    reason: "Task text suggests overhead work or dropped-object exposure.",
  },
  {
    id: "heatStress",
    displayName: "Heat stress",
    triggerKeywords: ["hot weather", "heat", "high temperature", "summer", "heat stress"],
    reason: "Task text suggests heat or environmental exposure planning.",
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

function findMatchedKeywords(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(normalize(keyword)));
}

function keywordScore(keywords: string[]) {
  return keywords.reduce((total, keyword) => total + Math.max(1, normalize(keyword).length / 12), 0);
}

function moduleDetection(module: GusPlanModule, text: string): GusWorkTypeDetection | null {
  const matchedKeywords = findMatchedKeywords(text, module.triggerKeywords);
  if (matchedKeywords.length === 0) return null;

  const confidence = Math.min(0.96, 0.18 + matchedKeywords.length * 0.16 + keywordScore(matchedKeywords) * 0.08);

  return {
    id: module.moduleId,
    displayName: module.displayName,
    confidence: Math.round(confidence * 100) / 100,
    kind: "module",
    matchedKeywords,
    reason: `Matched ${matchedKeywords.join(", ")} in the work description.`,
  };
}

function signalDetection(signal: PlanningSignal, text: string): GusWorkTypeDetection | null {
  const matchedKeywords = findMatchedKeywords(text, signal.triggerKeywords);
  if (matchedKeywords.length === 0) return null;

  const confidence = Math.min(0.88, 0.14 + matchedKeywords.length * 0.13 + keywordScore(matchedKeywords) * 0.06);

  return {
    id: signal.id,
    displayName: signal.displayName,
    confidence: Math.round(confidence * 100) / 100,
    kind: "planning_signal",
    matchedKeywords,
    reason: signal.reason,
  };
}

function dedupeAndSort(matches: GusWorkTypeDetection[]) {
  const byId = new Map<string, GusWorkTypeDetection>();

  for (const match of matches) {
    const existing = byId.get(match.id);
    if (!existing || match.confidence > existing.confidence) {
      byId.set(match.id, match);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.kind !== b.kind) return a.kind === "module" ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function detectGusWorkTypes(inputText: string): GusWorkTypeDetectionResult {
  const normalized = normalize(inputText);

  if (!normalized) {
    return {
      matches: [],
      confidence: 0,
      lowConfidence: true,
      clarificationQuestion,
    };
  }

  const moduleMatches = gusPlanModules
    .map((module) => moduleDetection(module, normalized))
    .filter((match): match is GusWorkTypeDetection => Boolean(match));
  const signalMatches = planningSignals
    .map((signal) => signalDetection(signal, normalized))
    .filter((match): match is GusWorkTypeDetection => Boolean(match));
  const matches = dedupeAndSort([...moduleMatches, ...signalMatches]);
  const confidence = matches[0]?.confidence ?? 0;
  const lowConfidence = confidence < lowConfidenceThreshold;

  return {
    matches,
    confidence,
    lowConfidence,
    clarificationQuestion: lowConfidence ? clarificationQuestion : undefined,
  };
}

