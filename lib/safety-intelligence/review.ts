import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { STATIC_PLATFORM_RULE_TEMPLATES } from "@/lib/safety-intelligence/rules/catalog";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import { loadDbRuleTemplates } from "@/lib/safety-intelligence/rules/repository";
import type {
  BucketedWorkItem,
  JsonObject,
  PermitTriggerType,
  RawTaskInput,
  RulesEvaluation,
  SafetyReviewAction,
  SafetyReviewGap,
  SafetyReviewGapCode,
  SafetyReviewPayload,
  SafetyReviewRow,
  SafetyReviewSource,
} from "@/types/safety-intelligence";

type LiteClient = SupabaseClient<any, "public", any>;

type PlatformTradeRow = {
  id: string;
  code: string;
  name: string;
};

type PlatformSubTradeRow = {
  id: string;
  trade_id: string | null;
  code: string;
  name: string;
};

type PlatformTaskTemplateRow = {
  id: string;
  trade_id: string | null;
  sub_trade_id: string | null;
  code: string;
  name: string;
  equipment_used: string[] | null;
  work_conditions: string[] | null;
  hazard_families: string[] | null;
  required_controls: string[] | null;
  permit_triggers: string[] | null;
  training_requirements: string[] | null;
  metadata: Record<string, unknown> | null;
};

type CompanyTradeRow = {
  id: string;
  code: string;
  name: string;
};

type CompanySubTradeRow = {
  id: string;
  company_trade_id: string | null;
  code: string;
  name: string;
};

type CompanyTaskRow = {
  id: string;
  jobsite_id: string | null;
  company_trade_id: string | null;
  company_sub_trade_id: string | null;
  code: string | null;
  title: string;
  description: string | null;
  equipment_used: string[] | null;
  work_conditions: string[] | null;
  hazard_families: string[] | null;
  required_controls: string[] | null;
  permit_triggers: string[] | null;
  training_requirements: string[] | null;
  work_area_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  metadata: Record<string, unknown> | null;
};

type CompanyTaskPermitTriggerRow = {
  company_task_id: string;
  permit_code: string;
};

type CompanyTaskTrainingRequirementRow = {
  company_task_id: string;
  requirement_code: string;
};

type CompanyTrainingMatrixRequirementRow = {
  requirement_code: string;
  trade_codes: string[] | null;
  task_codes: string[] | null;
};

type BucketItemReviewRow = {
  id: string;
  jobsite_id: string | null;
  bucket_key: string;
  source_module: RawTaskInput["sourceModule"];
  source_id: string | null;
  bucket_payload: BucketedWorkItem | null;
  rule_results: RulesEvaluation | null;
};

type BuildReviewRowParams = {
  id: string;
  source: SafetyReviewSource;
  scope: "company" | "jobsite";
  sourceLabel: string;
  rawInput: RawTaskInput;
  mergedRules: RulesEvaluation;
  baselineRules: RulesEvaluation;
  applicableTrainingMatrixCodes?: string[];
};

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function normalizeCode(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function humanizeCode(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unspecified";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function hasNonPlatformRuleSource(sourceBreakdown: RulesEvaluation["sourceBreakdown"]) {
  return (sourceBreakdown ?? []).some((row) => row.sourceType !== "platform");
}

function isPermitGapCode(code: SafetyReviewGapCode) {
  return code === "permit_missing" || code === "permit_removed_by_override";
}

function isTrainingGapCode(code: SafetyReviewGapCode) {
  return code === "training_missing" || code === "training_removed_by_override";
}

function isPpeGapCode(code: SafetyReviewGapCode) {
  return code === "ppe_missing" || code === "ppe_removed_by_override";
}

function buildReviewAction(domain: SafetyReviewGap["domain"], rawInput: RawTaskInput): SafetyReviewAction {
  if (domain === "permit") {
    return {
      domain,
      label: "Review permit coverage",
      href: rawInput.jobsiteId ? `/jobsites/${rawInput.jobsiteId}/permits` : "/permits",
    };
  }
  if (domain === "training") {
    return {
      domain,
      label: "Review training mappings",
      href: "/training-matrix",
    };
  }
  return {
    domain,
    label: "Inspect PPE coverage",
    href: rawInput.jobsiteId
      ? `/jobsites/${rawInput.jobsiteId}/safety-intelligence#safety-review`
      : "/safety-intelligence#safety-review",
  };
}

function addGap(
  gaps: SafetyReviewGap[],
  code: SafetyReviewGapCode,
  detail: string,
  expectedValues: string[],
  currentValues: string[]
) {
  const domain = isPermitGapCode(code)
    ? "permit"
    : isTrainingGapCode(code)
      ? "training"
      : "ppe";
  gaps.push({
    code,
    domain,
    severity:
      domain === "permit" || code.endsWith("removed_by_override")
        ? "high"
        : domain === "training"
          ? "medium"
          : "medium",
    detail,
    expectedValues,
    currentValues,
  });
}

export function buildSafetyReviewRow({
  id,
  source,
  scope,
  sourceLabel,
  rawInput,
  mergedRules,
  baselineRules,
  applicableTrainingMatrixCodes = [],
}: BuildReviewRowParams): SafetyReviewRow {
  const expectedPermitTriggers = dedupe<PermitTriggerType>([
    ...baselineRules.permitTriggers,
    ...((rawInput.permitTriggers ?? []) as PermitTriggerType[]),
  ]);
  const expectedTrainingRequirements = dedupe([
    ...baselineRules.trainingRequirements,
    ...(rawInput.trainingRequirementCodes ?? []),
    ...applicableTrainingMatrixCodes,
  ]);
  const expectedPpeRequirements = dedupe([
    ...baselineRules.ppeRequirements,
    ...(rawInput.ppeRequirements ?? []),
  ]);
  const hasOverrideSource = hasNonPlatformRuleSource(mergedRules.sourceBreakdown);
  const gaps: SafetyReviewGap[] = [];

  if (expectedPermitTriggers.length > 0 && mergedRules.permitTriggers.length === 0) {
    addGap(
      gaps,
      baselineRules.permitTriggers.length > 0 && hasOverrideSource
        ? "permit_removed_by_override"
        : "permit_missing",
      baselineRules.permitTriggers.length > 0 && hasOverrideSource
        ? "A company or jobsite rule removed permit coverage without leaving a replacement trigger."
        : "This task has permit coverage signals, but the current rule output does not produce a permit trigger.",
      expectedPermitTriggers,
      mergedRules.permitTriggers
    );
  }

  if (expectedTrainingRequirements.length > 0 && mergedRules.trainingRequirements.length === 0) {
    addGap(
      gaps,
      baselineRules.trainingRequirements.length > 0 && hasOverrideSource
        ? "training_removed_by_override"
        : "training_missing",
      baselineRules.trainingRequirements.length > 0 && hasOverrideSource
        ? "A company or jobsite rule removed training coverage without leaving a replacement requirement."
        : "This task maps to training coverage, but the current rule output does not produce a training requirement.",
      expectedTrainingRequirements,
      mergedRules.trainingRequirements
    );
  }

  const ppeContextSignals = dedupe([
    ...(rawInput.hazardFamilies ?? []),
    ...(rawInput.requiredControls ?? []),
    ...expectedPermitTriggers,
    ...expectedTrainingRequirements,
    ...baselineRules.hazardFamilies,
    ...baselineRules.requiredControls,
    ...mergedRules.hazardFamilies,
    ...mergedRules.requiredControls,
  ]);

  if ((expectedPpeRequirements.length > 0 || ppeContextSignals.length > 0) && mergedRules.ppeRequirements.length === 0) {
    addGap(
      gaps,
      baselineRules.ppeRequirements.length > 0 && hasOverrideSource
        ? "ppe_removed_by_override"
        : "ppe_missing",
      baselineRules.ppeRequirements.length > 0 && hasOverrideSource
        ? "A company or jobsite rule removed PPE coverage without leaving a replacement requirement."
        : "Risk context exists for this task, but the current rule output does not produce PPE coverage.",
      expectedPpeRequirements,
      mergedRules.ppeRequirements
    );
  }

  const actions = dedupe(gaps.map((gap) => gap.domain)).map((domain) => buildReviewAction(domain, rawInput));

  return {
    id,
    source,
    scope,
    jobsiteId: rawInput.jobsiteId ?? null,
    sourceLabel,
    taskTitle: rawInput.taskTitle,
    tradeCode: rawInput.tradeCode ?? null,
    subTradeCode: rawInput.subTradeCode ?? null,
    taskCode: rawInput.taskCode ?? null,
    workAreaLabel: rawInput.workAreaLabel ?? null,
    permitTriggers: mergedRules.permitTriggers,
    trainingRequirements: mergedRules.trainingRequirements,
    ppeRequirements: mergedRules.ppeRequirements,
    expectedPermitTriggers,
    expectedTrainingRequirements,
    expectedPpeRequirements,
    applicableTrainingMatrixCodes: dedupe(applicableTrainingMatrixCodes),
    gaps,
    actions,
    score: mergedRules.score,
    band: mergedRules.band,
    sourceBreakdown: mergedRules.sourceBreakdown,
  };
}

function buildMergedTemplates(dbTemplates: Awaited<ReturnType<typeof loadDbRuleTemplates>>) {
  return [...STATIC_PLATFORM_RULE_TEMPLATES, ...dbTemplates].filter(
    (template, index, templates) => index === templates.findIndex((candidate) => candidate.code === template.code)
  );
}

function bucketToRawTaskInput(bucket: BucketedWorkItem): RawTaskInput {
  const payload = (bucket.payload ?? {}) as Record<string, unknown>;
  return {
    companyId: bucket.companyId,
    jobsiteId: bucket.jobsiteId ?? null,
    sourceModule: bucket.source.module,
    sourceId: bucket.source.id ?? null,
    operationId: bucket.operationId ?? null,
    tradeCode: bucket.tradeCode ?? null,
    subTradeCode: bucket.subTradeCode ?? null,
    taskCode: bucket.taskCode ?? null,
    taskTitle: bucket.taskTitle,
    description: typeof payload.description === "string" ? payload.description : null,
    equipmentUsed: bucket.equipmentUsed,
    workConditions: bucket.workConditions,
    hazardFamilies: bucket.hazardFamilies,
    hazardCategories: Array.isArray(payload.hazardCategories)
      ? payload.hazardCategories.filter((value): value is string => typeof value === "string")
      : [],
    requiredControls: bucket.requiredControls,
    permitTriggers: bucket.permitTriggers,
    ppeRequirements: bucket.ppeRequirements,
    trainingRequirementCodes: bucket.trainingRequirementCodes,
    siteRestrictions: bucket.siteRestrictions,
    prohibitedEquipment: bucket.prohibitedEquipment,
    workAreaLabel: bucket.workAreaLabel ?? null,
    locationGrid: bucket.locationGrid ?? null,
    weatherConditionCode: bucket.weatherConditionCode ?? null,
    startsAt: bucket.startsAt ?? null,
    endsAt: bucket.endsAt ?? null,
    crewSize: typeof payload.crewSize === "number" ? payload.crewSize : null,
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as JsonObject)
        : ({} as JsonObject),
  };
}

function findApplicableTrainingMatrixCodes(
  rawInput: RawTaskInput,
  requirements: CompanyTrainingMatrixRequirementRow[]
) {
  const tradeCode = normalizeCode(rawInput.tradeCode);
  const taskCode = normalizeCode(rawInput.taskCode);
  return dedupe(
    requirements
      .filter((requirement) => {
        const trades = (requirement.trade_codes ?? []).map((code) => normalizeCode(code)).filter(Boolean);
        const tasks = (requirement.task_codes ?? []).map((code) => normalizeCode(code)).filter(Boolean);
        const tradeMatch = trades.length === 0 || (tradeCode && trades.includes(tradeCode));
        const taskMatch = tasks.length === 0 || (taskCode && tasks.includes(taskCode));
        return tradeMatch && taskMatch;
      })
      .map((requirement) => requirement.requirement_code)
  );
}

function sortRows(rows: SafetyReviewRow[]) {
  return [...rows].sort((left, right) => {
    const sourceOrder = { live: 0, company: 1, platform: 2 } as const;
    const bySource = sourceOrder[left.source] - sourceOrder[right.source];
    if (bySource !== 0) return bySource;
    const byTrade = String(left.tradeCode ?? "").localeCompare(String(right.tradeCode ?? ""));
    if (byTrade !== 0) return byTrade;
    return left.taskTitle.localeCompare(right.taskTitle);
  });
}

async function loadCompanyReviewInputs(supabase: LiteClient, companyId: string) {
  const [
    platformTradesResult,
    platformSubTradesResult,
    platformTasksResult,
    companyTradesResult,
    companySubTradesResult,
    companyTasksResult,
    companyTaskPermitsResult,
    companyTaskTrainingResult,
    trainingMatrixResult,
  ] = await Promise.all([
    supabase.from("platform_trades").select("id, code, name").eq("active", true),
    supabase.from("platform_sub_trades").select("id, trade_id, code, name").eq("active", true),
    supabase
      .from("platform_task_templates")
      .select(
        "id, trade_id, sub_trade_id, code, name, equipment_used, work_conditions, hazard_families, required_controls, permit_triggers, training_requirements, metadata"
      )
      .eq("active", true),
    supabase.from("company_trades").select("id, code, name").eq("company_id", companyId).eq("active", true),
    supabase
      .from("company_sub_trades")
      .select("id, company_trade_id, code, name")
      .eq("company_id", companyId)
      .eq("active", true),
    supabase
      .from("company_tasks")
      .select(
        "id, jobsite_id, company_trade_id, company_sub_trade_id, code, title, description, equipment_used, work_conditions, hazard_families, required_controls, permit_triggers, training_requirements, work_area_label, starts_at, ends_at, metadata"
      )
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("company_task_permit_triggers")
      .select("company_task_id, permit_code")
      .eq("company_id", companyId),
    supabase
      .from("company_task_training_requirements")
      .select("company_task_id, requirement_code")
      .eq("company_id", companyId),
    supabase
      .from("company_training_matrix_requirements")
      .select("requirement_code, trade_codes, task_codes")
      .eq("company_id", companyId)
      .eq("active", true),
  ]);

  if (platformTradesResult.error) throw new Error(platformTradesResult.error.message || "Failed to load platform trades.");
  if (platformSubTradesResult.error) throw new Error(platformSubTradesResult.error.message || "Failed to load platform subtrades.");
  if (platformTasksResult.error) throw new Error(platformTasksResult.error.message || "Failed to load platform task templates.");
  if (companyTradesResult.error) throw new Error(companyTradesResult.error.message || "Failed to load company trades.");
  if (companySubTradesResult.error) throw new Error(companySubTradesResult.error.message || "Failed to load company subtrades.");
  if (companyTasksResult.error) throw new Error(companyTasksResult.error.message || "Failed to load company tasks.");
  if (companyTaskPermitsResult.error) throw new Error(companyTaskPermitsResult.error.message || "Failed to load company task permit links.");
  if (companyTaskTrainingResult.error) throw new Error(companyTaskTrainingResult.error.message || "Failed to load company task training links.");
  if (trainingMatrixResult.error) throw new Error(trainingMatrixResult.error.message || "Failed to load training matrix requirements.");

  return {
    platformTrades: (platformTradesResult.data ?? []) as PlatformTradeRow[],
    platformSubTrades: (platformSubTradesResult.data ?? []) as PlatformSubTradeRow[],
    platformTasks: (platformTasksResult.data ?? []) as PlatformTaskTemplateRow[],
    companyTrades: (companyTradesResult.data ?? []) as CompanyTradeRow[],
    companySubTrades: (companySubTradesResult.data ?? []) as CompanySubTradeRow[],
    companyTasks: (companyTasksResult.data ?? []) as CompanyTaskRow[],
    companyTaskPermits: (companyTaskPermitsResult.data ?? []) as CompanyTaskPermitTriggerRow[],
    companyTaskTraining: (companyTaskTrainingResult.data ?? []) as CompanyTaskTrainingRequirementRow[],
    trainingMatrixRequirements: (trainingMatrixResult.data ?? []) as CompanyTrainingMatrixRequirementRow[],
  };
}

async function loadLiveBucketReviewInputs(supabase: LiteClient, companyId: string, jobsiteId: string) {
  const [bucketItemsResult, trainingMatrixResult] = await Promise.all([
    supabase
      .from("company_bucket_items")
      .select("id, jobsite_id, bucket_key, source_module, source_id, bucket_payload, rule_results")
      .eq("company_id", companyId)
      .eq("jobsite_id", jobsiteId)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("company_training_matrix_requirements")
      .select("requirement_code, trade_codes, task_codes")
      .eq("company_id", companyId)
      .eq("active", true),
  ]);

  if (bucketItemsResult.error) throw new Error(bucketItemsResult.error.message || "Failed to load live work buckets.");
  if (trainingMatrixResult.error) throw new Error(trainingMatrixResult.error.message || "Failed to load training matrix requirements.");

  return {
    bucketItems: (bucketItemsResult.data ?? []) as BucketItemReviewRow[],
    trainingMatrixRequirements: (trainingMatrixResult.data ?? []) as CompanyTrainingMatrixRequirementRow[],
  };
}

export async function buildSafetyReviewPayload(params: {
  supabase: LiteClient;
  companyId: string;
  jobsiteId?: string | null;
}): Promise<SafetyReviewPayload> {
  const dbTemplates = await loadDbRuleTemplates({
    supabase: params.supabase,
    companyId: params.companyId,
    jobsiteId: params.jobsiteId ?? null,
  });
  const mergedTemplates = buildMergedTemplates(dbTemplates);

  if (params.jobsiteId) {
    const { bucketItems, trainingMatrixRequirements } = await loadLiveBucketReviewInputs(
      params.supabase,
      params.companyId,
      params.jobsiteId
    );

    const rows = sortRows(
      bucketItems
        .filter((row) => row.bucket_payload)
        .map((row) => {
          const rawInput = bucketToRawTaskInput(row.bucket_payload as BucketedWorkItem);
          const bucket = buildBucketedWorkItem(rawInput);
          const mergedRules =
            row.rule_results && typeof row.rule_results === "object"
              ? (row.rule_results as RulesEvaluation)
              : evaluateRules(rawInput, bucket, mergedTemplates);
          const baselineRules = evaluateRules(rawInput, bucket, STATIC_PLATFORM_RULE_TEMPLATES);
          return buildSafetyReviewRow({
            id: `live:${row.id}`,
            source: "live",
            scope: "jobsite",
            sourceLabel: humanizeCode(row.source_module),
            rawInput,
            mergedRules,
            baselineRules,
            applicableTrainingMatrixCodes: findApplicableTrainingMatrixCodes(rawInput, trainingMatrixRequirements),
          });
        })
    );

    const gaps = rows.flatMap((row) => row.gaps);
    return {
      scope: "jobsite",
      jobsiteId: params.jobsiteId,
      rowCount: rows.length,
      summary: {
        totalGaps: gaps.length,
        permitGaps: gaps.filter((gap) => gap.domain === "permit").length,
        trainingGaps: gaps.filter((gap) => gap.domain === "training").length,
        ppeGaps: gaps.filter((gap) => gap.domain === "ppe").length,
      },
      rows,
      warning: null,
    };
  }

  const {
    platformTrades,
    platformSubTrades,
    platformTasks,
    companyTrades,
    companySubTrades,
    companyTasks,
    companyTaskPermits,
    companyTaskTraining,
    trainingMatrixRequirements,
  } = await loadCompanyReviewInputs(params.supabase, params.companyId);

  const platformTradeById = new Map(platformTrades.map((row) => [row.id, row]));
  const platformSubTradeById = new Map(platformSubTrades.map((row) => [row.id, row]));
  const companyTradeById = new Map(companyTrades.map((row) => [row.id, row]));
  const companySubTradeById = new Map(companySubTrades.map((row) => [row.id, row]));
  const permitCodesByTaskId = new Map<string, string[]>();
  const trainingCodesByTaskId = new Map<string, string[]>();

  for (const row of companyTaskPermits) {
    const current = permitCodesByTaskId.get(row.company_task_id) ?? [];
    permitCodesByTaskId.set(row.company_task_id, dedupe([...current, row.permit_code]));
  }

  for (const row of companyTaskTraining) {
    const current = trainingCodesByTaskId.get(row.company_task_id) ?? [];
    trainingCodesByTaskId.set(row.company_task_id, dedupe([...current, row.requirement_code]));
  }

  const platformRows = platformTasks.map((task) => {
    const trade = task.trade_id ? platformTradeById.get(task.trade_id) : null;
    const subTrade = task.sub_trade_id ? platformSubTradeById.get(task.sub_trade_id) : null;
    const rawInput: RawTaskInput = {
      companyId: params.companyId,
      sourceModule: "manual",
      sourceId: `platform_task_${task.id}`,
      tradeCode: trade?.code ?? null,
      subTradeCode: subTrade?.code ?? null,
      taskCode: task.code,
      taskTitle: task.name,
      equipmentUsed: task.equipment_used ?? [],
      workConditions: task.work_conditions ?? [],
      hazardFamilies: (task.hazard_families ?? []) as RawTaskInput["hazardFamilies"],
      requiredControls: task.required_controls ?? [],
      permitTriggers: (task.permit_triggers ?? []) as PermitTriggerType[],
      trainingRequirementCodes: task.training_requirements ?? [],
      metadata: (task.metadata ?? {}) as JsonObject,
    };
    const bucket = buildBucketedWorkItem(rawInput);
    return buildSafetyReviewRow({
      id: `platform:${task.id}`,
      source: "platform",
      scope: "company",
      sourceLabel: trade ? `${trade.name} template` : "Platform template",
      rawInput,
      mergedRules: evaluateRules(rawInput, bucket, mergedTemplates),
      baselineRules: evaluateRules(rawInput, bucket, STATIC_PLATFORM_RULE_TEMPLATES),
      applicableTrainingMatrixCodes: findApplicableTrainingMatrixCodes(rawInput, trainingMatrixRequirements),
    });
  });

  const companyRows = companyTasks.map((task) => {
    const trade = task.company_trade_id ? companyTradeById.get(task.company_trade_id) : null;
    const subTrade = task.company_sub_trade_id ? companySubTradeById.get(task.company_sub_trade_id) : null;
    const rawInput: RawTaskInput = {
      companyId: params.companyId,
      jobsiteId: task.jobsite_id ?? null,
      sourceModule: "manual",
      sourceId: task.id,
      tradeCode: trade?.code ?? null,
      subTradeCode: subTrade?.code ?? null,
      taskCode: task.code ?? null,
      taskTitle: task.title,
      description: task.description ?? null,
      equipmentUsed: task.equipment_used ?? [],
      workConditions: task.work_conditions ?? [],
      hazardFamilies: (task.hazard_families ?? []) as RawTaskInput["hazardFamilies"],
      requiredControls: task.required_controls ?? [],
      permitTriggers: dedupe<PermitTriggerType>([
        ...((task.permit_triggers ?? []) as PermitTriggerType[]),
        ...((permitCodesByTaskId.get(task.id) ?? []) as PermitTriggerType[]),
      ]),
      trainingRequirementCodes: dedupe([
        ...(task.training_requirements ?? []),
        ...(trainingCodesByTaskId.get(task.id) ?? []),
      ]),
      workAreaLabel: task.work_area_label ?? null,
      startsAt: task.starts_at ?? null,
      endsAt: task.ends_at ?? null,
      metadata: (task.metadata ?? {}) as JsonObject,
    };
    const bucket = buildBucketedWorkItem(rawInput);
    return buildSafetyReviewRow({
      id: `company:${task.id}`,
      source: "company",
      scope: "company",
      sourceLabel: trade ? `${trade.name} task` : "Company task",
      rawInput,
      mergedRules: evaluateRules(rawInput, bucket, mergedTemplates),
      baselineRules: evaluateRules(rawInput, bucket, STATIC_PLATFORM_RULE_TEMPLATES),
      applicableTrainingMatrixCodes: findApplicableTrainingMatrixCodes(rawInput, trainingMatrixRequirements),
    });
  });

  const rows = sortRows([...companyRows, ...platformRows]);
  const gaps = rows.flatMap((row) => row.gaps);

  return {
    scope: "company",
    jobsiteId: null,
    rowCount: rows.length,
    summary: {
      totalGaps: gaps.length,
      permitGaps: gaps.filter((gap) => gap.domain === "permit").length,
      trainingGaps: gaps.filter((gap) => gap.domain === "training").length,
      ppeGaps: gaps.filter((gap) => gap.domain === "ppe").length,
    },
    rows,
    warning: null,
  };
}
