import type { AiReviewContext, BucketedWorkItem, JsonObject, RawTaskInput } from "@/types/safety-intelligence";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { detectConflicts } from "@/lib/safety-intelligence/conflicts";
import { evaluateRules } from "@/lib/safety-intelligence/rules";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function jsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function bucketToRawTaskInput(bucket: BucketedWorkItem): RawTaskInput {
  const payload = jsonObject(bucket.payload);
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
    hazardCategories: stringArray(payload.hazardCategories),
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
    metadata: jsonObject(payload.metadata),
  };
}

export function buildAiReviewContext(params: {
  input: RawTaskInput;
  bucket: BucketedWorkItem;
  peerBuckets?: BucketedWorkItem[];
  riskMemorySummary?: JsonObject | null;
  companyContext?: JsonObject | null;
  templateContext?: JsonObject | null;
}) {
  const bucket = params.bucket ?? buildBucketedWorkItem(params.input);
  const allBuckets = [
    bucket,
    ...(params.peerBuckets ?? []).filter((candidate) => candidate.bucketKey !== bucket.bucketKey),
  ];
  const rules = evaluateRules(params.input, bucket);
  const allRules = allBuckets.map((candidate) =>
    candidate.bucketKey === bucket.bucketKey ? rules : evaluateRules(bucketToRawTaskInput(candidate), candidate)
  );
  const conflicts = detectConflicts(bucket, rules, allBuckets, allRules);
  const context: AiReviewContext = {
    companyId: params.input.companyId,
    jobsiteId: params.input.jobsiteId ?? null,
    buckets: allBuckets,
    rulesEvaluations: allRules,
    conflictEvaluations: [conflicts],
    riskMemorySummary: params.riskMemorySummary ?? null,
    companyContext: params.companyContext ?? null,
    templateContext: params.templateContext ?? null,
  };
  return { bucket, rules, conflicts, context };
}
