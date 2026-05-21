import { requestAiResponsesText, type AiExecutionMeta } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import type { CompanyMemoryItemRow } from "@/lib/companyMemory/types";
import type {
  RiskActionEvidencePackSummary,
  RiskActionEvidenceRef,
  RiskActionPlanDraft,
  RiskActionPriority,
  RiskActionTargetModule,
} from "@/types/risk-action-plan";

const TARGET_MODULES = new Set<RiskActionTargetModule>([
  "predictive_risk",
  "field_issue",
  "corrective_action",
  "incident",
  "permit",
  "jsa",
  "training",
  "jobsite",
  "risk_memory",
  "command_center",
]);

function clamp(n: unknown, fallback: number, min: number, max: number) {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizePriority(value: unknown, fallback: RiskActionPriority = "medium"): RiskActionPriority {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "critical") return raw;
  return fallback;
}

function normalizeTargetModule(value: unknown, fallback: RiskActionTargetModule): RiskActionTargetModule {
  const raw = String(value ?? "").trim().toLowerCase();
  return TARGET_MODULES.has(raw as RiskActionTargetModule) ? (raw as RiskActionTargetModule) : fallback;
}

function hrefForTarget(target: RiskActionTargetModule) {
  if (target === "field_issue" || target === "corrective_action") return "/field-id-exchange";
  if (target === "incident") return "/incidents";
  if (target === "permit") return "/permits";
  if (target === "jsa") return "/jsa";
  if (target === "training") return "/training-matrix";
  if (target === "jobsite") return "/jobsites";
  if (target === "risk_memory") return "/settings/risk-memory";
  if (target === "command_center") return "/command-center";
  return "/analytics/predictive-model";
}

function stripJsonFence(text: string) {
  let value = text.trim();
  if (value.startsWith("```")) {
    value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return value;
}

function sourceStatus(count: number): "connected" | "missing" {
  return count > 0 ? "connected" : "missing";
}

function riskMemoryBand(ctx: RiskMemoryStructuredContext | null) {
  return ctx?.aggregatedWithBaseline?.band ?? ctx?.aggregated?.band ?? null;
}

function riskMemoryScore(ctx: RiskMemoryStructuredContext | null) {
  return ctx?.aggregatedWithBaseline?.score ?? ctx?.aggregated?.score ?? null;
}

function evidenceRef(params: {
  id: string;
  label: string;
  sourceModule: RiskActionTargetModule | string;
  sourceId?: string | null;
  href?: string | null;
  detail?: string | null;
}): RiskActionEvidenceRef {
  return {
    id: params.id,
    label: params.label.slice(0, 160),
    sourceModule: params.sourceModule,
    sourceId: params.sourceId ?? null,
    href: params.href ?? null,
    detail: params.detail?.slice(0, 240) ?? null,
  };
}

export function buildRiskActionEvidencePack(params: {
  days: number;
  jobsiteId?: string | null;
  predictiveRisk: PredictiveRiskPayload;
  riskMemory: RiskMemoryStructuredContext | null;
  memoryItems?: CompanyMemoryItemRow[];
}): RiskActionEvidencePackSummary {
  const predictive = params.predictiveRisk;
  const memoryItems = params.memoryItems ?? [];
  const topLocations = predictive.locations.slice(0, 4).map((location) => ({
    id: location.id,
    label: location.label,
    riskScore: location.riskScore,
    trendDelta: location.trendDelta,
  }));
  const topDrivers = predictive.drivers.slice(0, 5).map((driver) => ({
    label: driver.label,
    count: driver.count,
    percent: driver.percent,
  }));

  const evidenceRefs: RiskActionEvidenceRef[] = [
    ...topLocations.slice(0, 3).map((location) =>
      evidenceRef({
        id: `location-${location.id}`,
        label: location.label,
        sourceModule: "predictive_risk",
        sourceId: location.id,
        href: "/analytics/predictive-model",
        detail: `Risk score ${location.riskScore}; trend ${location.trendDelta > 0 ? "+" : ""}${location.trendDelta}.`,
      })
    ),
    ...topDrivers.slice(0, 3).map((driver, index) =>
      evidenceRef({
        id: `driver-${index}`,
        label: driver.label,
        sourceModule: "predictive_risk",
        href: "/analytics/predictive-model",
        detail: `${driver.count} signal${driver.count === 1 ? "" : "s"}${driver.percent != null ? `; ${driver.percent}% of drivers` : ""}.`,
      })
    ),
    ...(params.riskMemory?.topHazards ?? []).slice(0, 2).map((hazard, index) =>
      evidenceRef({
        id: `risk-memory-hazard-${index}`,
        label: String(hazard.code ?? "Unmapped hazard"),
        sourceModule: "risk_memory",
        href: "/settings/risk-memory",
        detail: `${hazard.count} Risk Memory facet${hazard.count === 1 ? "" : "s"} in the selected window.`,
      })
    ),
  ].slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    days: Math.max(1, Math.min(365, Math.floor(params.days))),
    jobsiteId: params.jobsiteId ?? null,
    sourceCoverage: [
      {
        key: "predictiveLocations",
        label: "Predictive locations",
        count: predictive.locations.length,
        status: sourceStatus(predictive.locations.length),
      },
      {
        key: "predictiveDrivers",
        label: "Predictive drivers",
        count: predictive.drivers.length,
        status: sourceStatus(predictive.drivers.length),
      },
      {
        key: "recommendedActions",
        label: "Existing model actions",
        count: predictive.actions.length,
        status: sourceStatus(predictive.actions.length),
      },
      {
        key: "riskMemory",
        label: "Risk Memory facets",
        count: params.riskMemory?.facetCount ?? 0,
        status: sourceStatus(params.riskMemory?.facetCount ?? 0),
      },
      {
        key: "companyMemory",
        label: "Company memory snippets",
        count: memoryItems.length,
        status: sourceStatus(memoryItems.length),
      },
    ],
    topDrivers,
    topLocations,
    riskMemory: {
      facetCount: params.riskMemory?.facetCount ?? 0,
      band: riskMemoryBand(params.riskMemory),
      score: riskMemoryScore(params.riskMemory),
      confidence: params.riskMemory?.derivedRollupConfidence ?? null,
    },
    memorySnippetCount: memoryItems.length,
    evidenceRefs,
  };
}

function defaultEvidence(evidencePack: RiskActionEvidencePackSummary): RiskActionEvidenceRef[] {
  return evidencePack.evidenceRefs.slice(0, 4);
}

export function buildRuleBasedRiskActionDrafts(
  evidencePack: RiskActionEvidencePackSummary
): RiskActionPlanDraft[] {
  const drafts: RiskActionPlanDraft[] = [];
  const topLocation = evidencePack.topLocations[0];
  const topDriver = evidencePack.topDrivers[0];
  const band = String(evidencePack.riskMemory.band ?? "").toLowerCase();

  if (topLocation && topLocation.riskScore >= 55) {
    drafts.push({
      kind: "supervisor_pre_task_review",
      title: `Pre-task review for ${topLocation.label}`,
      body: `Run a supervisor-led pre-task review before the next high-risk activity at ${topLocation.label}. Focus the discussion on ${topDriver?.label ?? "the leading driver"} and document the verification step before work is released.`,
      confidence: clamp(evidencePack.riskMemory.confidence ?? 0.65, 0.65, 0.35, 0.9),
      priority: topLocation.riskScore >= 75 ? "critical" : "high",
      targetModule: "predictive_risk",
      targetHref: "/analytics/predictive-model",
      evidenceRefs: defaultEvidence(evidencePack),
    });
  }

  if (topDriver) {
    const targetModule: RiskActionTargetModule = /permit|hot work|loto|electrical/i.test(topDriver.label)
      ? "permit"
      : /training|cert/i.test(topDriver.label)
        ? "training"
        : "field_issue";
    drafts.push({
      kind: "driver_control_verification",
      title: `Verify controls for ${topDriver.label}`,
      body: `${topDriver.label} is the strongest current risk driver. Assign a competent person to verify the active controls, capture evidence, and escalate any gaps before the shift continues.`,
      confidence: 0.7,
      priority: topDriver.percent != null && topDriver.percent >= 45 ? "high" : "medium",
      targetModule,
      targetHref: hrefForTarget(targetModule),
      evidenceRefs: defaultEvidence(evidencePack),
    });
  }

  if (band === "high" || band === "critical") {
    drafts.push({
      kind: "risk_memory_followup",
      title: "Close the Risk Memory loop",
      body: `Risk Memory is in a ${band} band. Review the top hazard patterns, confirm whether open corrective actions are still accurate, and update stale statuses so the next forecast is not distorted.`,
      confidence: evidencePack.riskMemory.confidence ?? 0.62,
      priority: band === "critical" ? "critical" : "high",
      targetModule: "risk_memory",
      targetHref: "/settings/risk-memory",
      evidenceRefs: defaultEvidence(evidencePack),
    });
  }

  if (evidencePack.memorySnippetCount === 0) {
    drafts.push({
      kind: "memory_coverage",
      title: "Add company-specific prevention context",
      body: "No company memory snippets were available for this action plan. Add the current site rule, customer requirement, or lesson learned so future AI recommendations can use company-specific context.",
      confidence: 0.55,
      priority: "medium",
      targetModule: "command_center",
      targetHref: "/command-center?section=knowledge",
      evidenceRefs: defaultEvidence(evidencePack),
    });
  }

  if (drafts.length === 0) {
    drafts.push({
      kind: "monitoring_cadence",
      title: "Keep weekly risk review cadence",
      body: "No acute AI action surfaced from the current evidence pack. Keep the weekly review cadence and refresh the plan after new incidents, JSAs, permits, or field issues are recorded.",
      confidence: 0.5,
      priority: "low",
      targetModule: "command_center",
      targetHref: "/command-center",
      evidenceRefs: defaultEvidence(evidencePack),
    });
  }

  return drafts.slice(0, 5);
}

export function parseRiskActionDraftsFromModelText(
  text: string,
  evidencePack: RiskActionEvidencePackSummary
): RiskActionPlanDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const evidence = defaultEvidence(evidencePack);
  const drafts: RiskActionPlanDraft[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title = String(obj.title ?? "").trim();
    const body = String(obj.body ?? "").trim();
    if (!title || !body) continue;
    const targetModule = normalizeTargetModule(obj.targetModule ?? obj.target_module, "predictive_risk");
    drafts.push({
      kind: String(obj.kind ?? "ai_risk_action").trim().slice(0, 64) || "ai_risk_action",
      title: title.slice(0, 200),
      body: body.slice(0, 1800),
      confidence: clamp(obj.confidence, 0.6, 0.2, 0.95),
      priority: normalizePriority(obj.priority),
      targetModule,
      targetHref: String(obj.targetHref ?? obj.target_href ?? hrefForTarget(targetModule)).slice(0, 300),
      evidenceRefs: evidence,
    });
    if (drafts.length >= 5) break;
  }
  return drafts;
}

export async function buildLlmRiskActionDrafts(params: {
  evidencePack: RiskActionEvidencePackSummary;
}): Promise<{ drafts: RiskActionPlanDraft[]; error?: string; meta?: AiExecutionMeta }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { drafts: [], error: "no_openai_key" };

  const model =
    process.env.RISK_ACTION_PLAN_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");

  const system = [
    "You are a construction safety supervisor assistant.",
    "Use only the provided evidence pack. Do not invent counts, names, incidents, or regulations.",
    "Return only a JSON array of 3 to 5 objects.",
    'Each object must include: "kind", "title", "body", "confidence", "priority", "targetModule", "targetHref".',
    `targetModule must be one of: ${[...TARGET_MODULES].join(", ")}.`,
    "Recommendations must be practical supervisor actions with verification or follow-through.",
  ].join(" ");

  try {
    const response = await requestAiResponsesText({
      apiKey,
      model,
      surface: "risk-action-plan.generate",
      input: `${system}\n\nEvidence pack:\n${JSON.stringify(params.evidencePack)}`,
    });
    if (!response.text) return { drafts: [], error: "empty_response", meta: response.meta };
    return {
      drafts: parseRiskActionDraftsFromModelText(response.text, params.evidencePack),
      meta: response.meta,
    };
  } catch (error) {
    return {
      drafts: [],
      error: error instanceof Error ? error.message.slice(0, 160) : "llm_exception",
    };
  }
}

export function mergeRiskActionDrafts(drafts: RiskActionPlanDraft[]) {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = draft.title.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}
