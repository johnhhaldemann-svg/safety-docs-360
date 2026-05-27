import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { requestAiResponsesText, type AiExecutionMeta } from "@/lib/ai/responses";
import {
  buildGusAiUserPrompt,
  GUS_AI_OUTPUT_SCHEMA_VERSION,
  GUS_AI_PROMPT_VERSION,
  GUS_PERSONALITY_PROFILE,
} from "@/lib/gus/gusPromptBuilder";
import { sanitizeGusTriggerLanguage } from "@/lib/gus/gusSafetyGate";
import { validateGusOutput, type GusValidationFinding } from "@/lib/gus/gusValidation";
import type {
  GusConversationTurn,
  GusDecision,
  GusPhotoReviewOutput,
  GusPhotoReviewRiskLevel,
  GusSafetyPreferenceMemory,
} from "@/lib/gus/gusTypes";
import type { GusContext } from "@/lib/gus/gusContext";

const GUS_PHOTO_REVIEW_FALLBACK_MODEL = "gpt-4o-mini";

export type GusPhotoReviewRequest = {
  dataUrl: string;
  fileName?: string | null;
  message?: string | null;
  context?: Partial<GusContext>;
  decision?: Partial<GusDecision>;
  history?: GusConversationTurn[];
  safetyPreferences?: Partial<GusSafetyPreferenceMemory>;
};

export type GusPhotoReviewResult = {
  output: GusPhotoReviewOutput | null;
  validationFindings: GusValidationFinding[];
  meta: AiExecutionMeta;
  rawText: string | null;
  error: string | null;
};

export const GUS_PHOTO_REVIEW_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "gus_photo_review",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      riskLevel: { type: "string", enum: ["low", "moderate", "high", "critical", "unknown"] },
      whatLooksRight: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      concerns: {
        type: "array",
        maxItems: 10,
        items: { type: "string" },
      },
      criticalFlags: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      missingInformation: {
        type: "array",
        maxItems: 10,
        items: { type: "string" },
      },
      recommendedControls: {
        type: "array",
        maxItems: 12,
        items: { type: "string" },
      },
      nextActions: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      limitations: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      confidence: { type: "number" },
      draftOnly: { type: "boolean" },
      humanReviewRequired: { type: "boolean" },
    },
    required: [
      "answer",
      "riskLevel",
      "whatLooksRight",
      "concerns",
      "criticalFlags",
      "missingInformation",
      "recommendedControls",
      "nextActions",
      "limitations",
      "confidence",
      "draftOnly",
      "humanReviewRequired",
    ],
  },
} as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown, maxItems: number, maxLength = 220) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => cleanText(item, maxLength))
    .map(sanitizeGusTriggerLanguage)
    .filter(Boolean)
    .slice(0, maxItems);
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeRiskLevel(value: unknown): GusPhotoReviewRiskLevel {
  if (value === "low" || value === "moderate" || value === "high" || value === "critical" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function fallbackOutput(message?: string | null): GusPhotoReviewOutput {
  return {
    answer:
      cleanText(message, 280) ||
      "I can review the photo as draft guidance, but a human safety reviewer must verify the actual jobsite conditions.",
    riskLevel: "unknown",
    whatLooksRight: [],
    concerns: [],
    criticalFlags: [],
    missingInformation: ["Actual task, work area, crew exposure, and controls cannot be fully verified from the photo alone."],
    recommendedControls: ["Have a qualified human reviewer verify visible conditions and missing controls before work proceeds."],
    nextActions: ["Share the photo and context with the assigned human reviewer."],
    limitations: ["Photo review is limited to visible conditions and cannot prove compliance or release work."],
    confidence: 0,
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function normalizePhotoReview(value: unknown, fallback: GusPhotoReviewOutput): GusPhotoReviewOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const riskLevel = normalizeRiskLevel(record.riskLevel);
  const criticalFlags = stringArray(record.criticalFlags, 8);
  const nextActions = stringArray(record.nextActions, 8);

  return {
    answer: sanitizeGusTriggerLanguage(cleanText(record.answer, 900) || fallback.answer),
    riskLevel,
    whatLooksRight: stringArray(record.whatLooksRight, 8).length
      ? stringArray(record.whatLooksRight, 8)
      : fallback.whatLooksRight.map(sanitizeGusTriggerLanguage),
    concerns: stringArray(record.concerns, 10).length
      ? stringArray(record.concerns, 10)
      : fallback.concerns.map(sanitizeGusTriggerLanguage),
    criticalFlags,
    missingInformation: stringArray(record.missingInformation, 10).length
      ? stringArray(record.missingInformation, 10)
      : fallback.missingInformation.map(sanitizeGusTriggerLanguage),
    recommendedControls: stringArray(record.recommendedControls, 12).length
      ? stringArray(record.recommendedControls, 12)
      : fallback.recommendedControls.map(sanitizeGusTriggerLanguage),
    nextActions:
      riskLevel === "critical" && nextActions.length === 0
        ? ["Do not continue until immediate human safety check is complete."]
        : nextActions.length > 0
          ? nextActions
          : fallback.nextActions.map(sanitizeGusTriggerLanguage),
    limitations: stringArray(record.limitations, 8).length
      ? stringArray(record.limitations, 8)
      : fallback.limitations.map(sanitizeGusTriggerLanguage),
    confidence: normalizeConfidence(record.confidence),
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function enforcePhotoReviewSafety(output: GusPhotoReviewOutput) {
  const validation = validateGusOutput<GusPhotoReviewOutput>({
    ...output,
    draftOnly: true,
    humanReviewRequired: true,
  });
  const normalized = normalizePhotoReview(validation.sanitizedOutput, output);

  return {
    output: {
      ...normalized,
      answer: sanitizeGusTriggerLanguage(normalized.answer),
      whatLooksRight: normalized.whatLooksRight.map(sanitizeGusTriggerLanguage),
      concerns: normalized.concerns.map(sanitizeGusTriggerLanguage),
      criticalFlags: normalized.criticalFlags.map(sanitizeGusTriggerLanguage),
      missingInformation: normalized.missingInformation.map(sanitizeGusTriggerLanguage),
      recommendedControls: normalized.recommendedControls.map(sanitizeGusTriggerLanguage),
      nextActions: normalized.nextActions.map(sanitizeGusTriggerLanguage),
      limitations: normalized.limitations.map(sanitizeGusTriggerLanguage),
    },
    validationFindings: validation.findings,
  };
}

export function parseGusPhotoReview(text: string, fallback: GusPhotoReviewOutput = fallbackOutput()): GusPhotoReviewOutput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return null;
  }

  return enforcePhotoReviewSafety(normalizePhotoReview(parsed, fallback)).output;
}

function buildPhotoReviewInstructions(request: GusPhotoReviewRequest) {
  return [
    `${GUS_PERSONALITY_PROFILE.boundaries.join(" ")} You are Gus in calm mentor mode checking a jobsite hazard photo.`,
    "Analyze only visible jobsite conditions and the provided context. Do not infer identities, health status, personal attributes, or who is at fault.",
    "Focus on positive visible safety indicators, concerns needing attention, missing critical controls, PPE, access/egress, housekeeping, work-at-height, excavation/trenching, electrical/LOTO, struck-by/caught-between, suspended loads, mobile equipment, fire/hot work, environmental exposure, barricades, signage, and public interface risks.",
    "Treat whatLooksRight as positive visible indicators only. Do not call them compliant, approved, complete, or safe to start.",
    "If critical or imminent-danger conditions are visible or plausible, set riskLevel to critical and recommend immediate human safety check and possible do-not-continue evaluation.",
    "Return JSON only. Keep draftOnly and humanReviewRequired true.",
    `File: ${cleanText(request.fileName, 160) || "uploaded jobsite photo"}`,
    `User note: ${cleanText(request.message, 800) || "Check this jobsite photo for visible safety concerns."}`,
    buildGusAiUserPrompt({
      task: "conversation_reply",
      userRequest: request.message || "Check this jobsite photo for visible jobsite safety hazards.",
      currentPage: request.context?.currentPage,
      route: request.context?.route,
      safetyContext: {
        gusContext: request.context,
        currentDecision: request.decision,
      },
      conversationHistory: request.history,
      safetyPreferences: request.safetyPreferences,
    }),
  ].join("\n\n");
}

export async function runGusPhotoReview(request: GusPhotoReviewRequest): Promise<GusPhotoReviewResult> {
  const fallback = fallbackOutput("I could not complete the photo check. Keep this as draft guidance and have a safety lead field-check the jobsite conditions.");
  const model =
    process.env.GUS_PHOTO_REVIEW_MODEL?.trim() ||
    process.env.GUS_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel(GUS_PHOTO_REVIEW_FALLBACK_MODEL);

  const response = await requestAiResponsesText({
    model,
    accessFallbackModel: GUS_PHOTO_REVIEW_FALLBACK_MODEL,
    surface: "gus.photo-review",
    maxAttempts: 2,
    promptVersion: GUS_AI_PROMPT_VERSION,
    outputSchemaVersion: `${GUS_AI_OUTPUT_SCHEMA_VERSION}.photo_review_v1`,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPhotoReviewInstructions(request),
          },
          {
            type: "input_image",
            image_url: request.dataUrl,
            detail: "high",
          },
        ],
      },
    ],
    body: {
      text: {
        format: GUS_PHOTO_REVIEW_RESPONSE_FORMAT,
      },
      max_output_tokens: 1100,
    },
  });

  if (!response.text) {
    return {
      output: null,
      validationFindings: [],
      meta: response.meta,
      rawText: null,
      error: "Gus could not review this photo. Try a clearer image or add more task context.",
    };
  }

  const parsed = parseGusPhotoReview(response.text, fallback);
  if (!parsed) {
    return {
      output: null,
      validationFindings: [],
      meta: { ...response.meta, fallbackUsed: true, fallbackReason: "invalid_json" },
      rawText: response.text,
      error: "Gus returned an unreadable photo review. Try again with a clearer image.",
    };
  }

  const safe = enforcePhotoReviewSafety(parsed);

  return {
    output: safe.output,
    validationFindings: safe.validationFindings,
    meta: response.meta,
    rawText: response.text,
    error: null,
  };
}
