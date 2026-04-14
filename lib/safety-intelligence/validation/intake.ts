import type { HazardFamily, PermitTriggerType, RawTaskInput } from "@/types/safety-intelligence";
import { HAZARD_FAMILIES, PERMIT_TRIGGER_TYPES } from "@/lib/safety-intelligence/types";
import { asStringArray, ensureJsonObject, ensureOptionalString, ensureString, isRecord } from "@/lib/safety-intelligence/validation/common";

function normalizeHazards(input: string[]): HazardFamily[] {
  const valid = new Set<HazardFamily>(HAZARD_FAMILIES);
  return input
    .map((item) => item.trim().toLowerCase() as HazardFamily)
    .filter((item) => valid.has(item));
}

function normalizePermits(input: string[]): PermitTriggerType[] {
  const valid = new Set<PermitTriggerType>(PERMIT_TRIGGER_TYPES);
  return input
    .map((item) => item.trim().toLowerCase() as PermitTriggerType)
    .filter((item) => valid.has(item));
}

export function parseRawTaskInput(value: unknown): RawTaskInput {
  if (!isRecord(value)) {
    throw new Error("Task intake payload must be an object.");
  }

  return {
    companyId: ensureString(value.companyId, "companyId"),
    jobsiteId: ensureOptionalString(value.jobsiteId),
    sourceModule: (String(value.sourceModule ?? "manual").trim() ||
      "manual") as RawTaskInput["sourceModule"],
    sourceId: ensureOptionalString(value.sourceId),
    operationId: ensureOptionalString(value.operationId),
    tradeCode: ensureOptionalString(value.tradeCode),
    subTradeCode: ensureOptionalString(value.subTradeCode),
    taskCode: ensureOptionalString(value.taskCode),
    taskTitle: ensureString(value.taskTitle, "taskTitle"),
    description: ensureOptionalString(value.description),
    equipmentUsed: asStringArray(value.equipmentUsed),
    workConditions: asStringArray(value.workConditions),
    hazardFamilies: normalizeHazards(asStringArray(value.hazardFamilies)),
    hazardCategories: asStringArray(value.hazardCategories),
    requiredControls: asStringArray(value.requiredControls),
    permitTriggers: normalizePermits(asStringArray(value.permitTriggers)),
    ppeRequirements: asStringArray(value.ppeRequirements),
    trainingRequirementCodes: asStringArray(value.trainingRequirementCodes),
    siteRestrictions: asStringArray(value.siteRestrictions),
    prohibitedEquipment: asStringArray(value.prohibitedEquipment),
    workAreaLabel: ensureOptionalString(value.workAreaLabel),
    locationGrid: ensureOptionalString(value.locationGrid),
    weatherConditionCode: ensureOptionalString(value.weatherConditionCode),
    startsAt: ensureOptionalString(value.startsAt),
    endsAt: ensureOptionalString(value.endsAt),
    crewSize: value.crewSize == null ? null : Number(value.crewSize),
    metadata: ensureJsonObject(value.metadata),
  };
}
