import type { GusContext } from "@/lib/gus/gusContext";
import { createGusMessageLearningProfile } from "@/lib/gus/gusLearning";
import { getGusMemory, type GusMemorySnapshot } from "@/lib/gus/gusMemory";
import { validateGusOutput } from "@/lib/gus/gusValidation";
import type { GusMessage, GusRiskLevel } from "@/lib/gus/gusTypes";

export type GusMessageRequest = {
  companyId?: string;
  jobsiteId?: string;
  userId?: string;
  currentPage: string;
  route: string;
  liveContext?: Partial<
    Pick<
      GusContext,
      | "riskLevel"
      | "riskDrivers"
      | "missingPermitTypes"
      | "expiredTrainingCount"
      | "upcomingTrainingExpirationCount"
      | "incompleteJsaFields"
      | "recentObservationTypes"
      | "recentPositiveObservationCount"
      | "recentNegativeObservationCount"
      | "weatherRiskLevel"
      | "scheduleUploadedToday"
      | "currentTaskType"
      | "currentTrade"
    >
  >;
};

export type GusMessageSelection = GusMessage & {
  selectorReason: string;
  memory: {
    companyScore: number;
    jobsiteScore: number;
    userScore: number;
    patternKeys: string[];
  };
};

type Candidate = {
  rank: number;
  message: GusMessage;
};

type LoadedGusMemory = {
  companyMemory: GusMemorySnapshot;
  jobsiteMemory: GusMemorySnapshot;
  userMemory: GusMemorySnapshot;
  combinedScore: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidGusUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 240) : fallback;
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
}

function cleanCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function cleanRiskLevel(value: unknown): GusRiskLevel | undefined {
  return value === "low" || value === "moderate" || value === "high" || value === "severe"
    ? value
    : undefined;
}

export function parseGusMessageRequest(input: unknown):
  | { ok: true; request: GusMessageRequest }
  | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const body = input as Record<string, unknown>;
  const liveContext =
    body.liveContext && typeof body.liveContext === "object" && !Array.isArray(body.liveContext)
      ? (body.liveContext as Record<string, unknown>)
      : {};
  const errors: string[] = [];

  for (const key of ["companyId", "jobsiteId", "userId"] as const) {
    if (body[key] != null && !isValidGusUuid(body[key])) {
      errors.push(`${key} must be a UUID when provided.`);
    }
  }

  const currentPage = cleanString(body.currentPage);
  const route = cleanString(body.route);

  if (!currentPage) errors.push("currentPage is required.");
  if (!route || !route.startsWith("/")) errors.push("route must be an app path.");

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      companyId: typeof body.companyId === "string" ? body.companyId.trim() : undefined,
      jobsiteId: typeof body.jobsiteId === "string" ? body.jobsiteId.trim() : undefined,
      userId: typeof body.userId === "string" ? body.userId.trim() : undefined,
      currentPage,
      route,
      liveContext: {
        riskLevel: cleanRiskLevel(liveContext.riskLevel),
        riskDrivers: cleanStringArray(liveContext.riskDrivers),
        missingPermitTypes: cleanStringArray(liveContext.missingPermitTypes),
        expiredTrainingCount: cleanCount(liveContext.expiredTrainingCount),
        upcomingTrainingExpirationCount: cleanCount(liveContext.upcomingTrainingExpirationCount),
        incompleteJsaFields: cleanStringArray(liveContext.incompleteJsaFields),
        recentObservationTypes: cleanStringArray(liveContext.recentObservationTypes),
        recentPositiveObservationCount: cleanCount(liveContext.recentPositiveObservationCount),
        recentNegativeObservationCount: cleanCount(liveContext.recentNegativeObservationCount),
        weatherRiskLevel: cleanRiskLevel(liveContext.weatherRiskLevel),
        scheduleUploadedToday: liveContext.scheduleUploadedToday === true,
        currentTaskType: cleanString(liveContext.currentTaskType),
        currentTrade: cleanString(liveContext.currentTrade),
      },
    },
  };
}

function loadGusSelectionMemory(request: GusMessageRequest): LoadedGusMemory {
  const companyMemory = getGusMemory({
    companyId: request.companyId ?? null,
    userId: null,
  });
  const jobsiteMemory = getGusMemory({
    companyId: request.companyId ?? null,
    jobsiteId: request.jobsiteId ?? null,
    userId: null,
  });
  const userMemory = getGusMemory({
    companyId: request.companyId ?? null,
    userId: request.userId ?? null,
  });

  return {
    companyMemory,
    jobsiteMemory,
    userMemory,
    combinedScore: companyMemory.totalScore + jobsiteMemory.totalScore + userMemory.totalScore,
  };
}

function action(actionLabel: string, actionHref: string, actionKey: string) {
  return { actionLabel, actionHref, actionKey };
}

function joinList(items: string[], fallback: string) {
  if (items.length === 0) return fallback;
  return items.slice(0, 3).join(", ");
}

function hasCorrectiveActionDriver(riskDrivers: string[]) {
  return riskDrivers.some((driver) => /corrective|open action|closure/i.test(driver));
}

function buildCandidates(request: GusMessageRequest, memory: LoadedGusMemory): Candidate[] {
  const ctx = request.liveContext ?? {};
  const riskDrivers = ctx.riskDrivers ?? [];
  const missingPermitTypes = ctx.missingPermitTypes ?? [];
  const incompleteJsaFields = ctx.incompleteJsaFields ?? [];
  const candidates: Candidate[] = [];
  const task = ctx.currentTaskType ? ` for ${ctx.currentTaskType}` : "";

  if (ctx.riskLevel === "severe") {
    candidates.push({
      rank: 1,
      message: {
        messageId: "gus-critical-risk-warning",
        category: "warning",
        priority: 1,
        message: "Severe risk is showing for this work. Pause and get human safety review before work proceeds.",
        spokenText: "Severe risk is showing for this work. Pause and get human safety review before work proceeds.",
        shouldSpeak: false,
        reason: `Top drivers: ${joinList(riskDrivers, "severe predictive risk signals")}. Gus cannot approve work.`,
        confidence: 0.9,
        ...action("Review risk", "/risk", "guide_to_risk"),
      },
    });
  }

  if (missingPermitTypes.length > 0) {
    candidates.push({
      rank: 2,
      message: {
        messageId: "gus-missing-permit-review",
        category: "permit_alert",
        priority: 2,
        message: `Heads up. This task may require permit review before work starts: ${joinList(missingPermitTypes, "permit details")}.`,
        spokenText: "Heads up. This task may need permit review before work starts.",
        shouldSpeak: false,
        reason: "The current task has missing permit information. Gus can point you to permits but cannot approve or release work.",
        confidence: 0.82,
        ...action("Review permits", "/permits", "guide_to_permits"),
      },
    });
  }

  if ((ctx.expiredTrainingCount ?? 0) > 0) {
    candidates.push({
      rank: 3,
      message: {
        messageId: "gus-expired-training-review",
        category: "training_alert",
        priority: 2,
        message: `${ctx.expiredTrainingCount} expired training item${ctx.expiredTrainingCount === 1 ? "" : "s"} need review before assignment${task}.`,
        spokenText: "Expired training items need review before assignment.",
        shouldSpeak: false,
        reason: "Training readiness should be checked by a responsible person before work starts.",
        confidence: 0.8,
        ...action("Check training", "/training", "guide_to_training"),
      },
    });
  }

  if (ctx.riskLevel === "high") {
    candidates.push({
      rank: 4,
      message: {
        messageId: "gus-high-risk-review",
        category: "risk_alert",
        priority: 2,
        message: "High predictive risk is showing. Review the top drivers and confirm controls before the crew starts.",
        spokenText: "High predictive risk is showing. Review the top drivers and confirm controls before work starts.",
        shouldSpeak: false,
        reason: `Top drivers: ${joinList(riskDrivers, "high-risk signals")}.`,
        confidence: 0.78,
        ...action("Review risk", "/risk", "guide_to_risk"),
      },
    });
  }

  if (hasCorrectiveActionDriver(riskDrivers)) {
    candidates.push({
      rank: 5,
      message: {
        messageId: "gus-open-corrective-action",
        category: "reminder",
        priority: 3,
        message: "Open corrective action signals are present. Check ownership and due dates before relying on the control.",
        spokenText: "Open corrective action signals are present. Check ownership and due dates.",
        shouldSpeak: false,
        reason: "Open actions can mean a control is not fully verified yet.",
        confidence: 0.74,
        ...action("Review dashboard", "/dashboard", "guide_to_dashboard"),
      },
    });
  }

  if (incompleteJsaFields.length > 0) {
    candidates.push({
      rank: 6,
      message: {
        messageId: "gus-incomplete-jsa-review",
        category: "planning",
        priority: 3,
        message: `The JSA draft is missing ${joinList(incompleteJsaFields, "required fields")}. Keep it draft-only until review.`,
        spokenText: "The JSA draft is missing information. Keep it draft-only until review.",
        shouldSpeak: false,
        reason: "Gus can identify missing fields, but a human reviewer must check the plan before work starts.",
        confidence: 0.76,
        ...action("Review JSAs", "/jsa", "guide_to_jsa"),
      },
    });
  }

  if (ctx.weatherRiskLevel === "high" || ctx.weatherRiskLevel === "severe") {
    candidates.push({
      rank: 7,
      message: {
        messageId: "gus-weather-risk-review",
        category: "risk_alert",
        priority: ctx.weatherRiskLevel === "severe" ? 1 : 2,
        message: "Weather risk is elevated. Review the work plan, stop-work triggers, and communication controls.",
        spokenText: "Weather risk is elevated. Review stop-work triggers and communication controls.",
        shouldSpeak: false,
        reason: "Weather changes can affect access, lifting, excavation, heat stress, and other field controls.",
        confidence: ctx.weatherRiskLevel === "severe" ? 0.86 : 0.72,
        ...action("Review risk", "/risk", "guide_to_risk"),
      },
    });
  }

  const topPattern = memory.jobsiteMemory.patterns[0] ?? memory.companyMemory.patterns[0];
  if (topPattern) {
    candidates.push({
      rank: 8,
      message: {
        messageId: `gus-pattern-${topPattern.key}`,
        category: "learning",
        priority: 3,
        message: `${topPattern.label} is showing here. Consider adding a focused review to the pre-task discussion.`,
        spokenText: `${topPattern.label} is showing here. Consider a focused pre-task review.`,
        shouldSpeak: false,
        reason: topPattern.reason,
        confidence: Math.min(0.84, 0.62 + topPattern.priorityBoost),
        ...action("Review dashboard", "/dashboard", "guide_to_dashboard"),
      },
    });
  }

  candidates.push({
    rank: 9,
    message: {
      messageId: ctx.scheduleUploadedToday ? "gus-schedule-safety-tip" : "gus-general-safety-tip",
      category: "safety_tip",
      priority: 4,
      message: ctx.scheduleUploadedToday
        ? "Schedule uploaded today. Look for tasks that now need permits, JSAs, briefings, or training checks."
        : "Quick safety check: confirm the task, hazards, controls, and reviewer before work starts.",
      spokenText: "Quick safety check. Confirm the task, hazards, controls, and reviewer before work starts.",
      shouldSpeak: false,
      reason: "Gus is using structured context only and will not approve work or submit records.",
      confidence: 0.62,
      ...action("Review dashboard", "/dashboard", "guide_to_dashboard"),
    },
  });

  if ((ctx.recentPositiveObservationCount ?? 0) > (ctx.recentNegativeObservationCount ?? 0)) {
    candidates.push({
      rank: 10,
      message: {
        messageId: "gus-positive-observation-compliment",
        category: "compliment",
        priority: 5,
        message: "Good signal: positive observations are outpacing negative ones. Reinforce the safe behaviors that are working.",
        spokenText: "Positive observations are outpacing negative ones. Reinforce the safe behaviors that are working.",
        shouldSpeak: false,
        reason: "Positive safety feedback helps crews repeat effective controls.",
        confidence: 0.58,
        ...action("Review dashboard", "/dashboard", "guide_to_dashboard"),
      },
    });
  }

  return candidates;
}

function scoreCandidate(candidate: Candidate, memory: LoadedGusMemory) {
  const profile = createGusMessageLearningProfile(candidate.message, memory.combinedScore);
  const genericTipPenalty = candidate.message.category === "safety_tip" && memory.combinedScore < -0.3 ? 0.35 : 0;
  const usefulReminderBoost =
    (candidate.message.category === "reminder" || candidate.message.category === "learning") &&
    memory.combinedScore > 0.3
      ? 0.25
      : 0;

  return candidate.rank - profile.showWeight * 0.05 + genericTipPenalty - usefulReminderBoost;
}

export function selectGusMessage(request: GusMessageRequest): GusMessageSelection {
  const memory = loadGusSelectionMemory(request);
  const candidates = buildCandidates(request, memory);
  const best = [...candidates].sort((a, b) => scoreCandidate(a, memory) - scoreCandidate(b, memory))[0];
  const validation = validateGusOutput(best.message);
  const message = validation.sanitizedOutput;
  const profile = createGusMessageLearningProfile(message, memory.combinedScore);
  const patternKeys = [...memory.jobsiteMemory.patterns, ...memory.companyMemory.patterns].map(
    (pattern) => pattern.key,
  );

  return {
    ...message,
    priority: Math.min(message.priority, profile.priority),
    selectorReason: validation.ok
      ? "Selected by structured Gus safety priority rules."
      : "Selected by structured rules and sanitized by Gus trust rules.",
    memory: {
      companyScore: memory.companyMemory.totalScore,
      jobsiteScore: memory.jobsiteMemory.totalScore,
      userScore: memory.userMemory.totalScore,
      patternKeys,
    },
  };
}

