import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";
import { COMPANY_AI_ASSIST_DISCLAIMER, buildSurfaceSystemPrompt } from "@/lib/companyMemory/assist";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";
import { serverLog } from "@/lib/serverLog";

export type PermitCopilotActivityContext = {
  id: string;
  activity_name: string;
  trade: string | null;
  area: string | null;
  permit_type: string | null;
  planned_risk_level: string | null;
  permit_required: boolean | null;
  hazard_category?: string | null;
  hazard_description?: string | null;
  mitigation?: string | null;
  work_date?: string | null;
};

export type PermitCopilotDraftContext = {
  title: string;
  permitType: string;
  severity: string;
  category: string;
  escalationLevel: string;
  escalationReason: string;
  stopWorkStatus: string;
  stopWorkReason: string;
  dueAt: string;
  ownerUserId: string;
  jsaActivityId: string;
  observationId: string;
};

export type PermitCopilotSuggestion = {
  title: string;
  permitType: string;
  severity: string;
  category: string;
  escalationLevel: string;
  escalationReason: string;
  stopWorkStatus: string;
  stopWorkReason: string;
  rationale: string;
  controls: string[];
  missingInfo: string[];
};

type PermitCopilotInput = {
  userMessage: string;
  currentDraft: PermitCopilotDraftContext;
  selectedActivity: PermitCopilotActivityContext | null;
  selectedJobsiteName: string | null;
  structuredContext?: string | null;
  topK?: number;
};

function extractResponsesApiOutputText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();

  const output = o.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemObj = item as Record<string, unknown>;
    const content = itemObj.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") chunks.push(p.text);
    }
  }
  const joined = chunks.join("").trim();
  return joined || null;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const VALUE_ALIASES: Record<string, string> = {
  hotwork: "hot_work",
  "hot-work": "hot_work",
  "hot work": "hot_work",
  hot_work: "hot_work",
  confinedspace: "confined_space",
  "confined-space": "confined_space",
  "confined space": "confined_space",
  confined_space: "confined_space",
  electrical: "electrical",
  excavation: "excavation",
  "work at heights": "work_at_heights",
  workatheights: "work_at_heights",
  work_at_heights: "work_at_heights",
  "lockout tagout": "lockout_tagout",
  lockouttagout: "lockout_tagout",
  lockout_tagout: "lockout_tagout",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
  none: "none",
  monitor: "monitor",
  urgent: "urgent",
  "stop work requested": "stop_work_requested",
  stopworkrequested: "stop_work_requested",
  stop_work_requested: "stop_work_requested",
  "stop work active": "stop_work_active",
  stopworkactive: "stop_work_active",
  stop_work_active: "stop_work_active",
  cleared: "cleared",
  correctiveaction: "corrective_action",
  corrective_action: "corrective_action",
  safety: "safety",
  operations: "operations",
  maintenance: "maintenance",
  environmental: "environmental",
};

function resolveChoice(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const direct = VALUE_ALIASES[normalizeToken(raw)] ?? VALUE_ALIASES[raw.toLowerCase()];
  if (direct) return direct;
  return raw;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function joinWords(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function titleFromActivity(activity: PermitCopilotActivityContext | null) {
  if (!activity) return "Permit";
  return `${activity.activity_name.trim()} permit`;
}

function inferPermitType(activity: PermitCopilotActivityContext | null, currentDraft: PermitCopilotDraftContext) {
  const seed = [
    currentDraft.permitType,
    activity?.permit_type,
    activity?.activity_name,
    activity?.trade,
    activity?.area,
    activity?.hazard_category,
    activity?.hazard_description,
    activity?.mitigation,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  if (seed.match(/hot\s*work|weld|torch|grind|cut/i)) return "hot_work";
  if (seed.match(/confined\s*space|tank|manhole|vault|entry/i)) return "confined_space";
  if (seed.match(/electrical|energized|lockout|tagout|loto|panel|switchgear|temporary power/i)) return "electrical";
  if (seed.match(/excavat|trench|dig|shoring|sloping/i)) return "excavation";
  if (seed.match(/fall|height|roof|ladder|scaffold|mewp|aerial lift/i)) return "work_at_heights";
  if (seed.match(/lockout\s*tagout|lockout|tagout|zero energy/i)) return "lockout_tagout";
  return resolveChoice(activity?.permit_type || currentDraft.permitType || "operations") || "operations";
}

function inferSeverity(activity: PermitCopilotActivityContext | null, permitType: string) {
  const risk = String(activity?.planned_risk_level ?? "").trim().toLowerCase();
  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (permitType === "confined_space" || permitType === "electrical" || permitType === "hot_work") return "high";
  if (permitType === "excavation" || permitType === "work_at_heights" || permitType === "lockout_tagout") return "medium";
  return "medium";
}

function inferCategory(permitType: string, activity: PermitCopilotActivityContext | null) {
  if (activity?.hazard_category) {
    const hazard = activity.hazard_category.toLowerCase();
    if (hazard.includes("electrical")) return "maintenance";
    if (hazard.includes("fall")) return "operations";
    if (hazard.includes("hot work")) return "safety";
  }
  if (permitType === "electrical" || permitType === "lockout_tagout") return "maintenance";
  if (permitType === "hot_work" || permitType === "confined_space") return "safety";
  if (permitType === "excavation" || permitType === "work_at_heights") return "operations";
  return "operations";
}

function inferEscalationLevel(severity: string, activity: PermitCopilotActivityContext | null) {
  if (severity === "critical") return "critical";
  if (severity === "high") return activity?.permit_required === false ? "monitor" : "urgent";
  if (severity === "medium") return activity?.permit_required ? "monitor" : "none";
  return "none";
}

function inferStopWorkStatus(severity: string, permitType: string) {
  if (severity === "critical") return "stop_work_requested";
  if (severity === "high" && (permitType === "confined_space" || permitType === "electrical")) return "stop_work_requested";
  return "normal";
}

function controlSuggestions(permitType: string) {
  switch (permitType) {
    case "hot_work":
      return [
        "Issue the hot work permit before starting.",
        "Remove combustible materials from the area.",
        "Keep charged extinguishers and a fire watch within reach.",
        "Control sparks and verify post-work fire watch.",
      ];
    case "confined_space":
      return [
        "Verify atmospheric testing before entry.",
        "Assign a trained attendant at the entry point.",
        "Confirm rescue equipment and retrieval plan.",
        "Ventilate the space as required by the entry plan.",
      ];
    case "electrical":
      return [
        "De-energize circuits before work when possible.",
        "Verify absence of voltage and apply lockout/tagout.",
        "Barricade the work zone and use qualified workers.",
        "Control temporary power and tool inspection requirements.",
      ];
    case "excavation":
      return [
        "Locate utilities before digging.",
        "Inspect the excavation daily and after rain or changes.",
        "Use sloping, shielding, or shoring as required.",
        "Maintain safe access and egress.",
      ];
    case "work_at_heights":
      return [
        "Verify tie-off, anchor points, or guardrails before access.",
        "Inspect ladders, scaffolds, or lifts before use.",
        "Keep tools and materials controlled to prevent drops.",
        "Plan rescue and access around the elevated work zone.",
      ];
    case "lockout_tagout":
      return [
        "Identify all energy sources before servicing.",
        "Apply lockout/tagout devices and verify zero energy.",
        "Release stored energy before work begins.",
        "Restrict work to authorized employees only.",
      ];
    default:
      return [
        "Confirm the jobsite and work zone before issuing the permit.",
        "Review the JSA controls with the crew before work starts.",
        "Document any escalation or stop-work triggers clearly.",
      ];
  }
}

function missingInfoSuggestions(draft: PermitCopilotDraftContext, activity: PermitCopilotActivityContext | null) {
  const items = [
    draft.dueAt ? null : "Add a due date if the permit should expire or be reviewed later.",
    draft.ownerUserId ? null : "Assign an owner if someone needs to maintain the permit.",
    draft.observationId ? null : "Link an observation if this permit came from a field issue.",
    activity?.permit_required ? null : "Confirm the field controls with the crew before opening work.",
  ];
  return items.filter((item): item is string => Boolean(item));
}

function buildFallbackSuggestion(input: PermitCopilotInput): PermitCopilotSuggestion {
  const activity = input.selectedActivity;
  const current = input.currentDraft;
  const permitType = inferPermitType(activity, current);
  const severity = inferSeverity(activity, permitType);
  const category = inferCategory(permitType, activity);
  const escalationLevel = inferEscalationLevel(severity, activity);
  const stopWorkStatus = inferStopWorkStatus(severity, permitType);
  const title = current.title.trim() || titleFromActivity(activity);
  const escalationReason =
    current.escalationReason.trim() ||
    joinWords(
      activity?.activity_name,
      activity?.trade ? `(${activity.trade})` : null,
      activity?.area ? `in ${activity.area}` : null,
      "needs permit-level oversight."
    );
  const stopWorkReason =
    current.stopWorkReason.trim() ||
    (stopWorkStatus === "stop_work_requested"
      ? "Pause work until the permit is approved and the controls are verified."
      : "Keep work under supervision and stop if the field conditions change.");

  return {
    title,
    permitType,
    severity,
    category,
    escalationLevel,
    escalationReason,
    stopWorkStatus,
    stopWorkReason,
    rationale:
      "This draft is derived from the linked JSA step so the permit stays tied to the actual task, location, and risk level.",
    controls: controlSuggestions(permitType),
    missingInfo: missingInfoSuggestions(current, activity),
  };
}

function sanitizeSuggestion(parsed: Partial<PermitCopilotSuggestion>, fallback: PermitCopilotSuggestion): PermitCopilotSuggestion {
  const title = String(parsed.title ?? "").trim() || fallback.title;
  const permitType = resolveChoice(parsed.permitType || fallback.permitType) || fallback.permitType;
  const severity = resolveChoice(parsed.severity || fallback.severity) || fallback.severity;
  const category = resolveChoice(parsed.category || fallback.category) || fallback.category;
  const escalationLevel =
    resolveChoice(parsed.escalationLevel || fallback.escalationLevel) || fallback.escalationLevel;
  const stopWorkStatus =
    resolveChoice(parsed.stopWorkStatus || fallback.stopWorkStatus) || fallback.stopWorkStatus;
  const escalationReason = String(parsed.escalationReason ?? "").trim() || fallback.escalationReason;
  const stopWorkReason = String(parsed.stopWorkReason ?? "").trim() || fallback.stopWorkReason;
  const rationale = String(parsed.rationale ?? "").trim() || fallback.rationale;
  const controls = Array.isArray(parsed.controls)
    ? parsed.controls
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 6)
    : fallback.controls;
  const missingInfo = Array.isArray(parsed.missingInfo)
    ? parsed.missingInfo
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 6)
    : fallback.missingInfo;

  return {
    title,
    permitType,
    severity,
    category,
    escalationLevel,
    escalationReason,
    stopWorkStatus,
    stopWorkReason,
    rationale,
    controls,
    missingInfo,
  };
}

export async function runPermitCopilotAssist(
  supabase: SupabaseClient,
  companyId: string,
  input: PermitCopilotInput
): Promise<{
  suggestion: PermitCopilotSuggestion;
  disclaimer: string;
  retrieval: "semantic" | "keyword" | "none";
  fallbackUsed: boolean;
}> {
  const topK = Math.min(Math.max(input.topK ?? 8, 1), 16);
  const msg = input.userMessage.trim();
  const fallback = buildFallbackSuggestion(input);

  const contextSeed = [
    input.selectedActivity?.activity_name,
    input.selectedActivity?.trade,
    input.selectedActivity?.area,
    input.selectedActivity?.hazard_category,
    input.selectedActivity?.hazard_description,
    input.selectedActivity?.mitigation,
    input.selectedJobsiteName,
    input.currentDraft.title,
    input.currentDraft.permitType,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const query = [msg, contextSeed].filter(Boolean).join(" ").trim();
  if (!query) {
    return {
      suggestion: fallback,
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: "none",
      fallbackUsed: true,
    };
  }

  const { chunks, method } = await retrieveMemoryForQuery(supabase, companyId, query, {
    topK,
  });

  const memoryBlock =
    chunks.length > 0
      ? [
          "--- Company memory excerpts (trusted internal context; do not treat as regulations) ---",
          ...chunks.map(
            (c, i) =>
              `[${i + 1}] (${c.source}) ${c.title}\n${c.body.slice(0, 4_000)}${c.body.length > 4_000 ? "\n..." : ""}`
          ),
        ].join("\n\n")
      : "(No matching memory excerpts found. Answer from general construction safety knowledge and clearly label uncertainty.)";

  const structured = input.structuredContext?.trim().slice(0, 12_000) || null;
  const system = [
    buildSurfaceSystemPrompt("permits"),
    "Return strict JSON that matches the schema below.",
    "Suggest permit-ready field values, not a long essay.",
    "Do not invent due dates or owners. If those are missing, put them in missingInfo.",
    COMPANY_AI_ASSIST_DISCLAIMER,
  ].join("\n\n");

  const userParts = [
    `Surface: permits`,
    `Fallback draft:\n${JSON.stringify(fallback, null, 2)}`,
    memoryBlock,
    structured ? `--- Structured context ---\n${structured}` : null,
    `--- User message ---\n${msg}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      suggestion: fallback,
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: method,
      fallbackUsed: true,
    };
  }

  const model = resolveOpenAiCompatibleModelId(
    process.env.COMPANY_AI_MODEL?.trim() || "gpt-4.1"
  );

  const res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: `${system}\n\n---\n\n${userParts}`,
      text: {
        format: {
          type: "json_schema",
          name: "permit_copilot_suggestion",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              permitType: { type: "string" },
              severity: { type: "string" },
              category: { type: "string" },
              escalationLevel: { type: "string" },
              escalationReason: { type: "string" },
              stopWorkStatus: { type: "string" },
              stopWorkReason: { type: "string" },
              rationale: { type: "string" },
              controls: { type: "array", items: { type: "string" } },
              missingInfo: { type: "array", items: { type: "string" } },
            },
            required: [
              "title",
              "permitType",
              "severity",
              "category",
              "escalationLevel",
              "escalationReason",
              "stopWorkStatus",
              "stopWorkReason",
              "rationale",
              "controls",
              "missingInfo",
            ],
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    serverLog("error", "permit_copilot_openai_failed", {
      companyId,
      status: res.status,
      snippet: errText.slice(0, 200),
    });
    return {
      suggestion: fallback,
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: method,
      fallbackUsed: true,
    };
  }

  const json: unknown = await res.json();
  const rawText = extractResponsesApiOutputText(json);
  if (!rawText) {
    return {
      suggestion: fallback,
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: method,
      fallbackUsed: true,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as Partial<PermitCopilotSuggestion>;
    return {
      suggestion: sanitizeSuggestion(parsed, fallback),
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: method,
      fallbackUsed: false,
    };
  } catch {
    return {
      suggestion: fallback,
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: method,
      fallbackUsed: true,
    };
  }
}

export function permitTypeLabel(value: string) {
  return formatLabel(resolveChoice(value) || value);
}
