import { runStructuredAiJsonTask, type AiExecutionMeta } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { buildGusAiRuleRedirect, isGusAiForbiddenRequest } from "@/lib/gus/gusAi";
import {
  buildGusAiUserPrompt,
  GUS_AI_OUTPUT_SCHEMA_VERSION,
  GUS_AI_PROMPT_VERSION,
  GUS_PERSONALITY_PROFILE,
} from "@/lib/gus/gusPromptBuilder";
import { validateGusOutput, type GusValidationFinding } from "@/lib/gus/gusValidation";
import type {
  GusConversationTurn,
  GusThoughtDraftRequest,
  GusThoughtDraftResponse,
} from "@/lib/gus/gusTypes";

export type GusThoughtDraftResult = {
  response: GusThoughtDraftResponse;
  validationFindings: GusValidationFinding[];
  meta: AiExecutionMeta | null;
  blockedByRules: boolean;
  rawText: string | null;
};

const GUS_THOUGHT_DRAFT_FALLBACK_MODEL = "gpt-4o-mini";
const MAX_HISTORY_TURNS = 8;

export const GUS_THOUGHT_DRAFT_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "gus_thought_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clarifiedThought: { type: "string" },
      draftText: { type: "string" },
      talkingPoints: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
      followUpQuestions: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
      missingInformation: {
        type: "array",
        maxItems: 10,
        items: { type: "string" },
      },
      riskFlags: {
        type: "array",
        maxItems: 10,
        items: { type: "string" },
      },
      recommendedControls: {
        type: "array",
        maxItems: 12,
        items: { type: "string" },
      },
      suggestedActions: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
      draftOnly: { type: "boolean" },
      humanReviewRequired: { type: "boolean" },
    },
    required: [
      "clarifiedThought",
      "draftText",
      "talkingPoints",
      "followUpQuestions",
      "missingInformation",
      "riskFlags",
      "recommendedControls",
      "suggestedActions",
      "draftOnly",
      "humanReviewRequired",
    ],
  },
} as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown, maxItems: number, maxLength = 180) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseHistory(value: unknown): GusConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((turn): turn is Record<string, unknown> => Boolean(turn) && typeof turn === "object" && !Array.isArray(turn))
    .map((turn): GusConversationTurn => {
      const role: GusConversationTurn["role"] = turn.role === "assistant" ? "assistant" : "user";
      return {
        id: cleanText(turn.id, 80) || undefined,
        role,
        content: cleanText(turn.content, 1_200),
        createdAt: cleanText(turn.createdAt, 80) || undefined,
      };
    })
    .filter((turn) => turn.content)
    .slice(-MAX_HISTORY_TURNS);
}

export function parseGusThoughtDraftRequest(input: unknown):
  | { ok: true; request: GusThoughtDraftRequest }
  | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const body = input as Record<string, unknown>;
  const message = cleanText(body.message, 2_000);
  const errors: string[] = [];
  if (!message) errors.push("message is required.");

  return errors.length
    ? { ok: false, errors }
    : {
        ok: true,
        request: {
          message,
          history: parseHistory(body.history),
          context: body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {},
          decision: body.decision && typeof body.decision === "object" && !Array.isArray(body.decision) ? body.decision : {},
        },
      };
}

function isConservativeReferenceRequest(message: string) {
  return /\blegal|liability|lawsuit|attorney|osha|regulation|citation|standard\b/i.test(message);
}

function fallbackResponse(request: GusThoughtDraftRequest): GusThoughtDraftResponse {
  const asksForOsha = /\bosha|regulation|citation|standard\b/i.test(request.message);
  const asksLegal = /\blegal|liability|lawsuit|attorney\b/i.test(request.message);
  const missingInformation = asksForOsha
    ? ["Verified platform, company, or regulatory reference to use."]
    : ["Task, work area, crew/trade, equipment or energy involved, and existing controls."];
  const clarifiedThought = asksLegal
    ? "The user needs safety-focused wording without legal advice."
    : asksForOsha
      ? "The user needs draft safety wording that does not invent regulatory citations."
      : cleanText(request.message, 220) || "The user needs help turning a rough safety thought into draft wording.";
  const draftText = asksLegal
    ? "Draft note: I cannot provide legal advice. Please route the safety concern, known facts, missing information, and recommended reviewer steps to the appropriate human reviewer."
    : asksForOsha
      ? "Draft note: I do not have a verified regulatory reference for this point. Please attach the approved company, platform, or regulatory source before using citation language."
      : `Draft note: ${clarifiedThought} This should remain draft guidance until the supervisor or required safety reviewer verifies the field conditions and controls.`;

  return {
    clarifiedThought,
    draftText,
    talkingPoints: [
      "This is draft guidance for review.",
      "Confirm the task, location, crew, hazards, and existing controls before work proceeds.",
    ],
    followUpQuestions: ["What task and work area does this apply to?", "Which hazards, equipment, or energy sources are involved?"],
    missingInformation,
    riskFlags: ["Human review remains required before work starts."],
    recommendedControls: [
      "Keep recommendations in draft form until reviewed.",
      "Verify controls against the actual field condition before work proceeds.",
    ],
    suggestedActions: ["Gather missing task details", "Route the draft wording for human review"],
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function redirectResponse(request: GusThoughtDraftRequest): GusThoughtDraftResponse {
  const redirect = buildGusAiRuleRedirect(request.message);
  return {
    clarifiedThought: "The request needs to stay in draft review language, not approval or release language.",
    draftText: redirect.answer,
    talkingPoints: redirect.recommendedControls.slice(0, 4),
    followUpQuestions: redirect.missingInformation.map((item) => `Can you provide ${item.toLowerCase()}`),
    missingInformation: redirect.missingInformation,
    riskFlags: redirect.riskFlags,
    recommendedControls: redirect.recommendedControls,
    suggestedActions: ["Keep the item in draft", "Send it to the required human reviewer"],
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function normalizeResponse(value: unknown, fallback: GusThoughtDraftResponse): GusThoughtDraftResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const clarifiedThought = cleanText(record.clarifiedThought, 500) || fallback.clarifiedThought;
  const draftText = cleanText(record.draftText, 1_200) || fallback.draftText;
  const talkingPoints = stringArray(record.talkingPoints, 6).length
    ? stringArray(record.talkingPoints, 6)
    : fallback.talkingPoints;

  return {
    clarifiedThought,
    draftText,
    talkingPoints,
    followUpQuestions: stringArray(record.followUpQuestions, 6).length
      ? stringArray(record.followUpQuestions, 6)
      : fallback.followUpQuestions,
    missingInformation: stringArray(record.missingInformation, 10).length
      ? stringArray(record.missingInformation, 10)
      : fallback.missingInformation,
    riskFlags: stringArray(record.riskFlags, 10).length ? stringArray(record.riskFlags, 10) : fallback.riskFlags,
    recommendedControls: stringArray(record.recommendedControls, 12).length
      ? stringArray(record.recommendedControls, 12)
      : fallback.recommendedControls,
    suggestedActions: stringArray(record.suggestedActions, 6).length
      ? stringArray(record.suggestedActions, 6)
      : fallback.suggestedActions,
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function enforceThoughtDraftSafety(output: GusThoughtDraftResponse) {
  const validation = validateGusOutput<GusThoughtDraftResponse>({
    ...output,
    draftOnly: true,
    humanReviewRequired: true,
  });

  return {
    response: normalizeResponse(validation.sanitizedOutput, output),
    validationFindings: validation.findings,
  };
}

export async function runGusThoughtDraft(request: GusThoughtDraftRequest): Promise<GusThoughtDraftResult> {
  if (isGusAiForbiddenRequest(request.message) || /\b(approve|submit|release|safe\s+to\s+start|compliant)\b/i.test(request.message)) {
    const safe = enforceThoughtDraftSafety(redirectResponse(request));
    return {
      response: safe.response,
      validationFindings: safe.validationFindings,
      meta: null,
      blockedByRules: true,
      rawText: null,
    };
  }

  const fallback = fallbackResponse(request);
  if (isConservativeReferenceRequest(request.message)) {
    const safe = enforceThoughtDraftSafety(fallback);
    return {
      response: safe.response,
      validationFindings: safe.validationFindings,
      meta: null,
      blockedByRules: false,
      rawText: null,
    };
  }

  const result = await runStructuredAiJsonTask<GusThoughtDraftResponse>({
    modelEnv: process.env.GUS_AI_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: resolveCompanyAiDefaultModel(GUS_THOUGHT_DRAFT_FALLBACK_MODEL),
    surface: "gus.thought_draft.formulate",
    maxAttempts: 2,
    promptVersion: GUS_AI_PROMPT_VERSION,
    outputSchemaVersion: `${GUS_AI_OUTPUT_SCHEMA_VERSION}.thought_draft_v1`,
    fallback,
    system: `${GUS_PERSONALITY_PROFILE.boundaries.join(" ")}\n\nYou are Gus in thought formulation mode. Turn rough safety thoughts into clear draft wording, concise talking points, and follow-up questions. Stay practical, conservative, and human-review-first.`,
    user: buildGusAiUserPrompt({
      task: "formulate_thought",
      userRequest: request.message,
      currentPage: request.context?.currentPage,
      route: request.context?.route,
      safetyContext: {
        gusContext: request.context,
        currentDecision: request.decision,
      },
      conversationHistory: request.history,
    }),
    body: {
      text: {
        format: GUS_THOUGHT_DRAFT_RESPONSE_FORMAT,
      },
      max_output_tokens: 1_000,
    },
  });
  const normalized = normalizeResponse(result.parsed, fallback);
  const safe = enforceThoughtDraftSafety(normalized);

  return {
    response: safe.response,
    validationFindings: safe.validationFindings,
    meta: result.meta,
    blockedByRules: false,
    rawText: result.text,
  };
}
