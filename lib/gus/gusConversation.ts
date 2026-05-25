import { runStructuredAiJsonTask, type AiExecutionMeta } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import {
  buildGusAiRuleRedirect,
  isGusAiForbiddenRequest,
} from "@/lib/gus/gusAi";
import {
  buildGusAiUserPrompt,
  GUS_AI_OUTPUT_SCHEMA_VERSION,
  GUS_AI_PROMPT_VERSION,
  GUS_PERSONALITY_PROFILE,
} from "@/lib/gus/gusPromptBuilder";
import { validateGusOutput, type GusValidationFinding } from "@/lib/gus/gusValidation";
import {
  buildAiActionDecisionTriggers,
  type AiActionDecisionTrigger,
} from "@/lib/aiActionDecisionTriggers";
import type {
  GusConversationRequest,
  GusConversationResponse,
  GusConversationTurn,
  GusSafetyPreferenceMemory,
} from "@/lib/gus/gusTypes";

export type GusConversationResult = {
  response: GusConversationResponse;
  validationFindings: GusValidationFinding[];
  meta: AiExecutionMeta | null;
  blockedByRules: boolean;
  rawText: string | null;
  actionDecisionTriggers: AiActionDecisionTrigger[];
};

const GUS_CONVERSATION_FALLBACK_MODEL = "gpt-4o-mini";
const MAX_HISTORY_TURNS = 8;

export const GUS_CONVERSATION_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "gus_conversation_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      tone: { type: "string", enum: ["calm_mentor"] },
      suggestedActions: {
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
      safetyPreferences: {
        type: "object",
        additionalProperties: false,
        properties: {
          preferredDetailLevel: { type: "string", enum: ["concise", "balanced", "step_by_step"] },
          usefulTopics: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
          repeatedThemes: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
          updatedAt: { type: "string" },
        },
        required: ["preferredDetailLevel", "usefulTopics", "repeatedThemes", "updatedAt"],
      },
      draftOnly: { type: "boolean" },
      humanReviewRequired: { type: "boolean" },
    },
    required: [
      "answer",
      "tone",
      "suggestedActions",
      "missingInformation",
      "riskFlags",
      "recommendedControls",
      "safetyPreferences",
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

function defaultPreferences(): GusSafetyPreferenceMemory {
  return {
    preferredDetailLevel: "balanced",
    usefulTopics: [],
    repeatedThemes: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizePreferences(value: unknown, fallback: GusSafetyPreferenceMemory): GusSafetyPreferenceMemory {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const preferredDetailLevel =
    record.preferredDetailLevel === "concise" ||
    record.preferredDetailLevel === "balanced" ||
    record.preferredDetailLevel === "step_by_step"
      ? record.preferredDetailLevel
      : fallback.preferredDetailLevel;

  return {
    preferredDetailLevel,
    usefulTopics: stringArray(record.usefulTopics, 8),
    repeatedThemes: stringArray(record.repeatedThemes, 8),
    updatedAt: cleanText(record.updatedAt, 80) || new Date().toISOString(),
  };
}

function mergePreferences(
  base: GusSafetyPreferenceMemory,
  detected: Partial<GusSafetyPreferenceMemory>,
): GusSafetyPreferenceMemory {
  return {
    preferredDetailLevel: detected.preferredDetailLevel ?? base.preferredDetailLevel,
    usefulTopics: [...new Set([...base.usefulTopics, ...(detected.usefulTopics ?? [])])].slice(0, 8),
    repeatedThemes: [...new Set([...base.repeatedThemes, ...(detected.repeatedThemes ?? [])])].slice(0, 8),
    updatedAt: new Date().toISOString(),
  };
}

export function inferGusSafetyPreferences(message: string): Partial<GusSafetyPreferenceMemory> {
  const lower = message.toLowerCase();
  const usefulTopics: string[] = [];
  const repeatedThemes: string[] = [];
  let preferredDetailLevel: GusSafetyPreferenceMemory["preferredDetailLevel"] | undefined;

  if (/\b(brief|short|quick|concise)\b/.test(lower)) preferredDetailLevel = "concise";
  if (/\b(step by step|walk me through|detailed|more detail)\b/.test(lower)) preferredDetailLevel = "step_by_step";

  for (const [pattern, topic] of [
    [/\bpermit|hot work|confined space\b/, "permit review"],
    [/\btraining|certification|qualified\b/, "training readiness"],
    [/\bjsa|job safety analysis|pre-task\b/, "JSA and pre-task planning"],
    [/\brisk|forecast|driver\b/, "risk drivers"],
    [/\bloto|lockout|stored energy\b/, "LOTO / stored energy"],
    [/\btrench|excavat/, "trenching / excavation"],
  ] as const) {
    if (pattern.test(lower)) usefulTopics.push(topic);
  }

  if (/\brepeated|keeps happening|trend|again\b/.test(lower)) {
    repeatedThemes.push(cleanText(message, 140));
  }

  return { preferredDetailLevel, usefulTopics, repeatedThemes };
}

export function parseGusConversationRequest(input: unknown):
  | { ok: true; request: GusConversationRequest }
  | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const body = input as Record<string, unknown>;
  const message = cleanText(body.message, 2_000);
  const errors: string[] = [];
  if (!message) errors.push("message is required.");

  const history: GusConversationTurn[] = Array.isArray(body.history)
    ? body.history
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
        .slice(-MAX_HISTORY_TURNS)
    : [];

  return errors.length
    ? { ok: false, errors }
    : {
        ok: true,
        request: {
          message,
          history,
          context: body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {},
          decision: body.decision && typeof body.decision === "object" && !Array.isArray(body.decision) ? body.decision : {},
          safetyPreferences:
            body.safetyPreferences && typeof body.safetyPreferences === "object" && !Array.isArray(body.safetyPreferences)
              ? body.safetyPreferences
              : {},
        },
      };
}

function fallbackResponse(
  request: GusConversationRequest,
  preferences: GusSafetyPreferenceMemory,
): GusConversationResponse {
  const lower = request.message.toLowerCase();
  const asksForOsha = /\bosha|regulation|citation|standard\b/i.test(lower);
  const asksLegal = /\blegal|liability|lawsuit|attorney\b/i.test(lower);
  const answer = asksLegal
    ? "I cannot give legal advice. I can help you frame the safety questions, missing information, and reviewer steps for a qualified human to check."
    : asksForOsha
      ? "I should not invent OSHA requirements or citations. If you have a verified company rule or platform reference, I can help interpret it in draft planning language."
      : "I can help think this through. Tell me the task, work area, crew/trade, equipment or energy involved, and what feels uncertain, and I will help turn it into draft review points.";

  return {
    answer,
    tone: "calm_mentor",
    suggestedActions: ["Gather missing task details", "Route draft guidance for human review"],
    missingInformation: asksForOsha
      ? ["Verified platform, company, or regulatory reference to use."]
      : ["Task, work area, crew/trade, equipment or energy involved, and existing controls."],
    riskFlags: ["Human review remains required before work starts."],
    recommendedControls: [
      "Keep recommendations in draft form until reviewed.",
      "Verify controls against the actual field condition before work proceeds.",
    ],
    safetyPreferences: preferences,
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function normalizeResponse(value: unknown, fallback: GusConversationResponse): GusConversationResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;

  return {
    answer: cleanText(record.answer, 900) || fallback.answer,
    tone: "calm_mentor",
    suggestedActions: stringArray(record.suggestedActions, 6).length
      ? stringArray(record.suggestedActions, 6)
      : fallback.suggestedActions,
    missingInformation: stringArray(record.missingInformation, 10).length
      ? stringArray(record.missingInformation, 10)
      : fallback.missingInformation,
    riskFlags: stringArray(record.riskFlags, 10).length ? stringArray(record.riskFlags, 10) : fallback.riskFlags,
    recommendedControls: stringArray(record.recommendedControls, 12).length
      ? stringArray(record.recommendedControls, 12)
      : fallback.recommendedControls,
    safetyPreferences: normalizePreferences(record.safetyPreferences, fallback.safetyPreferences),
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function enforceConversationSafety(output: GusConversationResponse) {
  const validation = validateGusOutput<GusConversationResponse>({
    ...output,
    draftOnly: true,
    humanReviewRequired: true,
  });

  return {
    response: normalizeResponse(validation.sanitizedOutput, output),
    validationFindings: validation.findings,
  };
}

function conversationActionDecisionTriggers(params: {
  request: GusConversationRequest;
  response?: GusConversationResponse;
}) {
  const userTriggers = buildAiActionDecisionTriggers({
    source: "user_message",
    sourceId: "gus-conversation-user-message",
    sourceText: params.request.message,
    targetModule: "gus",
    humanReviewRequired: true,
    limit: 8,
  });
  const responseTriggers = params.response
    ? buildAiActionDecisionTriggers({
        source: "gus_message",
        sourceId: "gus-conversation-response",
        sourceText: [
          params.response.answer,
          ...params.response.suggestedActions,
          ...params.response.recommendedControls,
          ...params.response.riskFlags,
        ],
        targetModule: "gus",
        humanReviewRequired: params.response.humanReviewRequired,
        limit: 8,
      })
    : [];
  return [...userTriggers, ...responseTriggers].slice(0, 12);
}

function isConservativeReferenceRequest(message: string) {
  return /\blegal|liability|lawsuit|attorney|osha|regulation|citation|standard\b/i.test(message);
}

export async function runGusConversation(request: GusConversationRequest): Promise<GusConversationResult> {
  const basePreferences = normalizePreferences(request.safetyPreferences, defaultPreferences());
  const preferences = mergePreferences(basePreferences, inferGusSafetyPreferences(request.message));

  if (isGusAiForbiddenRequest(request.message) || /\b(approve|submit|release|safe\s+to\s+start|compliant)\b/i.test(request.message)) {
    const redirect = buildGusAiRuleRedirect(request.message);
    const safe = enforceConversationSafety({
      answer: redirect.answer,
      tone: "calm_mentor",
      suggestedActions: redirect.recommendedControls,
      missingInformation: redirect.missingInformation,
      riskFlags: redirect.riskFlags,
      recommendedControls: redirect.recommendedControls,
      safetyPreferences: preferences,
      draftOnly: true,
      humanReviewRequired: true,
    });

    return {
      response: safe.response,
      validationFindings: safe.validationFindings,
      meta: null,
      blockedByRules: true,
      rawText: null,
      actionDecisionTriggers: conversationActionDecisionTriggers({ request, response: safe.response }),
    };
  }

  if (isConservativeReferenceRequest(request.message)) {
    const safe = enforceConversationSafety(fallbackResponse(request, preferences));
    return {
      response: safe.response,
      validationFindings: safe.validationFindings,
      meta: null,
      blockedByRules: false,
      rawText: null,
      actionDecisionTriggers: conversationActionDecisionTriggers({ request, response: safe.response }),
    };
  }

  const fallback = fallbackResponse(request, preferences);
  const result = await runStructuredAiJsonTask<GusConversationResponse>({
    modelEnv: process.env.GUS_AI_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: resolveCompanyAiDefaultModel(GUS_CONVERSATION_FALLBACK_MODEL),
    surface: "gus.conversation.reply",
    maxAttempts: 2,
    promptVersion: GUS_AI_PROMPT_VERSION,
    outputSchemaVersion: `${GUS_AI_OUTPUT_SCHEMA_VERSION}.conversation_v1`,
    fallback,
    system: `${GUS_PERSONALITY_PROFILE.boundaries.join(" ")}\n\nYou are Gus in calm mentor mode. Be conversational, attentive, and practical, while keeping safety review and draft-only guidance first.`,
    user: buildGusAiUserPrompt({
      task: "conversation_reply",
      userRequest: request.message,
      currentPage: request.context?.currentPage,
      route: request.context?.route,
      safetyContext: {
        gusContext: request.context,
        currentDecision: request.decision,
      },
      conversationHistory: request.history,
      safetyPreferences: preferences,
    }),
    body: {
      text: {
        format: GUS_CONVERSATION_RESPONSE_FORMAT,
      },
      max_output_tokens: 900,
    },
  });
  const normalized = normalizeResponse(result.parsed, fallback);
  const safe = enforceConversationSafety(normalized);

  return {
    response: safe.response,
    validationFindings: safe.validationFindings,
    meta: result.meta,
    blockedByRules: false,
    rawText: result.text,
    actionDecisionTriggers: conversationActionDecisionTriggers({ request, response: safe.response }),
  };
}
