import {
  detectGusLearningPatterns,
  type GusLearningPattern,
  type GusLearningSignalInput,
} from "@/lib/gus/gusLearning";
import {
  applyGusFeedbackScore,
  scoreGusFeedback,
  type GusFeedbackInput,
} from "@/lib/gus/gusScoring";

export type GusMemoryScope = {
  companyId?: string | null;
  jobsiteId?: string | null;
  userId?: string | null;
};

export type GusFeedbackMemoryEntry = GusFeedbackInput & {
  scoreDelta: number;
  recordedAt: string;
};

export type GusMemorySnapshot = {
  scopeKey: string;
  companyId: string | null;
  jobsiteId: string | null;
  userId: string | null;
  totalScore: number;
  interactions: Record<string, GusFeedbackMemoryEntry>;
  patterns: GusLearningPattern[];
  updatedAt: string;
  constraints: {
    mayPrioritizeMessages: true;
    mayOverrideSafetyRules: false;
    mayApproveWork: false;
    maySuppressCriticalWarnings: false;
  };
};

function createEmptyMemory(scope: GusMemoryScope): GusMemorySnapshot {
  return {
    scopeKey: getGusMemoryScopeKey(scope),
    companyId: scope.companyId ?? null,
    jobsiteId: scope.jobsiteId ?? null,
    userId: scope.userId ?? null,
    totalScore: 0,
    interactions: {},
    patterns: [],
    updatedAt: new Date(0).toISOString(),
    constraints: {
      mayPrioritizeMessages: true,
      mayOverrideSafetyRules: false,
      mayApproveWork: false,
      maySuppressCriticalWarnings: false,
    },
  };
}

const gusMemoryStore = new Map<string, GusMemorySnapshot>();

export function getGusMemoryScopeKey(scope: GusMemoryScope) {
  return `${scope.companyId ?? "no-company"}:${scope.jobsiteId ?? "no-jobsite"}:${scope.userId ?? "anonymous"}`;
}

export function getGusMemory(scope: GusMemoryScope) {
  const key = getGusMemoryScopeKey(scope);
  const existing = gusMemoryStore.get(key);
  if (existing) return existing;

  const empty = createEmptyMemory(scope);
  gusMemoryStore.set(key, empty);
  return empty;
}

export function recordGusFeedback(scope: GusMemoryScope, feedback: GusFeedbackInput) {
  const key = getGusMemoryScopeKey(scope);
  const current = getGusMemory(scope);
  const previousEntry = current.interactions[feedback.interactionId];
  const previousDelta = previousEntry?.scoreDelta ?? 0;
  const scoreDelta = scoreGusFeedback(feedback);
  const totalScore = applyGusFeedbackScore(current.totalScore - previousDelta, feedback);
  const next: GusMemorySnapshot = {
    ...current,
    totalScore,
    interactions: {
      ...current.interactions,
      [feedback.interactionId]: {
        ...feedback,
        scoreDelta,
        recordedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };

  gusMemoryStore.set(key, next);

  return {
    memory: next,
    scoreDelta,
    previousScore: current.totalScore,
    totalScore,
  };
}

export function updateGusMemoryPatterns(
  scope: GusMemoryScope,
  signals: GusLearningSignalInput,
  now = new Date(),
) {
  const key = getGusMemoryScopeKey(scope);
  const current = getGusMemory(scope);
  const next: GusMemorySnapshot = {
    ...current,
    patterns: detectGusLearningPatterns(signals, now),
    updatedAt: new Date().toISOString(),
  };

  gusMemoryStore.set(key, next);
  return next;
}

export function resetGusMemoryForTests() {
  gusMemoryStore.clear();
}
