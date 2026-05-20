import type { CompanyAssignableUser } from "@/lib/companyAssignableUsers";
import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";

export type CorrectiveActionRiskSignal = {
  id: string;
  title: string;
  detail?: string | null;
  source?: string | null;
  site?: string | null;
  siteId?: string | null;
  area?: string | null;
  riskLevel?: SafePredictRiskLevel | string | null;
  score?: number | null;
};

export type SafePredictAiActionSuggestion = {
  riskId: string;
  riskTitle: string;
  title: string;
  description: string;
  severity: SafePredictRiskLevel;
  category: string;
  dueAt: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  rationale: string;
  warning: string | null;
};

const CATEGORIES = new Set([
  "hazard",
  "near_miss",
  "incident",
  "good_catch",
  "ppe_violation",
  "housekeeping",
  "equipment_issue",
  "fall_hazard",
  "electrical_hazard",
  "excavation_trench_concern",
  "fire_hot_work_concern",
  "corrective_action",
]);

function stripJsonFence(text: string) {
  let next = text.trim();
  if (next.startsWith("```")) {
    next = next.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return next;
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeAiRiskLevel(value: unknown): SafePredictRiskLevel {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

export function normalizeAiCategory(value: unknown) {
  const normalized = cleanText(value, "corrective_action").toLowerCase().replace(/\s+/g, "_");
  return CATEGORIES.has(normalized) ? normalized : "corrective_action";
}

export function parseAiActionSuggestionText(text: string): {
  title: string;
  description: string;
  severity: SafePredictRiskLevel;
  category: string;
  dueAt?: string;
  assignedUserId?: string | null;
  rationale: string;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const title = cleanText(record.title).slice(0, 160);
  const description = cleanText(record.description).slice(0, 1200);
  if (!title || !description) return null;
  return {
    title,
    description,
    severity: normalizeAiRiskLevel(record.severity),
    category: normalizeAiCategory(record.category),
    dueAt: cleanText(record.dueAt) || undefined,
    assignedUserId: cleanText(record.assignedUserId) || null,
    rationale: cleanText(record.rationale, "AI selected the action most likely to reduce the current exposure.").slice(0, 800),
  };
}

export function defaultDueDateForRisk(level: SafePredictRiskLevel) {
  const due = new Date();
  due.setDate(due.getDate() + (level === "critical" ? 1 : level === "high" ? 3 : level === "medium" ? 7 : 14));
  return due.toISOString();
}

export function fallbackAiActionSuggestion(params: {
  risk: CorrectiveActionRiskSignal;
  assignableUsers: CompanyAssignableUser[];
}): SafePredictAiActionSuggestion {
  const severity = normalizeAiRiskLevel(params.risk.riskLevel);
  const assignedUser = params.assignableUsers[0] ?? null;
  const riskTitle = cleanText(params.risk.title, "Risk exposure");
  const area = cleanText(params.risk.area || params.risk.site);
  return {
    riskId: cleanText(params.risk.id, riskTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    riskTitle,
    title: `Reduce exposure: ${riskTitle}`.slice(0, 160),
    description: [
      `Review the current ${riskTitle.toLowerCase()} exposure${area ? ` in ${area}` : ""}.`,
      "Confirm the immediate control is in place, remove affected workers from uncontrolled exposure, document corrective proof, and verify the control before normal work continues.",
      `Risk signal: ${cleanText(params.risk.id, riskTitle)}.`,
    ].join(" "),
    severity,
    category: "corrective_action",
    dueAt: defaultDueDateForRisk(severity),
    assignedUserId: assignedUser?.id ?? null,
    assignedUserName: assignedUser?.name ?? null,
    rationale: "The action focuses on field verification, exposure removal, and documented control closure for the selected risk signal.",
    warning: assignedUser ? null : "No active company users are available for assignment.",
  };
}

export function buildAiActionPrompt(params: {
  risk: CorrectiveActionRiskSignal;
  assignableUsers: CompanyAssignableUser[];
}) {
  const users = params.assignableUsers.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
  }));
  return [
    "You are a construction safety mitigation planner.",
    "Return only JSON for one corrective action that reduces the supplied risk or exposure.",
    "Use exactly one assignedUserId from the provided active company users. If no user fits, return null.",
    "Do not invent user IDs, names, counts, regulations, or evidence.",
    'JSON shape: {"title": string, "description": string, "severity": "low|medium|high|critical", "category": string, "dueAt": ISO date string, "assignedUserId": string|null, "rationale": string}.',
    `Risk signal JSON: ${JSON.stringify(params.risk)}`,
    `Active company users JSON: ${JSON.stringify(users)}`,
  ].join("\n");
}
