import { recordEventLog } from "@/lib/superadmin/health/eventLog";
import { applyHealthListFilters, tenantIdForScope } from "@/lib/superadmin/health/filters";
import {
  type HealthScopeFilters,
  type HealthScoreCategory,
  type HealthSupabaseClient,
  type SuperadminHealthScore,
} from "@/lib/superadmin/health/types";

const WEIGHTS = {
  systemHealth: 20,
  aiEngine: 15,
  predictionValue: 15,
  dataQuality: 15,
  cyberHealth: 15,
  ownerValidation: 10,
  helpTickets: 10,
} as const;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pending(weight: number, explanation: string): HealthScoreCategory {
  return { score: null, status: "pending", weight, explanation };
}

function insufficient(weight: number, explanation: string): HealthScoreCategory {
  return { score: null, status: "insufficient_data", weight, explanation };
}

function active(weight: number, score: number, explanation: string): HealthScoreCategory {
  return { score: clampScore(score), status: "active", weight, explanation };
}

function scoreFromSeverityRows(rows: Array<Record<string, unknown>>, weight: number, label: string) {
  if (rows.length === 0) {
    return insufficient(weight, `${label} has no Phase 1 event data yet.`);
  }

  const unresolved = rows.filter((row) => !["resolved"].includes(text(row.event_status)));
  const penalty = unresolved.reduce((total, row) => {
    const severity = text(row.severity);
    if (severity === "critical") return total + 40;
    if (severity === "high") return total + 25;
    if (severity === "medium") return total + 10;
    return total + 2;
  }, 0);

  return active(
    weight,
    100 - penalty,
    `${label} uses ${rows.length} event(s); ${unresolved.length} unresolved event(s) affect the score.`
  );
}

function eventModuleMatches(row: Record<string, unknown>, modules: string[]) {
  const moduleName = text(row.module).toLowerCase();
  return modules.some((candidate) => moduleName.includes(candidate));
}

export function computeSuperadminHealthScoreFromRows(input: {
  events: Array<Record<string, unknown>>;
  changes: Array<Record<string, unknown>>;
  owners: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
}): SuperadminHealthScore {
  const systemRows = input.events.filter((row) => eventModuleMatches(row, ["system_health", "system-test"]));
  const aiRows = input.events.filter((row) => eventModuleMatches(row, ["ai_engine", "ai-operation"]));
  const dataQualityRows = input.events.filter((row) => eventModuleMatches(row, ["data_quality", "input_validation"]));
  const cyberRows = input.events.filter((row) => eventModuleMatches(row, ["cyber"]));

  const ownerCounts = input.owners.reduce<{ total: number; verified: number; pending: number; problem: number }>(
    (acc, row) => {
      const status = text(row.validation_status);
      acc.total += 1;
      if (status === "verified") acc.verified += 1;
      if (status === "pending_verification") acc.pending += 1;
      if (["conflicting_owner", "unauthorized_owner", "expired_authority", "requires_second_approval"].includes(status)) {
        acc.problem += 1;
      }
      return acc;
    },
    { total: 0, verified: 0, pending: 0, problem: 0 }
  );

  const openTickets = input.tickets.filter((row) => !["resolved", "closed"].includes(text(row.status)));
  const ticketPenalty = openTickets.reduce((total, row) => {
    const severity = text(row.severity) || (text(row.priority) === "critical" ? "critical" : text(row.priority) === "high" ? "high" : "medium");
    if (severity === "critical") return total + 35;
    if (severity === "high") return total + 18;
    if (severity === "medium") return total + 8;
    return total + 3;
  }, 0);

  const categories = {
    systemHealth: scoreFromSeverityRows(systemRows, WEIGHTS.systemHealth, "System Health"),
    aiEngine:
      aiRows.length > 0
        ? scoreFromSeverityRows(aiRows, WEIGHTS.aiEngine, "AI Engine Operations")
        : pending(WEIGHTS.aiEngine, "AI Engine scoring will activate when Phase 3 operation events feed the ledger."),
    predictionValue: pending(
      WEIGHTS.predictionValue,
      "Prediction value scoring is reserved for Phase 4 prediction records and valuation outcomes."
    ),
    dataQuality: scoreFromSeverityRows(dataQualityRows, WEIGHTS.dataQuality, "Data Quality"),
    cyberHealth:
      cyberRows.length > 0
        ? scoreFromSeverityRows(cyberRows, WEIGHTS.cyberHealth, "Cyber Health")
        : pending(WEIGHTS.cyberHealth, "Cyber Health scoring will activate when Phase 5 cyber alerts feed the ledger."),
    ownerValidation:
      ownerCounts.total > 0
        ? active(
            WEIGHTS.ownerValidation,
            100 - ownerCounts.problem * 35 - ownerCounts.pending * 10,
            `${ownerCounts.verified} verified owner record(s), ${ownerCounts.pending} pending, ${ownerCounts.problem} requiring action.`
          )
        : insufficient(WEIGHTS.ownerValidation, "Owner registry exists, but no owner records match this scope yet."),
    helpTickets: active(
      WEIGHTS.helpTickets,
      100 - ticketPenalty,
      openTickets.length === 0
        ? "No open Health foundation tickets match this scope."
        : `${openTickets.length} open ticket(s) affect the score.`
    ),
  };

  const available = Object.values(categories).filter((category) => typeof category.score === "number");
  const availableWeight = available.reduce((total, category) => total + category.weight, 0);
  const weightedScore =
    availableWeight > 0
      ? available.reduce((total, category) => total + numberValue(category.score) * category.weight, 0) / availableWeight
      : 0;

  const criticalEventAlerts = input.events
    .filter((row) => ["critical", "high"].includes(text(row.severity)) && text(row.event_status) !== "resolved")
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      type: "event",
      title: `${text(row.module) || "Platform"}: ${text(row.action) || "review needed"}`,
      severity: text(row.severity),
      status: text(row.event_status),
      createdAt: text(row.created_at),
    }));

  const criticalTicketAlerts = openTickets
    .filter((row) => ["critical", "high"].includes(text(row.severity)) || ["critical", "high"].includes(text(row.priority)))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      type: "ticket",
      title: text(row.title) || "Open help ticket",
      severity: text(row.severity) || text(row.priority),
      status: text(row.status),
      createdAt: text(row.created_at),
    }));

  const recommendedActions = Object.entries(categories)
    .filter(([, category]) => category.status !== "active" || (typeof category.score === "number" && category.score < 80))
    .map(([key, category]) => `${key}: ${category.explanation}`)
    .slice(0, 6);

  return {
    overallScore: clampScore(weightedScore),
    categories,
    criticalAlerts: [...criticalEventAlerts, ...criticalTicketAlerts].slice(0, 10),
    whatChanged: input.changes.slice(0, 10),
    recommendedActions,
  };
}

async function loadScoreRows(client: HealthSupabaseClient, filters: HealthScopeFilters) {
  const [events, changes, owners, tickets] = await Promise.all([
    applyHealthListFilters(client.from("event_log").select("*"), { ...filters, limit: 500 }, {}),
    applyHealthListFilters(client.from("change_log").select("*"), { ...filters, limit: 100 }, {
      severityColumn: "risk_level",
      ownerColumn: "owner_id",
    }),
    applyHealthListFilters(client.from("owner_registry").select("*"), { ...filters, limit: 200 }, {
      statusColumn: "validation_status",
      ownerColumn: "owner_user_id",
    }),
    applyHealthListFilters(client.from("platform_help_tickets").select("*"), { ...filters, limit: 200 }, {
      statusColumn: "status",
      severityColumn: "severity",
      ownerColumn: "owner_id",
    }),
  ]);

  for (const result of [events, changes, owners, tickets]) {
    if (result.error) throw new Error(result.error.message ?? "Unable to load health score source data.");
  }

  return {
    events: (events.data ?? []) as Array<Record<string, unknown>>,
    changes: (changes.data ?? []) as Array<Record<string, unknown>>,
    owners: (owners.data ?? []) as Array<Record<string, unknown>>,
    tickets: (tickets.data ?? []) as Array<Record<string, unknown>>,
  };
}

export async function calculateSuperadminHealthScore(
  client: HealthSupabaseClient,
  filters: HealthScopeFilters,
  actorUserId?: string | null
) {
  const rows = await loadScoreRows(client, filters);
  const score = computeSuperadminHealthScoreFromRows(rows);
  const tenantId = tenantIdForScope({ tenantId: filters.tenantId, companyId: filters.companyId });
  const snapshot = {
    tenant_id: tenantId,
    company_id: filters.companyId,
    jobsite_id: filters.jobsiteId,
    overall_score: score.overallScore,
    system_health_score: score.categories.systemHealth.score,
    ai_engine_score: score.categories.aiEngine.score,
    prediction_value_score: score.categories.predictionValue.score,
    data_quality_score: score.categories.dataQuality.score,
    cyber_health_score: score.categories.cyberHealth.score,
    owner_validation_score: score.categories.ownerValidation.score,
    help_ticket_score: score.categories.helpTickets.score,
    explanation: score,
  };

  const result = await client
    .from("health_score_snapshots")
    .insert(snapshot)
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to store health score snapshot.");
  }

  await recordEventLog(client, {
    tenantId,
    companyId: filters.companyId,
    jobsiteId: filters.jobsiteId,
    actorUserId,
    module: "superadmin_health",
    objectType: "health_score_snapshot",
    objectId: typeof (result.data as Record<string, unknown> | null)?.id === "string" ? String((result.data as Record<string, unknown>).id) : null,
    action: "health_score_calculated",
    severity: score.overallScore < 60 ? "high" : score.overallScore < 80 ? "medium" : "low",
    eventStatus: score.overallScore < 60 ? "pending_review" : "recorded",
    metadata: {
      overallScore: score.overallScore,
      activeCategories: Object.values(score.categories).filter((category) => category.status === "active").length,
    },
  });

  return score;
}
