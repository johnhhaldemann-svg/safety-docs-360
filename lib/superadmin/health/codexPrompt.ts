import type { SuperadminHealthScore } from "@/lib/superadmin/health/types";

export type SuperadminHealthCodexPromptPayload = {
  score: SuperadminHealthScore | null;
  events: Array<Record<string, unknown>>;
  changes: Array<Record<string, unknown>>;
  owners: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
};

export type BuildSuperadminHealthCodexPromptInput = {
  payload: SuperadminHealthCodexPromptPayload;
  filters: Record<string, string>;
  generatedAt: string;
};

const ROW_LIMIT = 8;
const VALUE_LIMIT = 180;

function cleanText(value: unknown, fallback = "not recorded") {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function cleanValue(value: unknown, fallback = "not recorded") {
  if (value == null) return fallback;
  if (typeof value === "string") return cleanText(value, fallback);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function clip(value: unknown, fallback = "not recorded") {
  const text = cleanValue(value, fallback);
  return text.length > VALUE_LIMIT ? `${text.slice(0, VALUE_LIMIT - 3)}...` : text;
}

function activeFilters(filters: Record<string, string>) {
  const entries = Object.entries(filters)
    .map(([key, value]) => [key, cleanText(value, "")] as const)
    .filter(([, value]) => value);

  if (entries.length === 0) return ["- No dashboard filters were applied."];
  return entries.map(([key, value]) => `- ${key}: ${value}`);
}

function limitedRows(rows: Array<Record<string, unknown>>) {
  return rows.slice(0, ROW_LIMIT);
}

function omittedCount(rows: Array<Record<string, unknown>>) {
  return Math.max(0, rows.length - ROW_LIMIT);
}

function formatRows(
  title: string,
  rows: Array<Record<string, unknown>>,
  formatter: (row: Record<string, unknown>, index: number) => string
) {
  if (rows.length === 0) return [`## ${title}`, "- No rows were loaded for the current filters."];

  const lines = [`## ${title}`, ...limitedRows(rows).map(formatter)];
  const omitted = omittedCount(rows);
  if (omitted > 0) lines.push(`- ${omitted} additional row(s) omitted from this prompt. Inspect the dashboard/API before fixing.`);
  return lines;
}

function scoreLines(score: SuperadminHealthScore | null) {
  if (!score) {
    return [
      "## Health Score",
      "- Overall score: not loaded",
      "- Reason: dashboard payload did not include a health score. Inspect the API and do not infer missing results.",
    ];
  }

  const categoryLines = Object.entries(score.categories).map(([key, category]) => {
    const scoreText = category.score == null ? category.status : `${category.score}/100`;
    return `- ${key} (${category.weight}%): ${scoreText}. ${clip(category.explanation)}`;
  });

  return [
    "## Health Score",
    `- Overall score: ${score.overallScore}/100`,
    `- Critical alerts in score payload: ${score.criticalAlerts.length}`,
    `- Recommended actions in score payload: ${score.recommendedActions.length}`,
    ...categoryLines,
  ];
}

function alertLines(score: SuperadminHealthScore | null) {
  const alerts = score?.criticalAlerts ?? [];
  return formatRows("Critical Alerts", alerts, (alert, index) => {
    return `- ${index + 1}. ${clip(alert.title, "Health alert")} | severity=${clip(alert.severity)} | status=${clip(alert.status)} | id=${clip(alert.id)}`;
  });
}

function recommendedActionLines(score: SuperadminHealthScore | null) {
  const actions = score?.recommendedActions ?? [];
  if (actions.length === 0) return ["## Recommended Actions From Report", "- No recommended actions were present in the current score payload."];
  return [
    "## Recommended Actions From Report",
    ...actions.slice(0, ROW_LIMIT).map((action, index) => `- ${index + 1}. ${clip(action)}`),
    ...(actions.length > ROW_LIMIT ? [`- ${actions.length - ROW_LIMIT} additional action(s) omitted from this prompt.`] : []),
  ];
}

export function buildSuperadminHealthCodexPrompt({
  payload,
  filters,
  generatedAt,
}: BuildSuperadminHealthCodexPromptInput) {
  const lines = [
    "# Codex Review Prompt: SuperAdmin Health Intelligence",
    "",
    `Generated at: ${cleanText(generatedAt)}`,
    "",
    "You are Codex working in the SafetyDocs360 repository. Review and fix only issues supported by this SuperAdmin Health report.",
    "",
    "Rules:",
    "- Inspect the existing repository structure before changing code.",
    "- Preserve SuperAdmin RBAC, tenant isolation, and existing dashboard behavior.",
    "- Do not create fake production data or mutate real customer data.",
    "- Do not expand scope beyond the evidence in this report.",
    "- If report data is missing or marked pending/insufficient_data, state that clearly instead of inventing findings.",
    "- Run relevant tests, lint, typecheck, and build checks when possible.",
    "- End with the required OWNER PROOF REPORT format.",
    "",
    "## Current Dashboard Filters",
    ...activeFilters(filters),
    "",
    ...scoreLines(payload.score),
    "",
    ...alertLines(payload.score),
    "",
    ...recommendedActionLines(payload.score),
    "",
    ...formatRows("Recent Event Ledger Rows", payload.events, (event, index) => {
      return `- ${index + 1}. ${clip(event.module, "module")} / ${clip(event.action, "action")} | severity=${clip(event.severity)} | status=${clip(event.event_status)} | object=${clip(event.object_type)}/${clip(event.object_id)}`;
    }),
    "",
    ...formatRows("What Changed Rows", payload.changes, (change, index) => {
      return `- ${index + 1}. ${clip(change.object_type, "object")} / ${clip(change.change_type, "changed")} | risk=${clip(change.risk_level)} | objectId=${clip(change.object_id)} | reason=${clip(change.reason)}`;
    }),
    "",
    ...formatRows("Owner Registry Rows", payload.owners, (owner, index) => {
      return `- ${index + 1}. ${clip(owner.owner_type, "owner")} | ownerUserId=${clip(owner.owner_user_id)} | status=${clip(owner.validation_status)} | authority=${clip(owner.authority_level)} | object=${clip(owner.object_type)}/${clip(owner.object_id)}`;
    }),
    "",
    ...formatRows("Open Health Ticket Rows", payload.tickets, (ticket, index) => {
      return `- ${index + 1}. ${clip(ticket.title, "ticket")} | severity=${clip(ticket.severity ?? ticket.priority)} | status=${clip(ticket.status)} | source=${clip(ticket.source_type)}/${clip(ticket.source_id)} | owner=${clip(ticket.owner_id)}`;
    }),
    "",
    "## Requested Codex Outcome",
    "- Identify the smallest safe fix set supported by this report.",
    "- Apply fixes only after inspecting the relevant source files.",
    "- Add or update focused tests for the changed behavior.",
    "- Explain manual verification steps for the owner.",
  ];

  return `${lines.join("\n").trim()}\n`;
}
