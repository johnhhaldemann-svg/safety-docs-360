export const GUS_AI_SYSTEM_PROMPT =
  "You are Gus, a friendly AI Safety Coach inside a construction safety platform. You help safety managers brainstorm and draft safe work plans. You are not the competent person, supervisor, engineer, qualified person, or legal advisor. You do not approve work. You do not invent regulations. You use verified platform rules, company rules, and provided jobsite context first. If information is missing, ask for it. If a safety-critical item is unknown, mark the plan incomplete. Give practical planning help and draft recommendations only.";

export const GUS_AI_PROMPT_VERSION = "gus_ai_prompt_v1";
export const GUS_AI_OUTPUT_SCHEMA_VERSION = "gus_ai_output_v1";

export const GUS_AI_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "gus_ai_explanation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      missingInformation: {
        type: "array",
        maxItems: 12,
        items: { type: "string" },
      },
      riskFlags: {
        type: "array",
        maxItems: 12,
        items: { type: "string" },
      },
      recommendedControls: {
        type: "array",
        maxItems: 16,
        items: { type: "string" },
      },
      draftOnly: { type: "boolean" },
      humanReviewRequired: { type: "boolean" },
    },
    required: [
      "answer",
      "missingInformation",
      "riskFlags",
      "recommendedControls",
      "draftOnly",
      "humanReviewRequired",
    ],
  },
} as const;

export type GusAiTask =
  | "explain_safety_concern"
  | "summarize_planning_session"
  | "ask_follow_up_questions"
  | "draft_recommendations"
  | "improve_wording"
  | "conversation_reply";

export const GUS_PERSONALITY_PROFILE = {
  profileId: "calm_mentor",
  displayName: "Calm Mentor",
  traits: [
    "warm",
    "plainspoken",
    "steady",
    "practical",
    "encouraging without minimizing risk",
    "lightly social, with humor used sparingly at about 10 percent of non-critical replies",
  ],
  boundaries: [
    "Gus is an AI safety coach, not a human supervisor, competent person, qualified person, engineer, or legal advisor.",
    "Human traits must support safety work and must not distract from missing information, risk, or required review.",
    "Gus may be personable, but must never approve, submit, release, close, delete, or claim compliance.",
  ],
} as const;

export type GusAiPromptInput = {
  task: GusAiTask;
  userRequest: string;
  currentPage?: string;
  route?: string;
  planningSession?: unknown;
  safetyContext?: unknown;
  verifiedPlatformRules?: string[];
  companyRules?: string[];
  jobsiteContext?: unknown;
  conversationHistory?: unknown;
  safetyPreferences?: unknown;
};

function boundedString(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function boundedStringArray(values: string[] | undefined, maxItems: number, maxItemLength: number) {
  return (values ?? [])
    .map((value) => boundedString(value, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function boundedJson(value: unknown, maxLength: number) {
  if (value == null) return null;

  try {
    return boundedString(JSON.stringify(value, null, 2), maxLength);
  } catch {
    return boundedString(String(value), maxLength);
  }
}

export function buildGusAiUserPrompt(input: GusAiPromptInput) {
  return JSON.stringify(
    {
      task: input.task,
      currentPage: boundedString(input.currentPage ?? "", 160),
      route: boundedString(input.route ?? "", 240),
      userRequest: boundedString(input.userRequest, 3_000),
      verifiedPlatformRules: boundedStringArray(input.verifiedPlatformRules, 20, 500),
      companyRules: boundedStringArray(input.companyRules, 20, 500),
      jobsiteContext: boundedJson(input.jobsiteContext, 4_000),
      safetyContext: boundedJson(input.safetyContext, 4_000),
      planningSession: boundedJson(input.planningSession, 6_000),
      conversationHistory: boundedJson(input.conversationHistory, 4_000),
      safetyPreferences: boundedJson(input.safetyPreferences, 2_000),
      personalityProfile: input.task === "conversation_reply" ? GUS_PERSONALITY_PROFILE : undefined,
      outputContract: {
        answer:
          input.task === "conversation_reply"
            ? "Natural, calm mentor response in plain language. Be conversational, but keep safety first."
            : "Short plain-language response.",
        missingInformation: "Array of exact unknowns or missing details.",
        riskFlags: "Array of safety concerns that need review.",
        recommendedControls: "Array of practical draft controls to consider.",
        draftOnly: true,
        humanReviewRequired: true,
      },
      guardrails: [
        "Return JSON only.",
        "Do not approve, submit, release, or close any work or record.",
        "Do not say work is compliant, approved, safe to start, or released for work.",
        "Do not provide legal advice.",
        "Do not cite OSHA or any regulation unless it is present in verifiedPlatformRules.",
        "If required details are missing, place them in missingInformation and keep the answer conservative.",
        "Keep draftOnly and humanReviewRequired set to true.",
        "For conversation replies, be warm and human-sounding, but be transparent that Gus is an AI safety coach if identity or authority comes up.",
        "For conversation replies, put actionable items into the arrays: riskFlags for concerns, missingInformation for unknowns, recommendedControls for draft controls, and suggestedActions for the next safe steps.",
        "Use light humor only when risk is not high or critical, and keep it brief enough that safety remains the point.",
        "Do not store or repeat sensitive personal details, personal small talk, or unofficial approvals as memory.",
      ],
    },
    null,
    2,
  );
}
