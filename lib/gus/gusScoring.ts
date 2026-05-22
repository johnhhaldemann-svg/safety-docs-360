export type GusFeedbackInput = {
  interactionId: string;
  helpful: boolean;
  clicked?: boolean;
  dismissed?: boolean;
  audioReplayed?: boolean;
  mutedAfterMessage?: boolean;
  feedbackText?: string;
};

export type GusFeedbackValidationResult =
  | { ok: true; feedback: GusFeedbackInput }
  | { ok: false; errors: string[] };

export const gusFeedbackWeights = {
  helpful: 0.15,
  clicked: 0.1,
  audioReplayed: 0.08,
  dismissed: -0.05,
  notHelpful: -0.15,
  mutedAfterMessage: -0.1,
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function optionalBoolean(value: unknown) {
  return value == null || isBoolean(value);
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function clampGusLearningScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, roundScore(value)));
}

export function parseGusFeedbackInput(input: unknown): GusFeedbackValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const interactionId = typeof body.interactionId === "string" ? body.interactionId.trim() : "";

  if (!UUID_PATTERN.test(interactionId)) {
    errors.push("interactionId must be a UUID.");
  }

  if (!isBoolean(body.helpful)) {
    errors.push("helpful must be true or false.");
  }

  for (const key of ["clicked", "dismissed", "audioReplayed", "mutedAfterMessage"] as const) {
    if (!optionalBoolean(body[key])) {
      errors.push(`${key} must be a boolean when provided.`);
    }
  }

  if (body.feedbackText != null && typeof body.feedbackText !== "string") {
    errors.push("feedbackText must be a string when provided.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    feedback: {
      interactionId,
      helpful: body.helpful as boolean,
      clicked: body.clicked === true,
      dismissed: body.dismissed === true,
      audioReplayed: body.audioReplayed === true,
      mutedAfterMessage: body.mutedAfterMessage === true,
      feedbackText:
        typeof body.feedbackText === "string" ? body.feedbackText.trim().slice(0, 1000) : undefined,
    },
  };
}

export function scoreGusFeedback(feedback: GusFeedbackInput) {
  let score = feedback.helpful ? gusFeedbackWeights.helpful : gusFeedbackWeights.notHelpful;

  if (feedback.clicked) score += gusFeedbackWeights.clicked;
  if (feedback.audioReplayed) score += gusFeedbackWeights.audioReplayed;
  if (feedback.dismissed) score += gusFeedbackWeights.dismissed;
  if (feedback.mutedAfterMessage) score += gusFeedbackWeights.mutedAfterMessage;

  return roundScore(score);
}

export function applyGusFeedbackScore(currentScore: number, feedback: GusFeedbackInput) {
  return clampGusLearningScore(currentScore + scoreGusFeedback(feedback));
}

