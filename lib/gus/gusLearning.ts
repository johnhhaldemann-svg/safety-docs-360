import type { GusMessage } from "@/lib/gus/gusTypes";
import { clampGusLearningScore } from "@/lib/gus/gusScoring";

export type GusLearningPatternKey =
  | "housekeeping_trend"
  | "permit_completion_trend"
  | "training_readiness_issue"
  | "jsa_quality_trend"
  | "weather_planning_trend";

export type GusLearningPattern = {
  key: GusLearningPatternKey;
  label: string;
  reason: string;
  evidenceCount: number;
  priorityBoost: number;
  safetyOverrideAllowed: false;
  maySuppressCriticalWarnings: false;
};

export type GusLearningObservation = {
  type?: string | null;
  category?: string | null;
  observedAt?: string | null;
  createdAt?: string | null;
};

export type GusLearningPermit = {
  missingSignature?: boolean | null;
  signatureMissing?: boolean | null;
  createdAt?: string | null;
};

export type GusLearningTraining = {
  expired?: boolean | null;
  critical?: boolean | null;
};

export type GusLearningJsa = {
  incomplete?: boolean | null;
  missingFields?: string[] | null;
  createdAt?: string | null;
};

export type GusLearningWeather = {
  stoppage?: boolean | null;
  stoppedWork?: boolean | null;
  createdAt?: string | null;
};

export type GusLearningSignalInput = {
  observations?: GusLearningObservation[];
  permits?: GusLearningPermit[];
  trainings?: GusLearningTraining[];
  jsas?: GusLearningJsa[];
  weather?: GusLearningWeather[];
};

export type GusMessageLearningProfile = {
  messageId: string;
  learningScore: number;
  showWeight: number;
  priority: number;
  criticalWarningProtected: boolean;
};

function parseTime(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isWithinDays(value: string | null | undefined, nowMs: number, days: number) {
  const parsed = parseTime(value);
  if (!parsed) return true;
  return nowMs - parsed <= days * 24 * 60 * 60 * 1000;
}

function includesHousekeeping(value?: string | null) {
  return (value ?? "").toLowerCase().includes("housekeeping");
}

function makePattern(pattern: Omit<GusLearningPattern, "safetyOverrideAllowed" | "maySuppressCriticalWarnings">) {
  return {
    ...pattern,
    safetyOverrideAllowed: false as const,
    maySuppressCriticalWarnings: false as const,
  };
}

export function detectGusLearningPatterns(
  input: GusLearningSignalInput,
  now: Date = new Date(),
): GusLearningPattern[] {
  const nowMs = now.getTime();
  const observations = input.observations ?? [];
  const permits = input.permits ?? [];
  const trainings = input.trainings ?? [];
  const jsas = input.jsas ?? [];
  const weather = input.weather ?? [];
  const patterns: GusLearningPattern[] = [];

  const housekeepingCount = observations.filter(
    (observation) =>
      isWithinDays(observation.observedAt ?? observation.createdAt, nowMs, 30) &&
      (includesHousekeeping(observation.type) || includesHousekeeping(observation.category)),
  ).length;

  if (housekeepingCount >= 3) {
    patterns.push(
      makePattern({
        key: "housekeeping_trend",
        label: "Housekeeping trend",
        reason: "Three or more housekeeping observations were repeated in the last 30 days.",
        evidenceCount: housekeepingCount,
        priorityBoost: 0.12,
      }),
    );
  }

  const missingPermitSignatureCount = permits.filter(
    (permit) =>
      isWithinDays(permit.createdAt, nowMs, 30) &&
      (permit.missingSignature === true || permit.signatureMissing === true),
  ).length;

  if (missingPermitSignatureCount >= 3) {
    patterns.push(
      makePattern({
        key: "permit_completion_trend",
        label: "Permit completion trend",
        reason: "Three or more permits were missing signatures in the last 30 days.",
        evidenceCount: missingPermitSignatureCount,
        priorityBoost: 0.16,
      }),
    );
  }

  const expiredCriticalTrainingCount = trainings.filter(
    (training) => training.expired === true && training.critical === true,
  ).length;

  if (expiredCriticalTrainingCount >= 2) {
    patterns.push(
      makePattern({
        key: "training_readiness_issue",
        label: "Training readiness issue",
        reason: "Two or more critical trainings are expired.",
        evidenceCount: expiredCriticalTrainingCount,
        priorityBoost: 0.18,
      }),
    );
  }

  const incompleteJsaCount = jsas.filter(
    (jsa) =>
      isWithinDays(jsa.createdAt, nowMs, 30) &&
      (jsa.incomplete === true || Boolean(jsa.missingFields?.length)),
  ).length;

  if (incompleteJsaCount >= 3) {
    patterns.push(
      makePattern({
        key: "jsa_quality_trend",
        label: "JSA quality trend",
        reason: "Repeated incomplete JSAs were found in the recent work window.",
        evidenceCount: incompleteJsaCount,
        priorityBoost: 0.14,
      }),
    );
  }

  const weatherStoppageCount = weather.filter(
    (event) =>
      isWithinDays(event.createdAt, nowMs, 30) &&
      (event.stoppage === true || event.stoppedWork === true),
  ).length;

  if (weatherStoppageCount >= 2) {
    patterns.push(
      makePattern({
        key: "weather_planning_trend",
        label: "Weather planning trend",
        reason: "Repeated weather stoppages suggest planning controls should be reviewed.",
        evidenceCount: weatherStoppageCount,
        priorityBoost: 0.1,
      }),
    );
  }

  return patterns;
}

export function getGusMessageShowWeight(score: number) {
  if (score <= -0.3) return 0.55;
  if (score < 0) return 0.8;
  if (score >= 0.35) return 1.35;
  if (score > 0) return 1.15;
  return 1;
}

export function createGusMessageLearningProfile(
  message: GusMessage,
  score = 0,
): GusMessageLearningProfile {
  const criticalWarningProtected =
    message.priority <= 1 ||
    message.category === "warning" ||
    message.category === "risk_alert" ||
    message.category === "permit_alert" ||
    message.category === "training_alert";
  const learningScore = clampGusLearningScore(score);

  return {
    messageId: message.messageId,
    learningScore,
    showWeight: criticalWarningProtected ? Math.max(1, getGusMessageShowWeight(learningScore)) : getGusMessageShowWeight(learningScore),
    priority: criticalWarningProtected ? message.priority : Math.max(1, message.priority - Math.round(Math.max(0, learningScore))),
    criticalWarningProtected,
  };
}

