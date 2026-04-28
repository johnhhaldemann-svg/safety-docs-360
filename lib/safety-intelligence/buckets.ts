import type { BucketedWorkItem, RawTaskInput } from "@/types/safety-intelligence";
import { buildBucketKey } from "@/lib/safety-intelligence/validation/buckets";

export const BUCKET_SCHEMA_VERSION = 1 as const;

export function buildBucketedWorkItem(input: RawTaskInput): BucketedWorkItem {
  return {
    bucketKey: buildBucketKey(input),
    bucketType:
      input.sourceModule === "company_incident"
        ? "incident_signal"
        : input.sourceModule === "company_permit"
          ? "permit_context"
          : "task_execution",
    companyId: input.companyId,
    jobsiteId: input.jobsiteId,
    operationId: input.operationId ?? null,
    taskTitle: input.taskTitle,
    tradeCode: input.tradeCode ?? null,
    subTradeCode: input.subTradeCode ?? null,
    taskCode: input.taskCode ?? null,
    workAreaLabel: input.workAreaLabel ?? null,
    locationGrid: input.locationGrid ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    weatherConditionCode: input.weatherConditionCode ?? null,
    equipmentUsed: input.equipmentUsed ?? [],
    workConditions: input.workConditions ?? [],
    siteRestrictions: input.siteRestrictions ?? [],
    prohibitedEquipment: input.prohibitedEquipment ?? [],
    hazardFamilies: input.hazardFamilies ?? [],
    permitTriggers: input.permitTriggers ?? [],
    requiredControls: input.requiredControls ?? [],
    ppeRequirements: input.ppeRequirements ?? [],
    trainingRequirementCodes: input.trainingRequirementCodes ?? [],
    payload: {
      bucketSchemaVersion: BUCKET_SCHEMA_VERSION,
      description: input.description ?? null,
      equipmentUsed: input.equipmentUsed ?? [],
      workConditions: input.workConditions ?? [],
      hazardCategories: input.hazardCategories ?? [],
      ppeRequirements: input.ppeRequirements ?? [],
      siteRestrictions: input.siteRestrictions ?? [],
      prohibitedEquipment: input.prohibitedEquipment ?? [],
      crewSize: input.crewSize ?? null,
      metadata: input.metadata ?? {},
    },
    source: {
      module: input.sourceModule,
      id: input.sourceId ?? null,
    },
  };
}
