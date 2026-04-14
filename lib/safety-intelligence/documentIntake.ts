import { buildCsepTradeSelection } from "@/lib/csepTradeSelection";
import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import { buildCsepProgramSelections, normalizeProgramSelections } from "@/lib/csepPrograms";
import type { CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue } from "@/types/csep-programs";
import type {
  HazardFamily,
  JsonObject,
  PermitTriggerType,
  RawTaskInput,
  SafetyPlanDocumentType,
  SafetyPlanGenerationContext,
  SafetyPlanOperationInput,
} from "@/types/safety-intelligence";
import { asStringArray, ensureJsonObject, ensureOptionalString, isRecord } from "@/lib/safety-intelligence/validation/common";

type CSEPRiskItemLike = Pick<CSEPRiskItem, "activity" | "hazard" | "controls" | "permit">;

function slugify(value: string, fallback: string) {
  const next = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return next || fallback;
}

function normalizePermitHint(value: string): PermitTriggerType[] {
  const token = value.trim().toLowerCase();
  if (!token) return [];
  if (token.includes("hot work")) return ["hot_work_permit"];
  if (token.includes("confined")) return ["confined_space_permit"];
  if (token.includes("loto") || token.includes("electrical")) {
    return ["energized_electrical_permit"];
  }
  if (token.includes("excavat") || token.includes("groundbreaking")) {
    return ["excavation_permit"];
  }
  if (token.includes("lift") || token.includes("crane")) return ["lift_plan"];
  if (token.includes("height") || token.includes("ladder") || token.includes("mewp")) {
    return ["elevated_work_notice"];
  }
  return [];
}

function normalizeHazardHint(value: string): HazardFamily[] {
  const token = value.trim().toLowerCase();
  if (!token) return [];
  if (token.includes("electrical")) return ["electrical"];
  if (token.includes("hot work") || token.includes("fire")) return ["hot_work", "fire"];
  if (token.includes("excavat") || token.includes("trench")) return ["excavation", "collapse"];
  if (token.includes("confined")) return ["unknown"];
  if (token.includes("fall")) return ["fall"];
  if (token.includes("crane") || token.includes("lift")) return ["overhead_work", "struck_by"];
  if (token.includes("chemical")) return ["fumes"];
  if (token.includes("struck")) return ["struck_by"];
  if (token.includes("slip") || token.includes("trip")) return ["line_of_fire"];
  return ["unknown"];
}

function extractSiteRestrictions(values: string[]) {
  const restrictions = new Set<string>();

  for (const value of values) {
    const text = value.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (lower.includes("no a-frame ladder") || lower.includes("no a frame ladder")) {
      restrictions.add("No A-frame ladders.");
    }
    if (lower.includes("no ladder")) {
      restrictions.add("Ladder use restricted by site conditions.");
    }
    if (lower.includes("prohibit")) {
      restrictions.add(text);
    }
  }

  return [...restrictions];
}

function makeOperationId(documentType: SafetyPlanDocumentType, index: number, label: string) {
  return `${documentType}_${index + 1}_${slugify(label, "operation")}`;
}

function normalizeOperation(input: SafetyPlanOperationInput): SafetyPlanOperationInput {
  return {
    ...input,
    tradeCode: ensureOptionalString(input.tradeCode),
    tradeLabel: ensureOptionalString(input.tradeLabel),
    subTradeCode: ensureOptionalString(input.subTradeCode),
    subTradeLabel: ensureOptionalString(input.subTradeLabel),
    taskCode: ensureOptionalString(input.taskCode),
    description: ensureOptionalString(input.description),
    equipmentUsed: asStringArray(input.equipmentUsed),
    workConditions: asStringArray(input.workConditions),
    hazardHints: (input.hazardHints ?? []).filter(Boolean) as HazardFamily[],
    requiredControlHints: asStringArray(input.requiredControlHints),
    permitHints: (input.permitHints ?? []).filter(Boolean) as PermitTriggerType[],
    ppeHints: asStringArray(input.ppeHints),
    workAreaLabel: ensureOptionalString(input.workAreaLabel),
    locationGrid: ensureOptionalString(input.locationGrid),
    locationLabel: ensureOptionalString(input.locationLabel),
    weatherConditionCode: ensureOptionalString(input.weatherConditionCode),
    startsAt: ensureOptionalString(input.startsAt),
    endsAt: ensureOptionalString(input.endsAt),
    crewSize: typeof input.crewSize === "number" && Number.isFinite(input.crewSize) ? input.crewSize : null,
    metadata: ensureJsonObject(input.metadata),
  };
}

function ensureOperations(context: SafetyPlanGenerationContext) {
  if (context.operations.length > 0) return context;

  const fallbackLabel = context.scope.tasks[0] || context.scope.trades[0] || context.project.projectName;
  return {
    ...context,
    operations: [
      {
        operationId: makeOperationId(context.documentProfile.documentType, 0, fallbackLabel),
        tradeCode: context.scope.trades[0] ? slugify(context.scope.trades[0], "trade") : null,
        tradeLabel: context.scope.trades[0] ?? null,
        subTradeCode: context.scope.subTrades[0] ? slugify(context.scope.subTrades[0], "sub_trade") : null,
        subTradeLabel: context.scope.subTrades[0] ?? null,
        taskCode: context.scope.tasks[0] ? slugify(context.scope.tasks[0], "task") : null,
        taskTitle: fallbackLabel,
        description: null,
        equipmentUsed: [...context.scope.equipment],
        workConditions: [...context.siteContext.workConditions],
        hazardHints: [],
        requiredControlHints: [],
        permitHints: [],
        ppeHints: [],
        workAreaLabel: null,
        locationGrid: null,
        locationLabel: context.siteContext.location ?? context.project.projectAddress ?? null,
        weatherConditionCode: context.siteContext.weather?.conditionCode ?? null,
        startsAt: context.scope.schedule?.startAt ?? null,
        endsAt: context.scope.schedule?.endAt ?? null,
        crewSize: null,
        metadata: {},
      },
    ],
  };
}

export function buildCsepGenerationContext(formData: Record<string, unknown>): SafetyPlanGenerationContext {
  const tradeLabel = String(formData.trade ?? "").trim();
  const subTradeLabel = String(formData.subTrade ?? "").trim();
  const tasks = asStringArray(formData.tasks);
  const tradeSelection =
    tradeLabel && subTradeLabel ? buildCsepTradeSelection(tradeLabel, subTradeLabel, tasks) : null;
  const requiredPpe = asStringArray(formData.required_ppe);
  const selectedHazards = asStringArray(formData.selected_hazards);
  const additionalPermits = asStringArray(formData.additional_permits);
  const programSubtypeSelections =
    isRecord(formData.program_subtype_selections)
      ? (Object.fromEntries(
          Object.entries(formData.program_subtype_selections).filter(
            ([, value]) => typeof value === "string" && value.trim()
          )
        ) as Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>)
      : {};
  const siteNotes = String(formData.site_specific_notes ?? "").trim();
  const scopeOfWork = String(formData.scope_of_work ?? "").trim();
  const workConditions = [scopeOfWork, siteNotes].filter(Boolean);
  const tradeItems = Array.isArray((formData as { tradeItems?: unknown }).tradeItems)
    ? (((formData as { tradeItems?: unknown[] }).tradeItems ?? []).filter(isRecord) as Array<
        CSEPRiskItemLike
      >)
    : tradeSelection?.items ?? [];
  const selectedPermits = [...new Set([...additionalPermits, ...asStringArray(formData.derivedPermits)])];
  const explicitProgramSelections = Array.isArray((formData as { programSelections?: unknown }).programSelections)
    ? normalizeProgramSelections(
        ((formData as { programSelections?: unknown[] }).programSelections ?? [])
          .filter(isRecord)
          .map((item) => ({
            category: String(item.category ?? "") as "hazard" | "permit" | "ppe",
            item: String(item.item ?? ""),
            subtype:
              typeof item.subtype === "string" && item.subtype.trim()
                ? (item.subtype as CSEPProgramSubtypeValue)
                : null,
            relatedTasks: asStringArray(item.relatedTasks),
            source:
              typeof item.source === "string" && item.source.trim()
                ? (item.source as "selected" | "derived" | "default")
                : "selected",
          }))
      )
    : [];
  const programSelections =
    explicitProgramSelections.length > 0
      ? explicitProgramSelections
      : buildCsepProgramSelections({
          selectedHazards,
          selectedPermits,
          selectedPpe: requiredPpe,
          tradeItems: tradeItems.map((item) => ({
            activity: String(item.activity ?? ""),
            hazard: String(item.hazard ?? ""),
            risk: "Medium",
            controls: asStringArray(item.controls),
            permit: String(item.permit ?? ""),
          })),
          selectedTasks: tasks,
          subtypeSelections: programSubtypeSelections,
        }).selections;
  const derivedOperations = (tasks.length ? tasks : [scopeOfWork || tradeLabel || "project work"]).map(
    (taskTitle, index) => {
      const riskItem = tradeSelection?.items.find((item) => item.activity === taskTitle);
      return normalizeOperation({
        operationId: makeOperationId("csep", index, taskTitle),
        tradeCode: tradeSelection?.tradeCode ?? (tradeLabel ? slugify(tradeLabel, "trade") : null),
        tradeLabel: tradeSelection?.tradeLabel ?? (tradeLabel || null),
        subTradeCode: tradeSelection?.subTradeCode ?? (subTradeLabel ? slugify(subTradeLabel, "sub_trade") : null),
        subTradeLabel: tradeSelection?.subTradeLabel ?? (subTradeLabel || null),
        taskCode: slugify(taskTitle, "task"),
        taskTitle,
        description: scopeOfWork || null,
        equipmentUsed: [],
        workConditions,
        hazardHints: riskItem?.hazard ? normalizeHazardHint(riskItem.hazard) : [],
        requiredControlHints: riskItem?.controls ?? [],
        permitHints: riskItem?.permit ? normalizePermitHint(riskItem.permit) : [],
        ppeHints: requiredPpe,
        workAreaLabel: null,
        locationGrid: null,
        locationLabel: String(formData.project_address ?? "").trim() || null,
        weatherConditionCode: null,
        startsAt: null,
        endsAt: null,
        crewSize: null,
        metadata: {
          tradeSummary: String(formData.tradeSummary ?? "").trim(),
          oshaRefs: asStringArray(formData.oshaRefs),
          selectedHazards,
          additionalPermits,
          programSelections,
        },
      });
    }
  );

  return ensureOperations({
    project: {
      projectName: String(formData.project_name ?? "").trim(),
      projectNumber: ensureOptionalString(formData.project_number),
      projectAddress: ensureOptionalString(formData.project_address),
      ownerClient: ensureOptionalString(formData.owner_client),
      gcCm: ensureOptionalString(formData.gc_cm),
      contractorCompany: ensureOptionalString(formData.contractor_company),
      contractorContact: ensureOptionalString(formData.contractor_contact),
      contractorPhone: ensureOptionalString(formData.contractor_phone),
      contractorEmail: ensureOptionalString(formData.contractor_email),
    },
    scope: {
      trades: tradeLabel ? [tradeLabel] : [],
      subTrades: subTradeLabel ? [subTradeLabel] : [],
      tasks,
      equipment: [],
      location: ensureOptionalString(formData.project_address),
      schedule: {
        startAt: null,
        endAt: null,
        label: null,
      },
    },
    operations: derivedOperations,
    siteContext: {
      location: ensureOptionalString(formData.project_address),
      workConditions,
      siteRestrictions: extractSiteRestrictions([siteNotes]),
      simultaneousOperations: [],
      weather: {
        conditionCode: null,
        summary: null,
      },
      metadata: {
        emergencyProcedures: String(formData.emergency_procedures ?? "").trim() || null,
      },
    },
    programSelections,
    documentProfile: {
      documentType: "csep",
      requestedLabel: "CSEP",
      title: null,
      source: "builder_submit",
    },
    legacyFormSnapshot: formData as JsonObject,
  });
}

export function buildPshsepGenerationContext(formData: Record<string, unknown>): SafetyPlanGenerationContext {
  const selectedScopes = asStringArray(formData.scope_of_work_selected);
  const permitLabels = asStringArray(formData.permits_selected);
  const projectDescription = String(formData.project_description ?? "").trim();
  const emergencyMap = isRecord(formData.emergency_map) ? formData.emergency_map : {};
  const location = String(formData.project_address ?? "").trim();
  const workConditions = [projectDescription].filter(Boolean);
  const operations = (selectedScopes.length ? selectedScopes : [projectDescription || "project execution"]).map(
    (scopeLabel, index) =>
      normalizeOperation({
        operationId: makeOperationId("pshsep", index, scopeLabel),
        tradeCode: slugify(scopeLabel, "scope"),
        tradeLabel: scopeLabel,
        subTradeCode: null,
        subTradeLabel: null,
        taskCode: slugify(scopeLabel, "scope"),
        taskTitle: scopeLabel,
        description: projectDescription || null,
        equipmentUsed: [],
        workConditions,
        hazardHints: [],
        requiredControlHints: [],
        permitHints: permitLabels.flatMap((permit) => normalizePermitHint(permit)),
        ppeHints: [],
        workAreaLabel: null,
        locationGrid: null,
        locationLabel: location || null,
        weatherConditionCode: null,
        startsAt: null,
        endsAt: null,
        crewSize: null,
        metadata: {
          permitLabels,
          orientationRequired: Boolean(formData.orientation_required),
          liftPlansRequired: Boolean(formData.lift_plans_required),
          criticalLiftReviewRequired: Boolean(formData.critical_lift_review_required),
        },
      })
  );

  return ensureOperations({
    project: {
      projectName: String(formData.project_name ?? "").trim(),
      projectNumber: ensureOptionalString(formData.project_number),
      projectAddress: location || null,
      ownerClient: ensureOptionalString(formData.owner_client),
      gcCm: ensureOptionalString(formData.gc_cm),
      contractorCompany: ensureOptionalString(formData.company_name),
      contractorContact: null,
      contractorPhone: null,
      contractorEmail: null,
    },
    scope: {
      trades: selectedScopes,
      subTrades: [],
      tasks: selectedScopes,
      equipment: [],
      location: location || null,
      schedule: {
        startAt: null,
        endAt: null,
        label: null,
      },
    },
    operations,
    siteContext: {
      location: location || null,
      workConditions,
      siteRestrictions: extractSiteRestrictions([projectDescription]),
      simultaneousOperations: [],
      weather: {
        conditionCode: null,
        summary: null,
      },
      metadata: {
        emergencyMap: ensureJsonObject(emergencyMap),
      },
    },
    documentProfile: {
      documentType: "pshsep",
      requestedLabel: "PESHEP",
      title: null,
      source: "builder_submit",
    },
    legacyFormSnapshot: formData as JsonObject,
  });
}

function normalizeGenerationContext(
  raw: Record<string, unknown>,
  documentType: SafetyPlanDocumentType
): SafetyPlanGenerationContext {
  const project = isRecord(raw.project) ? raw.project : {};
  const scope = isRecord(raw.scope) ? raw.scope : {};
  const siteContext = isRecord(raw.siteContext) ? raw.siteContext : {};
  const documentProfile = isRecord(raw.documentProfile) ? raw.documentProfile : {};
  const operations = Array.isArray(raw.operations)
    ? raw.operations.filter(isRecord).map((row) => normalizeOperation(row as SafetyPlanOperationInput))
    : [];
  const programSelections = Array.isArray(raw.programSelections)
    ? normalizeProgramSelections(
        raw.programSelections
          .filter(isRecord)
          .map((item) => ({
            category: String(item.category ?? "") as "hazard" | "permit" | "ppe",
            item: String(item.item ?? ""),
            subtype:
              typeof item.subtype === "string" && item.subtype.trim()
                ? (item.subtype as CSEPProgramSubtypeValue)
                : null,
            relatedTasks: asStringArray(item.relatedTasks),
            source:
              typeof item.source === "string" && item.source.trim()
                ? (item.source as "selected" | "derived" | "default")
                : "selected",
          }))
      )
    : [];
  const weather = isRecord(siteContext.weather) ? siteContext.weather : {};
  const schedule = isRecord(scope.schedule) ? scope.schedule : {};

  return ensureOperations({
    project: {
      projectName: String(project.projectName ?? project.project_name ?? "").trim(),
      projectNumber: ensureOptionalString(project.projectNumber ?? project.project_number),
      projectAddress: ensureOptionalString(project.projectAddress ?? project.project_address),
      ownerClient: ensureOptionalString(project.ownerClient ?? project.owner_client),
      gcCm: ensureOptionalString(project.gcCm ?? project.gc_cm),
      contractorCompany: ensureOptionalString(project.contractorCompany ?? project.contractor_company),
      contractorContact: ensureOptionalString(project.contractorContact ?? project.contractor_contact),
      contractorPhone: ensureOptionalString(project.contractorPhone ?? project.contractor_phone),
      contractorEmail: ensureOptionalString(project.contractorEmail ?? project.contractor_email),
    },
    scope: {
      trades: asStringArray(scope.trades),
      subTrades: asStringArray(scope.subTrades),
      tasks: asStringArray(scope.tasks),
      equipment: asStringArray(scope.equipment),
      location: ensureOptionalString(scope.location),
      schedule: {
        startAt: ensureOptionalString(schedule.startAt),
        endAt: ensureOptionalString(schedule.endAt),
        label: ensureOptionalString(schedule.label),
      },
    },
    operations,
    siteContext: {
      jobsiteId: ensureOptionalString(siteContext.jobsiteId),
      location: ensureOptionalString(siteContext.location),
      workConditions: asStringArray(siteContext.workConditions),
      siteRestrictions: asStringArray(siteContext.siteRestrictions),
      simultaneousOperations: asStringArray(siteContext.simultaneousOperations),
      weather: {
        conditionCode: ensureOptionalString(weather.conditionCode),
        summary: ensureOptionalString(weather.summary),
      },
      metadata: ensureJsonObject(siteContext.metadata),
    },
    programSelections,
    documentProfile: {
      documentType,
      requestedLabel: ensureOptionalString(documentProfile.requestedLabel),
      title: ensureOptionalString(documentProfile.title),
      companyId: ensureOptionalString(documentProfile.companyId),
      jobsiteId: ensureOptionalString(documentProfile.jobsiteId),
      source: (String(documentProfile.source ?? "api").trim() || "api") as SafetyPlanGenerationContext["documentProfile"]["source"],
    },
    legacyFormSnapshot: ensureJsonObject(raw.legacyFormSnapshot),
  });
}

export function ensureSafetyPlanGenerationContext(params: {
  documentType: SafetyPlanDocumentType;
  formData: Record<string, unknown>;
  companyId?: string | null;
  jobsiteId?: string | null;
}): SafetyPlanGenerationContext {
  const rawContext = isRecord(params.formData.generationContext)
    ? normalizeGenerationContext(params.formData.generationContext, params.documentType)
    : params.documentType === "csep"
      ? buildCsepGenerationContext(params.formData)
      : buildPshsepGenerationContext(params.formData);

  return {
    ...rawContext,
    siteContext: {
      ...rawContext.siteContext,
      jobsiteId: params.jobsiteId ?? rawContext.siteContext.jobsiteId ?? null,
    },
    documentProfile: {
      ...rawContext.documentProfile,
      documentType: params.documentType,
      companyId: params.companyId ?? rawContext.documentProfile.companyId ?? null,
      jobsiteId: params.jobsiteId ?? rawContext.documentProfile.jobsiteId ?? null,
    },
    legacyFormSnapshot: {
      ...ensureJsonObject(params.formData),
      ...(rawContext.legacyFormSnapshot ?? {}),
    },
  };
}

export function buildRawTaskInputsFromGenerationContext(
  context: SafetyPlanGenerationContext,
  companyId: string
): RawTaskInput[] {
  return context.operations.map((operation) => ({
    companyId,
    jobsiteId: context.siteContext.jobsiteId ?? context.documentProfile.jobsiteId ?? null,
    sourceModule: "manual",
    sourceId: null,
    operationId: operation.operationId,
    tradeCode: operation.tradeCode ?? null,
    subTradeCode: operation.subTradeCode ?? null,
    taskCode: operation.taskCode ?? null,
    taskTitle: operation.taskTitle,
    description: operation.description ?? null,
    equipmentUsed: operation.equipmentUsed,
    workConditions: [...new Set([...operation.workConditions, ...context.siteContext.workConditions])],
    hazardFamilies: operation.hazardHints,
    hazardCategories: operation.hazardHints.map((hazard) => hazard.replace(/_/g, " ")),
    requiredControls: operation.requiredControlHints,
    permitTriggers: operation.permitHints,
    ppeRequirements: operation.ppeHints,
    trainingRequirementCodes: [],
    siteRestrictions: context.siteContext.siteRestrictions,
    prohibitedEquipment: [],
    workAreaLabel: operation.workAreaLabel ?? null,
    locationGrid: operation.locationGrid ?? null,
    weatherConditionCode: operation.weatherConditionCode ?? context.siteContext.weather?.conditionCode ?? null,
    startsAt: operation.startsAt ?? context.scope.schedule?.startAt ?? null,
    endsAt: operation.endsAt ?? context.scope.schedule?.endAt ?? null,
    crewSize: operation.crewSize ?? null,
    metadata: {
      ...ensureJsonObject(operation.metadata),
      documentProfile: context.documentProfile,
      locationLabel: operation.locationLabel ?? context.siteContext.location ?? null,
    },
  }));
}
