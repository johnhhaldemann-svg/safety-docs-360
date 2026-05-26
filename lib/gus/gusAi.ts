import { runStructuredAiJsonTask, type AiExecutionMeta } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { sanitizeGusTriggerLanguage } from "@/lib/gus/gusSafetyGate";
import { validateGusOutput, type GusValidationFinding } from "@/lib/gus/gusValidation";
import {
  buildGusAiUserPrompt,
  GUS_AI_OUTPUT_SCHEMA_VERSION,
  GUS_AI_PROMPT_VERSION,
  GUS_AI_RESPONSE_FORMAT,
  GUS_AI_SYSTEM_PROMPT,
  type GusAiPromptInput,
} from "@/lib/gus/gusPromptBuilder";

export type GusAiOutput = {
  answer: string;
  missingInformation: string[];
  riskFlags: string[];
  recommendedControls: string[];
  draftOnly: true;
  humanReviewRequired: true;
};

export type GusAiExplanationResult = {
  output: GusAiOutput;
  validationFindings: GusValidationFinding[];
  meta: AiExecutionMeta | null;
  blockedByRules: boolean;
  rawText: string | null;
};

const GUS_AI_FALLBACK_MODEL = "gpt-4o-mini";

const FORBIDDEN_REQUEST_PATTERNS = [
  /\bapprove\b/i,
  /\bsubmit\b.*\b(jsa|permit|record|document)\b/i,
  /\bclose\b.*\bcorrective\s+action\b/i,
  /\bdelete\b.*\brecord\b/i,
  /\breleased?\s+for\s+work\b/i,
  /\bsafe\s+to\s+start\b/i,
  /\bno\s+review\s+needed\b/i,
  /\blegal\s+advice\b/i,
  /\bguarantee\b.*\bcompliance\b/i,
  /\bmake\s+up\b.*\b(osha|regulation|citation)\b/i,
  /\binvent\b.*\b(osha|regulation|citation)\b/i,
] as const;

function stringArray(value: unknown, maxItems = 16) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .map(sanitizeGusTriggerLanguage)
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeAnswer(value: unknown) {
  const text =
    typeof value === "string"
      ? value.replace(/\s+/g, " ").trim()
      : "I can help draft and explain safety planning items, but this needs human review before work starts.";

  return sanitizeGusTriggerLanguage(text.slice(0, 900));
}

export function isGusAiForbiddenRequest(userRequest: string) {
  return FORBIDDEN_REQUEST_PATTERNS.some((pattern) => pattern.test(userRequest));
}

export function buildGusAiRuleRedirect(userRequest: string): GusAiOutput {
  const lower = userRequest.toLowerCase();
  const asksForCitation = /\b(osha|regulation|citation)\b/i.test(lower);
  const asksForLegal = /\blegal\b/i.test(lower);

  return {
    answer: asksForLegal
      ? "I cannot give legal advice. I can help draft safety planning questions and flag items for supervisor, competent person, qualified person, or safety representative review."
      : "I cannot approve work, release work, submit records, or remove human review. I can help draft recommendations and list what a human reviewer should verify before work starts.",
    missingInformation: asksForCitation
      ? ["Verified platform rule, company rule, or approved regulatory reference for the requested citation."]
      : [],
    riskFlags: ["Human review remains required before work starts."],
    recommendedControls: [
      "Keep the item in draft status.",
      "Route the plan or record to the required human reviewer.",
      "Verify missing safety-critical details before work begins.",
    ],
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function normalizeGusAiOutput(value: unknown, fallback: GusAiOutput): GusAiOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;

  return {
    answer: safeAnswer(record.answer) || fallback.answer,
    missingInformation: stringArray(record.missingInformation, 12),
    riskFlags: stringArray(record.riskFlags, 12),
    recommendedControls: stringArray(record.recommendedControls, 16),
    draftOnly: true,
    humanReviewRequired: true,
  };
}

function enforceGusAiSafety(output: GusAiOutput) {
  const validation = validateGusOutput<GusAiOutput>({
    ...output,
    draftOnly: true,
    humanReviewRequired: true,
  });
  const sanitized = normalizeGusAiOutput(validation.sanitizedOutput, output);

  return {
    output: sanitized,
    validationFindings: validation.findings,
  };
}

export async function runGusAiExplanation(input: GusAiPromptInput): Promise<GusAiExplanationResult> {
  if (isGusAiForbiddenRequest(input.userRequest)) {
    const safe = enforceGusAiSafety(buildGusAiRuleRedirect(input.userRequest));
    return {
      output: safe.output,
      validationFindings: safe.validationFindings,
      meta: null,
      blockedByRules: true,
      rawText: null,
    };
  }

  const fallback: GusAiOutput = {
    answer:
      "I can help with a draft explanation, but the available context is limited. A human reviewer must verify the plan before work starts.",
    missingInformation: ["Relevant task details, hazards, controls, and required reviewer confirmation."],
    riskFlags: [],
    recommendedControls: ["Gather missing task details and route the draft for human review."],
    draftOnly: true,
    humanReviewRequired: true,
  };

  const result = await runStructuredAiJsonTask<GusAiOutput>({
    modelEnv: process.env.GUS_AI_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: resolveCompanyAiDefaultModel(GUS_AI_FALLBACK_MODEL),
    surface: "gus.ai.explanation",
    maxAttempts: 2,
    promptVersion: GUS_AI_PROMPT_VERSION,
    outputSchemaVersion: GUS_AI_OUTPUT_SCHEMA_VERSION,
    fallback,
    system: GUS_AI_SYSTEM_PROMPT,
    user: buildGusAiUserPrompt(input),
    body: {
      text: {
        format: GUS_AI_RESPONSE_FORMAT,
      },
      max_output_tokens: 900,
    },
  });

  const normalized = normalizeGusAiOutput(result.parsed, fallback);
  const safe = enforceGusAiSafety(normalized);

  return {
    output: safe.output,
    validationFindings: safe.validationFindings,
    meta: result.meta,
    blockedByRules: false,
    rawText: result.text,
  };
}
