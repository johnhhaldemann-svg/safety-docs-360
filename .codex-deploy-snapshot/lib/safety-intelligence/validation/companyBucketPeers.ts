import type {
  BucketedWorkItem,
  ConflictSeverity,
  JsonObject,
  RawTaskInput,
  RuleSourceType,
  RulesEvaluation,
  RulesFinding,
  RiskBand,
} from "@/types/safety-intelligence";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function coerceJsonObject(value: unknown): JsonObject {
  if (isRecord(value)) return value as JsonObject;
  return {};
}

const BUCKET_TYPES = new Set<BucketedWorkItem["bucketType"]>(["task_execution", "permit_context", "incident_signal"]);

const SOURCE_MODULES = new Set<RawTaskInput["sourceModule"]>([
  "manual",
  "company_jsa_activity",
  "company_permit",
  "company_incident",
]);

const RISK_BANDS = new Set<RiskBand>(["low", "moderate", "high", "critical"]);

const CONFLICT_SEVERITIES = new Set<ConflictSeverity>(["low", "medium", "high", "critical"]);

const RULE_REQUIREMENT_TYPES = new Set<RulesFinding["requirementType"]>([
  "permit_trigger",
  "hazard_family",
  "hazard_category",
  "ppe_requirement",
  "equipment_check",
  "weather_restriction",
  "required_control",
  "training_requirement",
  "site_restriction",
  "prohibited_equipment",
]);

function parseRulesFinding(value: unknown): RulesFinding | null {
  if (!isRecord(value)) return null;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const detail = typeof value.detail === "string" ? value.detail.trim() : "";
  const severity = value.severity;
  if (!code || !label || !detail || !CONFLICT_SEVERITIES.has(severity as ConflictSeverity)) return null;
  const requirementType = value.requirementType;
  if (!RULE_REQUIREMENT_TYPES.has(requirementType as RulesFinding["requirementType"])) return null;
  return {
    code,
    label,
    severity: severity as ConflictSeverity,
    detail,
    requirementType: requirementType as RulesFinding["requirementType"],
    requirementCode:
      typeof value.requirementCode === "string" || value.requirementCode === null || value.requirementCode === undefined
        ? (value.requirementCode as string | null | undefined) ?? null
        : null,
    sourceType:
      value.sourceType === "platform" ||
      value.sourceType === "company" ||
      value.sourceType === "jobsite" ||
      value.sourceType === "input"
        ? value.sourceType
        : undefined,
    sourceRuleCode:
      typeof value.sourceRuleCode === "string" || value.sourceRuleCode === null || value.sourceRuleCode === undefined
        ? (value.sourceRuleCode as string | null | undefined) ?? null
        : null,
    metadata: isRecord(value.metadata) ? (value.metadata as JsonObject) : undefined,
  };
}

function parseRulesFindings(value: unknown): RulesFinding[] {
  if (!Array.isArray(value)) return [];
  const out: RulesFinding[] = [];
  for (const item of value) {
    const parsed = parseRulesFinding(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseSourceBreakdown(value: unknown): RulesEvaluation["sourceBreakdown"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: NonNullable<RulesEvaluation["sourceBreakdown"]> = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const sourceType = item.sourceType;
    if (
      sourceType !== "platform" &&
      sourceType !== "company" &&
      sourceType !== "jobsite" &&
      sourceType !== "input"
    ) {
      continue;
    }
    rows.push({
      sourceType: sourceType as RuleSourceType,
      sourceId: optionalStringOrNull(item.sourceId),
      ruleCodes: coerceStringArray(item.ruleCodes),
    });
  }
  return rows.length ? rows : undefined;
}

/**
 * Validates JSON previously stored as `company_bucket_items.bucket_payload`.
 * Rejects rows that would throw in conflict detection (e.g. missing `taskTitle` string).
 */
export function parseBucketedWorkItemPayload(value: unknown): BucketedWorkItem | null {
  if (!isRecord(value)) return null;
  const bucketKey = typeof value.bucketKey === "string" ? value.bucketKey.trim() : "";
  const companyId = typeof value.companyId === "string" ? value.companyId.trim() : "";
  if (!bucketKey || !companyId) return null;
  if (typeof value.taskTitle !== "string") return null;

  const bucketType =
    typeof value.bucketType === "string" && BUCKET_TYPES.has(value.bucketType as BucketedWorkItem["bucketType"])
      ? (value.bucketType as BucketedWorkItem["bucketType"])
      : "task_execution";

  if (!isRecord(value.source)) return null;
  const sourceModule = value.source.module;
  if (typeof sourceModule !== "string" || !SOURCE_MODULES.has(sourceModule as RawTaskInput["sourceModule"]))
    return null;

  return {
    bucketKey,
    bucketType,
    companyId,
    jobsiteId: optionalStringOrNull(value.jobsiteId),
    operationId: optionalStringOrNull(value.operationId),
    taskTitle: value.taskTitle,
    tradeCode: optionalStringOrNull(value.tradeCode),
    subTradeCode: optionalStringOrNull(value.subTradeCode),
    taskCode: optionalStringOrNull(value.taskCode),
    workAreaLabel: optionalStringOrNull(value.workAreaLabel),
    locationGrid: optionalStringOrNull(value.locationGrid),
    startsAt: optionalStringOrNull(value.startsAt),
    endsAt: optionalStringOrNull(value.endsAt),
    weatherConditionCode: optionalStringOrNull(value.weatherConditionCode),
    equipmentUsed: coerceStringArray(value.equipmentUsed),
    workConditions: coerceStringArray(value.workConditions),
    siteRestrictions: coerceStringArray(value.siteRestrictions),
    prohibitedEquipment: coerceStringArray(value.prohibitedEquipment),
    hazardFamilies: coerceStringArray(value.hazardFamilies) as BucketedWorkItem["hazardFamilies"],
    permitTriggers: coerceStringArray(value.permitTriggers) as BucketedWorkItem["permitTriggers"],
    requiredControls: coerceStringArray(value.requiredControls),
    ppeRequirements: coerceStringArray(value.ppeRequirements),
    trainingRequirementCodes: coerceStringArray(value.trainingRequirementCodes),
    payload: coerceJsonObject(value.payload),
    source: {
      module: sourceModule as RawTaskInput["sourceModule"],
      id: optionalStringOrNull(value.source.id),
    },
  };
}

/**
 * Validates JSON previously stored as `company_bucket_items.rule_results`.
 */
export function parseRulesEvaluationPayload(value: unknown): RulesEvaluation | null {
  if (!isRecord(value)) return null;
  const bucketKey = typeof value.bucketKey === "string" ? value.bucketKey.trim() : "";
  if (!bucketKey) return null;
  const score = typeof value.score === "number" && Number.isFinite(value.score) ? value.score : 0;
  const band =
    typeof value.band === "string" && RISK_BANDS.has(value.band as RiskBand) ? (value.band as RiskBand) : "low";
  const evaluationVersion =
    typeof value.evaluationVersion === "string" && value.evaluationVersion.trim()
      ? value.evaluationVersion.trim()
      : "legacy";

  return {
    bucketKey,
    operationId: optionalStringOrNull(value.operationId),
    findings: parseRulesFindings(value.findings),
    permitTriggers: coerceStringArray(value.permitTriggers) as RulesEvaluation["permitTriggers"],
    hazardFamilies: coerceStringArray(value.hazardFamilies) as RulesEvaluation["hazardFamilies"],
    hazardCategories: coerceStringArray(value.hazardCategories),
    ppeRequirements: coerceStringArray(value.ppeRequirements),
    equipmentChecks: coerceStringArray(value.equipmentChecks),
    weatherRestrictions: coerceStringArray(value.weatherRestrictions),
    requiredControls: coerceStringArray(value.requiredControls),
    siteRestrictions: coerceStringArray(value.siteRestrictions),
    prohibitedEquipment: coerceStringArray(value.prohibitedEquipment),
    trainingRequirements: coerceStringArray(value.trainingRequirements),
    score,
    band,
    evaluationVersion,
    sourceBreakdown: parseSourceBreakdown(value.sourceBreakdown),
  };
}

/**
 * One persisted `company_bucket_items` row: keep bucket + rules aligned and drop corrupt peers.
 */
export function parseCompanyBucketItemPeerRow(
  row: unknown
): { bucket: BucketedWorkItem; rules: RulesEvaluation } | null {
  if (!isRecord(row)) return null;
  const bucket = parseBucketedWorkItemPayload(row.bucket_payload);
  const rules = parseRulesEvaluationPayload(row.rule_results);
  if (!bucket || !rules) return null;
  if (rules.bucketKey !== bucket.bucketKey) return null;
  return { bucket, rules };
}
