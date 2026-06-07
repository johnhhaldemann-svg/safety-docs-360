export type RcaMethod = "five_whys" | "fishbone" | "fault_tree" | "combined";
export type RcaStepKey =
  | "problem_statement"
  | "immediate_cause"
  | "contributing_factors"
  | "five_whys"
  | "fishbone"
  | "systemic_factors"
  | "capa"
  | "review";

export type RcaMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  step_key?: string | null;
};

const CATEGORY_TO_METHOD: Record<string, RcaMethod> = {
  hazard: "five_whys",
  near_miss: "five_whys",
  incident: "five_whys",
  equipment_issue: "fault_tree",
  electrical_hazard: "fault_tree",
  fall_hazard: "five_whys",
  ppe_violation: "five_whys",
  housekeeping: "five_whys",
  excavation_trench_concern: "fishbone",
  fire_hot_work_concern: "fishbone",
  corrective_action: "five_whys",
  good_catch: "five_whys",
};

export function selectRcaMethod(category: string, severity: string): RcaMethod {
  if (severity === "critical") return "combined";
  return CATEGORY_TO_METHOD[category] ?? "five_whys";
}

const METHOD_LABELS: Record<RcaMethod, string> = {
  five_whys: "5 Whys",
  fishbone: "Fishbone (Ishikawa)",
  fault_tree: "Fault Tree Analysis",
  combined: "5 Whys + Fishbone",
};

const STEP_LABELS: Record<RcaStepKey, string> = {
  problem_statement: "Problem Statement",
  immediate_cause: "Immediate Cause",
  contributing_factors: "Contributing Factors",
  five_whys: "5 Whys Analysis",
  fishbone: "Fishbone Analysis",
  systemic_factors: "Systemic Factors",
  capa: "Corrective & Preventive Actions",
  review: "Review & Confirm",
};

export function getStepLabel(step: RcaStepKey): string {
  return STEP_LABELS[step] ?? step;
}

export function getMethodLabel(method: RcaMethod): string {
  return METHOD_LABELS[method] ?? method;
}

export function getStepsForMethod(method: RcaMethod): RcaStepKey[] {
  const base: RcaStepKey[] = ["problem_statement", "immediate_cause", "contributing_factors"];
  if (method === "five_whys" || method === "combined") base.push("five_whys");
  if (method === "fishbone" || method === "combined") base.push("fishbone");
  if (method === "fault_tree") base.push("five_whys");
  base.push("systemic_factors", "capa", "review");
  return base;
}

export function nextStep(current: RcaStepKey, method: RcaMethod): RcaStepKey | null {
  const steps = getStepsForMethod(method);
  const idx = steps.indexOf(current);
  return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
}

export type RcaAiResponse = {
  message: string;
  suggestions: string[];
};

export function parseRcaAiResponse(text: string): RcaAiResponse {
  try {
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(stripped);
    if (!parsed || typeof parsed !== "object") throw new Error("not object");
    const message = typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : "";
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s: string) => s.trim())
          .slice(0, 5)
      : [];
    if (!message) throw new Error("no message");
    return { message, suggestions };
  } catch {
    // Fallback: treat entire response as plain message with no suggestions
    return { message: text.trim(), suggestions: [] };
  }
}

export function buildSystemPrompt(params: {
  caTitle: string;
  caDescription: string | null;
  caCategory: string;
  caSeverity: string;
  method: RcaMethod;
  companyName?: string | null;
}): string {
  const { caTitle, caDescription, caCategory, caSeverity, method, companyName } = params;
  return [
    "You are a certified safety professional facilitating a structured Root Cause Analysis (RCA).",
    `You are helping ${companyName ? `the ${companyName} safety team` : "a safety team"} investigate a corrective action.`,
    "",
    "Corrective Action Details:",
    `  Title: ${caTitle}`,
    caDescription ? `  Description: ${caDescription}` : null,
    `  Category: ${caCategory.replace(/_/g, " ")}`,
    `  Severity: ${caSeverity}`,
    `  RCA Method: ${getMethodLabel(method)}`,
    "",
    "RESPONSE FORMAT — you MUST always respond with valid JSON only, no prose outside JSON:",
    '{"message": "<your question or acknowledgment>", "suggestions": ["<option 1>", "<option 2>", "<option 3>"]}',
    "",
    "Suggestions rules:",
    "- Provide 3 to 4 short, specific, selectable options relevant to this investigation step and the corrective action details above.",
    "- Each suggestion should be a plausible answer a field worker might give — not generic filler.",
    "- Tailor suggestions to the category and severity (e.g. for a fall_hazard suggest fall-related causes).",
    "- Always include one open-ended option like 'Other — I'll describe it below' as the last suggestion.",
    "- At the review and approved steps, suggestions can be confirmation choices like 'Yes, this is accurate' or 'I need to make a correction'.",
    "",
    "Facilitation rules:",
    "- Ask one focused question per message — do not overwhelm the user.",
    "- If an answer is vague or contradicts earlier answers, gently ask a follow-up before moving on.",
    "- Do not invent facts, regulations, or root causes. Work only from what the user tells you.",
    "- When moving between steps, briefly acknowledge the user's answer and explain what you are doing next.",
    "- Keep the message clear and professional. Avoid jargon the user hasn't used first.",
    "- At the capa step, suggest corrective actions based on the root causes identified together.",
    "- At the review step, summarise all findings concisely and ask the user to confirm before closing.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildStepPrompt(step: RcaStepKey, method: RcaMethod): string {
  const prompts: Record<RcaStepKey, string> = {
    problem_statement:
      "Let's start by making sure we have a clear problem statement. In your own words, what happened? Please describe the event, where it occurred, and who or what was affected.",
    immediate_cause:
      "What directly caused this to happen? This is the most visible cause — the thing that, if changed, would have prevented the immediate event.",
    contributing_factors:
      "Were there any contributing factors? Consider: the condition of equipment involved, the environment or weather, the procedures in place (or absence of them), and the supervision or training of people involved.",
    five_whys:
      "Now let's apply the 5 Whys to find the root cause. I'll ask \"why\" repeatedly until we reach the underlying reason this happened. Starting with the immediate cause you described — why did that happen?",
    fishbone:
      "Let's use the Fishbone method to explore categories of causes. I'll guide you through each: People, Equipment, Process, Environment, Management, and Materials. Starting with People — were there any human factors involved (skill gap, fatigue, distraction, procedure not followed)?",
    systemic_factors:
      "Are there any systemic or organisational factors that contributed? For example: training program gaps, supervision frequency, policy clarity, resource constraints, or similar incidents happening before?",
    capa:
      "Based on what we've found, let's define corrective and preventive actions. For each root cause we identified, what specific action will prevent this from happening again? Describe the action, who should own it, and how urgently it should be completed.",
    review:
      "Let's review everything we've found before closing the RCA. I'll summarise the key findings now. Please confirm if this accurately captures the investigation, or let me know what to adjust.",
  };
  const extra: Partial<Record<RcaMethod, Partial<Record<RcaStepKey, string>>>> = {
    fault_tree: {
      five_whys:
        "Let's build a fault tree. Starting from the top event (the incident), we'll work downward through the conditions that allowed it to happen. What conditions or failures had to occur simultaneously for this event to take place?",
    },
  };
  return extra[method]?.[step] ?? prompts[step];
}

export function buildOpeningMessage(params: {
  caTitle: string;
  caCategory: string;
  caSeverity: string;
  method: RcaMethod;
}): string {
  const { caTitle, caCategory, caSeverity, method } = params;
  return [
    `I'll be guiding you through a Root Cause Analysis for: **${caTitle}**.`,
    "",
    `Category: ${caCategory.replace(/_/g, " ")} · Severity: ${caSeverity} · Method: ${getMethodLabel(method)}`,
    "",
    buildStepPrompt("problem_statement", method),
  ].join("\n");
}

export function buildChatMessages(
  history: RcaMessage[],
  systemPrompt: string
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const msg of history) {
    messages.push({ role: msg.role === "system" ? "assistant" : msg.role, content: msg.content });
  }
  return messages;
}

export type RcaFindingRow = {
  finding_type: "immediate_cause" | "contributing_factor" | "root_cause" | "systemic_factor";
  category: string | null;
  description: string;
  why_level: number | null;
  sort_order: number;
};

export function buildFindingsExtractionPrompt(transcript: string): string {
  return [
    "You are a certified safety professional reviewing a completed Root Cause Analysis investigation.",
    "Extract and categorise the key findings from the transcript below.",
    "Return ONLY a valid JSON array — no prose, no markdown fences.",
    "",
    "Each object must have these exact keys:",
    '  finding_type: "immediate_cause" | "contributing_factor" | "root_cause" | "systemic_factor"',
    "  description: a clear, concise sentence describing the finding (max 300 chars)",
    "  category: optional sub-category string (e.g. 'equipment', 'human_factors', 'procedure') or null",
    "  why_level: for root_cause findings reached via 5 Whys, the why number (1-5); otherwise null",
    "  sort_order: integer starting at 1, ordering findings from immediate to systemic",
    "",
    "Rules:",
    "- Include at least one finding if there is any investigation content.",
    "- Do not invent findings that are not supported by the transcript.",
    "- Root cause is the deepest underlying reason — not the immediate cause.",
    "- Keep descriptions factual and professional.",
    "",
    "Investigation transcript:",
    transcript || "(No investigation responses recorded.)",
  ].join("\n");
}

export function parseRcaFindings(text: string): RcaFindingRow[] {
  try {
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(stripped);
    if (!Array.isArray(parsed)) return [];
    const VALID_TYPES = new Set(["immediate_cause", "contributing_factor", "root_cause", "systemic_factor"]);
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          item &&
          typeof item === "object" &&
          typeof item.description === "string" &&
          item.description.trim().length > 0 &&
          VALID_TYPES.has(item.finding_type as string)
      )
      .map((item, idx) => ({
        finding_type: item.finding_type as RcaFindingRow["finding_type"],
        description: String(item.description).trim().slice(0, 300),
        category: typeof item.category === "string" && item.category.trim() ? item.category.trim().slice(0, 80) : null,
        why_level:
          typeof item.why_level === "number" && item.why_level >= 1 && item.why_level <= 5
            ? item.why_level
            : null,
        sort_order: typeof item.sort_order === "number" ? item.sort_order : idx + 1,
      }));
  } catch {
    return [];
  }
}

export function parseCapaSuggestions(text: string): Array<{
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
}> {
  try {
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(stripped);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { title: string; description: string; priority: string } =>
          item && typeof item.title === "string" && item.title.trim().length > 0
      )
      .map((item) => ({
        title: item.title.trim().slice(0, 160),
        description: typeof item.description === "string" ? item.description.trim().slice(0, 800) : "",
        priority: (["low", "medium", "high", "critical"] as const).includes(
          item.priority as "low" | "medium" | "high" | "critical"
        )
          ? (item.priority as "low" | "medium" | "high" | "critical")
          : "medium",
      }));
  } catch {
    return [];
  }
}
