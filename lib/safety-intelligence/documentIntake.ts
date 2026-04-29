import { buildCsepTradeSelection } from "@/lib/csepTradeSelection";
import {
  createDeterministicHash,
  normalizeSelectedCsepBlockKeys,
  resolveSelectedCsepFormatSectionKeys,
} from "@/lib/csepBuilder";
import {
  deriveEligibleCsepPricedItems,
  normalizePricedItemSelections,
  resolveSelectedCsepPricedItems,
} from "@/lib/csepEnrichmentPricing";
import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import { buildCsepProgramSelections, normalizeProgramSelections } from "@/lib/csepPrograms";
import {
  describeJurisdictionSelection,
  resolveBuilderJurisdiction,
} from "@/lib/jurisdictionStandards/catalog";
import {
  buildPshsepCatalogProgramSelections,
  collectPshsepCatalogOshaRefs,
  derivePshsepExportProgramIds,
  normalizePshsepBuilderFormData,
} from "@/lib/pshsepCatalog";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
  SITE_SAFETY_BLUEPRINT_TITLE,
} from "@/lib/safetyBlueprintLabels";
import {
  DEFAULT_PROJECT_DELIVERY_TYPE,
  normalizeProjectDeliveryType,
} from "@/lib/tradeConflictCatalog";
import {
  buildTaskModuleAiContext,
  getTaskModulesForCsepSelection,
  SITE_MANAGEMENT_TASK_MODULE_PACK_KEY,
} from "@/lib/siteManagementTaskModules";
import {
  buildHazardModuleAiContext,
  CSEP_HAZARD_MODULE_PACK_KEY,
  getHazardModulesForCsepSelection,
} from "@/lib/hazardModules";
import {
  getSteelErectionReferencePacksForPshsepSelection,
} from "@/lib/steelErectionReferencePacks";
import {
  buildSteelErectionHazardModuleAiContext,
  getSteelErectionHazardModulesForCsepSelection,
  STEEL_ERECTION_HAZARD_MODULE_PACK_KEY,
} from "@/lib/steelErectionHazardModules";
import {
  buildSteelErectionProgramModuleAiContext,
  getSteelErectionProgramModulesForCsepSelection,
  STEEL_ERECTION_PROGRAM_MODULE_PACK_KEY,
} from "@/lib/steelErectionProgramModules";
import {
  buildSteelErectionTaskModuleAiContext,
  getSteelErectionTaskModulesForCsepSelection,
  STEEL_ERECTION_TASK_MODULE_PACK_KEY,
} from "@/lib/steelErectionTaskModules";
import type { CsepBuilderInstructions } from "@/types/csep-builder";
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
import { normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import { asStringArray, ensureJsonObject, ensureOptionalString, isRecord } from "@/lib/safety-intelligence/validation/common";

type CSEPRiskItemLike = Pick<CSEPRiskItem, "activity" | "hazard" | "controls" | "permit">;

function normalizePartyList(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const parts = raw
    .replace(/\r\n?/g, "\n")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length ? Array.from(new Set(parts)).join("; ") : null;
}

function slugify(value: string, fallback: string) {
  const next = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return next || fallback;
}

function uniqueNonEmptyStrings(values: readonly string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
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
  if (token.includes("lift") || token.includes("crane") || token.includes("motion")) return ["lift_plan"];
  if (token.includes("height") || token.includes("ladder") || token.includes("mewp") || token.includes("gravity")) {
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
  if (token.includes("falling object") || token.includes("dropped")) return ["overhead_work", "struck_by"];
  if (token.includes("structural instability") || token.includes("collapse")) return ["collapse"];
  if (token.includes("pinch") || token.includes("caught between")) return ["line_of_fire", "struck_by"];
  if (token.includes("crane") || token.includes("lift")) return ["overhead_work", "struck_by"];
  if (token.includes("chemical")) return ["fumes"];
  if (token.includes("struck")) return ["struck_by"];
  if (token.includes("slip") || token.includes("trip")) return ["line_of_fire"];
  return ["unknown"];
}

function inferHazardsFromScopeLabels(scopeLabels: string[]) {
  const hazards = new Set<string>();
  for (const label of scopeLabels) {
    const token = label.toLowerCase();
    if (token.includes("scaffold") || token.includes("aerial") || token.includes("roof")) {
      hazards.add("Falls from height");
    }
    if (token.includes("excavat")) {
      hazards.add("Excavation collapse");
      hazards.add("Utility strike");
    }
    if (token.includes("steel")) {
      hazards.add("Falling object hazards");
      hazards.add("Rigging and lifting hazards");
    }
    if (token.includes("concrete") || token.includes("masonry")) {
      hazards.add("Silica / dust exposure");
      hazards.add("Struck-by hazards");
    }
    if (token.includes("demolition")) {
      hazards.add("Demolition instability");
      hazards.add("Line of fire / struck-by hazards");
    }
    if (token.includes("electrical")) {
      hazards.add("Electrical shock/arc flash");
    }
    if (token.includes("hot work")) {
      hazards.add("Hot work / fire exposure");
    }
    if (token.includes("confined")) {
      hazards.add("Confined spaces");
    }
  }
  return [...hazards];
}

function inferPpeFromScopeAndPermits(scopeLabels: string[], permitLabels: string[]) {
  const ppe = new Set<string>(["Hard Hat", "Safety Glasses", "High-visibility vest"]);
  const source = [...scopeLabels, ...permitLabels].join(" ").toLowerCase();
  if (source.includes("hot work")) {
    ppe.add("Face shield");
    ppe.add("Heat-resistant gloves");
  }
  if (source.includes("electrical") || source.includes("loto")) {
    ppe.add("Arc-rated PPE");
  }
  if (source.includes("excavat")) {
    ppe.add("Protective footwear");
  }
  if (source.includes("confined")) {
    ppe.add("Respiratory protection");
  }
  return [...ppe];
}

function inferOshaRefs(scopeLabels: string[], permitLabels: string[]) {
  const refs = new Set<string>(["29 CFR 1926"]);
  const source = [...scopeLabels, ...permitLabels].join(" ").toLowerCase();
  if (source.includes("fall") || source.includes("scaffold") || source.includes("roof")) {
    refs.add("29 CFR 1926 Subpart M");
  }
  if (source.includes("excavat") || source.includes("trench")) {
    refs.add("29 CFR 1926 Subpart P");
  }
  if (source.includes("crane") || source.includes("lift")) {
    refs.add("29 CFR 1926 Subpart CC");
  }
  if (source.includes("confined")) {
    refs.add("29 CFR 1926 Subpart AA");
  }
  if (source.includes("electrical") || source.includes("loto")) {
    refs.add("29 CFR 1926 Subpart K");
  }
  if (source.includes("hot work")) {
    refs.add("29 CFR 1926 Subpart J");
  }
  return [...refs];
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

function buildCsepBuilderInstructions(params: {
  formData: Record<string, unknown>;
  projectDeliveryType: SafetyPlanGenerationContext["documentProfile"]["projectDeliveryType"] | null;
  jurisdictionCode: SafetyPlanGenerationContext["documentProfile"]["jurisdictionCode"] | null;
  tradeLabel: string;
  subTradeLabel: string;
  tasks: string[];
  tradeItems: CSEPRiskItemLike[];
  tradeSummary: string;
  oshaRefs: string[];
  selectedHazards: string[];
  derivedHazards: string[];
  requiredPpe: string[];
  additionalPermits: string[];
  derivedPermits: string[];
  overlapPermitHints: string[];
  commonOverlappingTrades: string[];
  taskModuleKeys: string[];
  hazardModuleKeys: string[];
  steelTaskModuleKeys: string[];
  steelHazardModuleKeys: string[];
  steelProgramModuleKeys: string[];
  programSelections: SafetyPlanGenerationContext["programSelections"];
  pricedAttachments: SafetyPlanGenerationContext["pricedAttachments"];
  programSubtypeSelections: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
}) {
  const selectedBlockKeys = normalizeSelectedCsepBlockKeys({
    includedSections: params.formData.included_sections,
    includedContent: params.formData.includedContent,
  });
  const normalizedSelectedBlockKeys = selectedBlockKeys.length
    ? selectedBlockKeys
    : normalizeSelectedCsepBlockKeys({
        includedContent: {
          project_information: true,
          contractor_information: true,
          trade_summary: true,
          scope_of_work: true,
          site_specific_notes: true,
          emergency_procedures: true,
          weather_requirements_and_severe_weather_response: true,
          required_ppe: true,
          additional_permits: true,
          common_overlapping_trades: true,
          osha_references: true,
          selected_hazards: true,
          activity_hazard_matrix: true,
          roles_and_responsibilities: true,
          security_and_access: true,
          health_and_wellness: true,
          incident_reporting_and_investigation: true,
          training_and_instruction: true,
          drug_and_alcohol_testing: true,
          enforcement_and_corrective_action: true,
          recordkeeping: true,
          continuous_improvement: true,
        },
      });
  const scopeOfWork = String(params.formData.scope_of_work ?? "").trim();
  const siteSpecificNotes = String(params.formData.site_specific_notes ?? "").trim();
  const emergencyProcedures = String(params.formData.emergency_procedures ?? "").trim();
  const selectedFormatSectionKeys = resolveSelectedCsepFormatSectionKeys({
    selectedFormatSections: params.formData.selected_format_sections,
    includedSections: params.formData.included_sections,
    includedContent: params.formData.includedContent,
  });
  const documentControl = {
    projectSite: ensureOptionalString(params.formData.project_name),
    primeContractor: ensureOptionalString(params.formData.contractor_company),
    clientOwner: normalizePartyList(params.formData.owner_client),
    documentNumber: ensureOptionalString(params.formData.document_number),
    revision: ensureOptionalString(params.formData.document_revision),
    issueDate: ensureOptionalString(params.formData.issue_date),
    preparedBy: ensureOptionalString(params.formData.prepared_by),
    reviewedBy: ensureOptionalString(params.formData.reviewed_by),
    approvedBy: ensureOptionalString(params.formData.approved_by),
  };
  const gcPartnerEntries = normalizeGcCmPartnerEntries(params.formData.gc_cm);
  const gcInformationValue =
    gcPartnerEntries.length === 0
      ? null
      : gcPartnerEntries.length === 1
        ? gcPartnerEntries[0]
        : gcPartnerEntries.map((partner) => `- ${partner}`).join("\n");
  const projectInformation = [
    ["Project Name", String(params.formData.project_name ?? "").trim()],
    ["Project Number", ensureOptionalString(params.formData.project_number)],
    ["Project Address", ensureOptionalString(params.formData.project_address)],
    ["Owner / Client", normalizePartyList(params.formData.owner_client)],
    ["GC / CM / program partners", gcInformationValue],
    ["Governing State", ensureOptionalString(params.formData.governing_state)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);
  const contractorInformation = [
    ["Contractor Company", ensureOptionalString(params.formData.contractor_company)],
    ["Contractor Contact", ensureOptionalString(params.formData.contractor_contact)],
    ["Contractor Phone", ensureOptionalString(params.formData.contractor_phone)],
    ["Contractor Email", ensureOptionalString(params.formData.contractor_email)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);
  const selectedPermits = [
    ...new Set([
      ...params.additionalPermits,
      ...params.derivedPermits,
      ...params.overlapPermitHints,
    ]),
  ];
  const weatherRequirements = isRecord(params.formData.weather_requirements)
    ? params.formData.weather_requirements
    : {};
  const weatherBlockInput = [
    ...asStringArray(weatherRequirements.monitoringSources).map(
      (item) => `Monitoring source: ${item}`
    ),
    ...asStringArray(weatherRequirements.communicationMethods).map(
      (item) => `Communication method: ${item}`
    ),
    ...asStringArray(weatherRequirements.highWindControls).map(
      (item) => `High-wind control: ${item}`
    ),
    ...asStringArray(weatherRequirements.heatControls).map((item) => `Heat control: ${item}`),
    ...asStringArray(weatherRequirements.coldControls).map((item) => `Cold control: ${item}`),
    ...asStringArray(weatherRequirements.tornadoStormControls).map(
      (item) => `Storm control: ${item}`
    ),
    ...asStringArray(weatherRequirements.environmentalControls).map(
      (item) => `Environmental control: ${item}`
    ),
    ...asStringArray(weatherRequirements.projectOverrideNotes).map(
      (item) => `Project override: ${item}`
    ),
    ...asStringArray(weatherRequirements.contractorResponsibilityNotes).map(
      (item) => `Contractor weather note: ${item}`
    ),
    ensureOptionalString(weatherRequirements.dailyReviewNotes),
    ensureOptionalString(weatherRequirements.highWindThresholdText),
    typeof weatherRequirements.lightningRadiusMiles === "number"
      ? `Lightning radius: ${weatherRequirements.lightningRadiusMiles} miles`
      : null,
    typeof weatherRequirements.lightningAllClearMinutes === "number"
      ? `Lightning all clear: ${weatherRequirements.lightningAllClearMinutes} minutes`
      : null,
    ensureOptionalString(weatherRequirements.lightningShelterNotes),
    ensureOptionalString(weatherRequirements.heatTriggerText),
    ensureOptionalString(weatherRequirements.coldTriggerText),
    ensureOptionalString(weatherRequirements.tornadoStormShelterNotes),
    ensureOptionalString(weatherRequirements.unionAccountabilityNotes),
  ].filter((value): value is string => Boolean(value));
  const hazardInputs = params.selectedHazards.length
    ? params.selectedHazards
    : params.derivedHazards;
  const blockInputs: CsepBuilderInstructions["blockInputs"] = {
    project_information: projectInformation.length ? projectInformation : null,
    contractor_information: contractorInformation.length ? contractorInformation : null,
    trade_summary: [
      params.tradeLabel ? `Trade: ${params.tradeLabel}` : null,
      params.subTradeLabel ? `Sub-trade: ${params.subTradeLabel}` : null,
      params.tasks.length ? `Tasks: ${params.tasks.join(", ")}` : null,
      params.tradeSummary || null,
    ]
      .filter(Boolean)
      .join("\n\n") || null,
    scope_of_work: scopeOfWork || null,
    site_specific_notes: siteSpecificNotes || null,
    emergency_procedures: emergencyProcedures || null,
    weather_requirements_and_severe_weather_response: weatherBlockInput.length
      ? weatherBlockInput
      : null,
    required_ppe: params.requiredPpe.length ? params.requiredPpe : null,
    additional_permits: selectedPermits.length ? selectedPermits : null,
    common_overlapping_trades: params.commonOverlappingTrades.length
      ? params.commonOverlappingTrades
      : null,
    osha_references: params.oshaRefs.length ? params.oshaRefs : null,
    selected_hazards: hazardInputs.length ? hazardInputs : null,
    activity_hazard_matrix: params.tradeItems.length
      ? params.tradeItems.map((item) =>
          [
            `Activity: ${String(item.activity ?? "").trim() || "N/A"}`,
            `Hazard: ${String(item.hazard ?? "").trim() || "N/A"}`,
            `Controls: ${asStringArray(item.controls).join(", ") || "None"}`,
            `Permit: ${String(item.permit ?? "").trim() || "None"}`,
          ].join(" | ")
        )
      : null,
    roles_and_responsibilities: ensureOptionalString(
      params.formData.roles_and_responsibilities_text
    ),
    security_and_access: ensureOptionalString(params.formData.security_and_access_text),
    health_and_wellness: ensureOptionalString(params.formData.health_and_wellness_text),
    incident_reporting_and_investigation: ensureOptionalString(
      params.formData.incident_reporting_and_investigation_text
    ),
    training_and_instruction: ensureOptionalString(
      params.formData.training_and_instruction_text
    ),
    drug_and_alcohol_testing: ensureOptionalString(
      params.formData.drug_and_alcohol_testing_text
    ),
    enforcement_and_corrective_action: ensureOptionalString(
      params.formData.enforcement_and_corrective_action_text
    ),
    recordkeeping: ensureOptionalString(params.formData.recordkeeping_text),
    continuous_improvement: ensureOptionalString(params.formData.continuous_improvement_text),
  };
  const builderInputHash = createDeterministicHash({
    selectedBlockKeys: normalizedSelectedBlockKeys,
    selectedFormatSectionKeys,
    blockInputs,
    documentControl,
    projectDeliveryType: params.projectDeliveryType,
    jurisdictionCode: params.jurisdictionCode,
    tradeLabel: params.tradeLabel,
    subTradeLabel: params.subTradeLabel,
    tasks: params.tasks,
    selectedHazards: params.selectedHazards,
    derivedHazards: params.derivedHazards,
    requiredPpe: params.requiredPpe,
    additionalPermits: params.additionalPermits,
    derivedPermits: params.derivedPermits,
    overlapPermitHints: params.overlapPermitHints,
    commonOverlappingTrades: params.commonOverlappingTrades,
    taskModuleKeys: params.taskModuleKeys,
    hazardModuleKeys: params.hazardModuleKeys,
    steelTaskModuleKeys: params.steelTaskModuleKeys,
    steelHazardModuleKeys: params.steelHazardModuleKeys,
    steelProgramModuleKeys: params.steelProgramModuleKeys,
    programSelections: params.programSelections ?? [],
    pricedAttachments: params.pricedAttachments ?? [],
    programSubtypeSelections: params.programSubtypeSelections,
  });

  return {
    selectedBlockKeys: normalizedSelectedBlockKeys,
    selectedFormatSectionKeys,
    blockInputs,
    documentControl,
    builderInputHash,
  } satisfies CsepBuilderInstructions;
}

function normalizeBuilderInstructions(value: unknown) {
  if (!isRecord(value)) return null;

  const blockInputs = isRecord(value.blockInputs) ? value.blockInputs : {};
  const normalizedBlockInputs = Object.fromEntries(
    Object.entries(blockInputs)
      .filter(([key]) =>
        normalizeSelectedCsepBlockKeys({
          includedContent: { [key]: true },
        }).length > 0
      )
      .map(([key, entryValue]) => {
        if (typeof entryValue === "string") {
          return [key, entryValue.trim() || null];
        }
        if (Array.isArray(entryValue)) {
          return [key, entryValue.filter((item): item is string => typeof item === "string" && item.trim().length > 0)];
        }
        return [key, null];
      })
  ) as CsepBuilderInstructions["blockInputs"];
  const selectedBlockKeys = normalizeSelectedCsepBlockKeys({
    includedSections: value.selectedBlockKeys,
    includedContent: selectedBlockKeysFromInputs(normalizedBlockInputs),
  });
  const selectedFormatSectionKeys = resolveSelectedCsepFormatSectionKeys({
    selectedFormatSections: value.selectedFormatSectionKeys,
    includedSections: value.selectedBlockKeys,
    includedContent: selectedBlockKeysFromInputs(normalizedBlockInputs),
  });
  const documentControl = isRecord(value.documentControl)
    ? {
        projectSite: ensureOptionalString(value.documentControl.projectSite),
        primeContractor: ensureOptionalString(value.documentControl.primeContractor),
        clientOwner: ensureOptionalString(value.documentControl.clientOwner),
        documentNumber: ensureOptionalString(value.documentControl.documentNumber),
        revision: ensureOptionalString(value.documentControl.revision),
        issueDate: ensureOptionalString(value.documentControl.issueDate),
        preparedBy: ensureOptionalString(value.documentControl.preparedBy),
        reviewedBy: ensureOptionalString(value.documentControl.reviewedBy),
        approvedBy: ensureOptionalString(value.documentControl.approvedBy),
      }
    : undefined;
  const builderInputHash =
    ensureOptionalString(value.builderInputHash) ??
    createDeterministicHash({
      selectedBlockKeys,
      selectedFormatSectionKeys,
      blockInputs: normalizedBlockInputs,
      documentControl,
    });

  return {
    selectedBlockKeys,
    selectedFormatSectionKeys,
    blockInputs: normalizedBlockInputs,
    documentControl,
    builderInputHash,
  } satisfies CsepBuilderInstructions;
}

function selectedBlockKeysFromInputs(blockInputs: CsepBuilderInstructions["blockInputs"]) {
  return Object.fromEntries(
    Object.entries(blockInputs).map(([key, value]) => [key, Array.isArray(value) ? value.length > 0 : Boolean(value)])
  );
}

export function buildCsepGenerationContext(formData: Record<string, unknown>): SafetyPlanGenerationContext {
  const tradeLabel = String(formData.trade ?? "").trim();
  const subTradeLabel = String(formData.subTrade ?? "").trim();
  const projectDeliveryType = normalizeProjectDeliveryType(
    formData.project_delivery_type ?? formData.projectDeliveryType
  );
  const governingState = ensureOptionalString(
    formData.governing_state ?? formData.governingState
  );
  const companyState = ensureOptionalString(
    formData.company_state_region ?? formData.companyStateRegion
  );
  const jurisdictionProfile = resolveBuilderJurisdiction({
    governingState,
    companyState,
  });
  const jurisdictionSelection = describeJurisdictionSelection(jurisdictionProfile);
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
  const derivedHazards = asStringArray(formData.derivedHazards).length
    ? asStringArray(formData.derivedHazards)
    : tradeSelection?.derivedHazards ?? [];
  const effectiveSelectedHazards = uniqueNonEmptyStrings([
    ...derivedHazards,
    ...selectedHazards,
  ]);
  const derivedPermits = asStringArray(formData.derivedPermits).length
    ? asStringArray(formData.derivedPermits)
    : tradeSelection?.derivedPermits ?? [];
  const overlapPermitHints = asStringArray(formData.overlapPermitHints).length
    ? asStringArray(formData.overlapPermitHints)
    : tradeSelection?.overlapPermitHints ?? [];
  const commonOverlappingTrades = asStringArray(formData.common_overlapping_trades).length
    ? asStringArray(formData.common_overlapping_trades)
    : tradeSelection?.commonOverlappingTrades ?? [];
  const tradeSummary =
    String(formData.tradeSummary ?? "").trim() || tradeSelection?.summary || "";
  const oshaRefs = asStringArray(formData.oshaRefs).length
    ? asStringArray(formData.oshaRefs)
    : tradeSelection?.oshaRefs ?? [];
  const selectedPermitInputs = [
    ...new Set([...additionalPermits, ...derivedPermits, ...overlapPermitHints]),
  ];
  const selectedPermits = [...new Set([...additionalPermits, ...derivedPermits])];
  const taskModules = getTaskModulesForCsepSelection({
    tradeLabel: tradeSelection?.tradeLabel ?? tradeLabel,
    taskNames: tasks,
  });
  const taskModuleAiContext = buildTaskModuleAiContext(taskModules);
  const hazardModules = getHazardModulesForCsepSelection({
    selectedHazards: effectiveSelectedHazards,
    selectedPermits: selectedPermitInputs,
    taskNames: tasks,
    tradeLabel: tradeSelection?.tradeLabel ?? tradeLabel,
    subTradeLabel: tradeSelection?.subTradeLabel ?? subTradeLabel,
  });
  const hazardModuleAiContext = buildHazardModuleAiContext(hazardModules);
  const eligiblePricedAttachments = deriveEligibleCsepPricedItems({
    trade: tradeSelection?.tradeLabel ?? tradeLabel,
    subTrade: tradeSelection?.subTradeLabel ?? subTradeLabel,
    tasks,
    selectedHazards: effectiveSelectedHazards,
    derivedHazards,
    selectedPermits: selectedPermitInputs,
  });
  const explicitPricedAttachments = normalizePricedItemSelections(
    (formData as { priced_attachments?: unknown }).priced_attachments ??
      (formData as { pricedAttachments?: unknown }).pricedAttachments
  );
  const pricedAttachmentKeys = asStringArray(
    (formData as { priced_attachment_keys?: unknown }).priced_attachment_keys ??
      (formData as { pricedAttachmentKeys?: unknown }).pricedAttachmentKeys
  );
  const pricedAttachments =
    explicitPricedAttachments.length > 0
      ? explicitPricedAttachments
      : resolveSelectedCsepPricedItems({
          selectedKeys: pricedAttachmentKeys,
          eligibleItems: eligiblePricedAttachments,
        });
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
          selectedHazards: effectiveSelectedHazards,
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
  const steelTaskModules = getSteelErectionTaskModulesForCsepSelection({
    tradeLabel: tradeSelection?.tradeLabel ?? tradeLabel,
    subTradeLabel: tradeSelection?.subTradeLabel ?? subTradeLabel,
    taskNames: tasks,
  });
  const steelTaskModuleAiContext = buildSteelErectionTaskModuleAiContext(steelTaskModules);
  const steelHazardModules = getSteelErectionHazardModulesForCsepSelection({
    selectedHazards: effectiveSelectedHazards,
    selectedPermits: selectedPermitInputs,
    taskNames: tasks,
    tradeLabel: tradeSelection?.tradeLabel ?? tradeLabel,
    subTradeLabel: tradeSelection?.subTradeLabel ?? subTradeLabel,
  });
  const steelHazardModuleAiContext = buildSteelErectionHazardModuleAiContext(
    steelHazardModules
  );
  const steelProgramModules = getSteelErectionProgramModulesForCsepSelection({
    programSelections,
    selectedHazards: effectiveSelectedHazards,
    selectedPermits: selectedPermitInputs,
    taskNames: tasks,
    tradeLabel: tradeSelection?.tradeLabel ?? tradeLabel,
    subTradeLabel: tradeSelection?.subTradeLabel ?? subTradeLabel,
  });
  const steelProgramModuleAiContext = buildSteelErectionProgramModuleAiContext(
    steelProgramModules
  );
  const derivedOperations = (tasks.length ? tasks : [scopeOfWork || tradeLabel || "project work"]).map(
    (taskTitle, index) => {
      const riskItems = tradeSelection?.items.filter((item) => item.activity === taskTitle) ?? [];
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
        hazardHints: uniqueNonEmptyStrings(
          riskItems.flatMap((item) => normalizeHazardHint(item.hazard))
        ) as HazardFamily[],
        requiredControlHints: uniqueNonEmptyStrings(
          riskItems.flatMap((item) => item.controls)
        ),
        permitHints: uniqueNonEmptyStrings(
          riskItems.flatMap((item) => normalizePermitHint(item.permit))
        ) as PermitTriggerType[],
        ppeHints: requiredPpe,
        workAreaLabel: null,
        locationGrid: null,
        locationLabel: String(formData.project_address ?? "").trim() || null,
        weatherConditionCode: null,
        startsAt: null,
        endsAt: null,
        crewSize: null,
        metadata: {
          tradeSummary,
          oshaRefs,
          selectedHazards: effectiveSelectedHazards,
          additionalPermits,
          pricedAttachments,
          programSelections,
          taskModuleKeys: taskModules.map((module) => module.moduleKey),
          hazardModuleKeys: hazardModules.map((module) => module.moduleKey),
          steelTaskModuleKeys: steelTaskModules.map((module) => module.moduleKey),
          steelHazardModuleKeys: steelHazardModules.map((module) => module.moduleKey),
          steelProgramModuleKeys: steelProgramModules.map((module) => module.moduleKey),
        },
      });
    }
  );
  const builderInstructions = buildCsepBuilderInstructions({
    formData,
    projectDeliveryType,
    jurisdictionCode: jurisdictionSelection.jurisdictionCode,
    tradeLabel: tradeSelection?.tradeLabel ?? tradeLabel,
    subTradeLabel: tradeSelection?.subTradeLabel ?? subTradeLabel,
    tasks,
    tradeItems,
    tradeSummary,
    oshaRefs,
    selectedHazards: effectiveSelectedHazards,
    derivedHazards,
    requiredPpe,
    additionalPermits,
    derivedPermits,
    overlapPermitHints,
    commonOverlappingTrades,
    taskModuleKeys: taskModules.map((module) => module.moduleKey),
    hazardModuleKeys: hazardModules.map((module) => module.moduleKey),
    steelTaskModuleKeys: steelTaskModules.map((module) => module.moduleKey),
    steelHazardModuleKeys: steelHazardModules.map((module) => module.moduleKey),
    steelProgramModuleKeys: steelProgramModules.map((module) => module.moduleKey),
    programSelections,
    pricedAttachments,
    programSubtypeSelections,
  });

  return ensureOperations({
    project: {
      projectName: String(formData.project_name ?? "").trim(),
      projectNumber: ensureOptionalString(formData.project_number),
      projectAddress: ensureOptionalString(formData.project_address),
      ownerClient: normalizePartyList(formData.owner_client),
      gcCm: normalizeGcCmPartnerEntries(formData.gc_cm),
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
        taskModulePackKey: taskModules.length ? SITE_MANAGEMENT_TASK_MODULE_PACK_KEY : null,
        taskModuleTitles: taskModules.map((module) => module.title),
        taskModules: taskModuleAiContext,
        hazardModulePackKey: hazardModules.length ? CSEP_HAZARD_MODULE_PACK_KEY : null,
        hazardModuleTitles: hazardModules.map((module) => module.title),
        hazardModules: hazardModuleAiContext,
        steelTaskModulePackKey: steelTaskModules.length
          ? STEEL_ERECTION_TASK_MODULE_PACK_KEY
          : null,
        steelTaskModuleTitles: steelTaskModules.map((module) => module.title),
        steelTaskModules: steelTaskModuleAiContext,
        steelHazardModulePackKey: steelHazardModules.length
          ? STEEL_ERECTION_HAZARD_MODULE_PACK_KEY
          : null,
        steelHazardModuleTitles: steelHazardModules.map((module) => module.title),
        steelHazardModules: steelHazardModuleAiContext,
        steelProgramModulePackKey: steelProgramModules.length
          ? STEEL_ERECTION_PROGRAM_MODULE_PACK_KEY
          : null,
        steelProgramModuleTitles: steelProgramModules.map((module) => module.title),
        steelProgramModules: steelProgramModuleAiContext,
      },
    },
    programSelections,
    pricedAttachments,
    builderInstructions,
    documentProfile: {
      documentType: "csep",
      projectDeliveryType,
      requestedLabel: CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
      title: null,
      governingState: jurisdictionSelection.governingState,
      jurisdictionCode: jurisdictionSelection.jurisdictionCode,
      jurisdictionLabel: jurisdictionProfile.jurisdictionLabel,
      jurisdictionPlanType: jurisdictionSelection.jurisdictionPlanType,
      jurisdictionStandardsApplied: [],
      source: "builder_submit",
    },
    legacyFormSnapshot: formData as JsonObject,
  });
}

export function buildPshsepGenerationContext(formData: Record<string, unknown>): SafetyPlanGenerationContext {
  const normalizedFormData = normalizePshsepBuilderFormData(formData);
  const projectDeliveryType = normalizeProjectDeliveryType(
    normalizedFormData.project_delivery_type ?? normalizedFormData.projectDeliveryType
  );
  const governingState = ensureOptionalString(
    normalizedFormData.governing_state ?? normalizedFormData.governingState
  );
  const companyState = ensureOptionalString(
    normalizedFormData.company_state_region ?? normalizedFormData.companyStateRegion
  );
  const jurisdictionProfile = resolveBuilderJurisdiction({
    governingState,
    companyState,
  });
  const jurisdictionSelection = describeJurisdictionSelection(jurisdictionProfile);
  const selectedScopes = asStringArray(normalizedFormData.scope_of_work_selected);
  const permitLabels = asStringArray(normalizedFormData.permits_selected);
  const highRiskFocusAreas = asStringArray(normalizedFormData.high_risk_focus_areas);
  const assumedTradesIndex = asStringArray(normalizedFormData.assumed_trades_index);
  const ancillaryContractors = asStringArray(normalizedFormData.ancillary_contractors);
  const eventCalendarItems = asStringArray(normalizedFormData.event_calendar_items);
  const projectDescription = String(normalizedFormData.project_description ?? "").trim();
  const ownerSpecificRequirementsText = String(normalizedFormData.owner_specific_requirements_text ?? "").trim();
  const definitionsText = String(normalizedFormData.definitions_text ?? "").trim();
  const oversightRolesText = String(normalizedFormData.oversight_roles_text ?? "").trim();
  const competentPersonRequirementsText = String(
    normalizedFormData.competent_person_requirements_text ?? ""
  ).trim();
  const staffingRequirementsText = String(normalizedFormData.staffing_requirements_text ?? "").trim();
  const tradeTrainingRequirementsText = String(
    normalizedFormData.trade_training_requirements_text ?? ""
  ).trim();
  const certificationRequirementsText = String(
    normalizedFormData.certification_requirements_text ?? ""
  ).trim();
  const contractorCoordinationText = String(normalizedFormData.contractor_coordination_text ?? "").trim();
  const ancillaryContractorsNotes = String(normalizedFormData.ancillary_contractors_notes ?? "").trim();
  const disciplinaryPolicyText = String(normalizedFormData.disciplinary_policy_text ?? "").trim();
  const ownerLetterText = String(normalizedFormData.owner_letter_text ?? "").trim();
  const incidentReportingProcessText = String(normalizedFormData.incident_reporting_process_text ?? "").trim();
  const incidentInvestigationText = String(normalizedFormData.incident_investigation_text ?? "").trim();
  const specialConditionsPermitText = String(normalizedFormData.special_conditions_permit_text ?? "").trim();
  const clinicName = String(normalizedFormData.clinic_name ?? "").trim();
  const clinicAddress = String(normalizedFormData.clinic_address ?? "").trim();
  const clinicHours = String(normalizedFormData.clinic_hours ?? "").trim();
  const postedEmergencyContactsText = String(
    normalizedFormData.posted_emergency_contacts_text ?? ""
  ).trim();
  const emergencyPostingLocation = String(normalizedFormData.emergency_posting_location ?? "").trim();
  const inspectionProcessText = String(normalizedFormData.inspection_process_text ?? "").trim();
  const eventCalendarNotesText = String(normalizedFormData.event_calendar_notes_text ?? "").trim();
  const weatherSopText = String(normalizedFormData.weather_sop_text ?? "").trim();
  const environmentalControlsText = String(normalizedFormData.environmental_controls_text ?? "").trim();
  const ppeSpecificsText = String(normalizedFormData.ppe_specifics_text ?? "").trim();
  const equipmentControlsText = String(normalizedFormData.equipment_controls_text ?? "").trim();
  const chemicalStorageText = String(normalizedFormData.chemical_storage_text ?? "").trim();
  const emergencyMap = isRecord(normalizedFormData.emergency_map) ? normalizedFormData.emergency_map : {};
  const location = String(normalizedFormData.project_address ?? "").trim();
  const selectedHazards = inferHazardsFromScopeLabels(selectedScopes);
  const selectedPpe = inferPpeFromScopeAndPermits(selectedScopes, permitLabels);
  const oshaRefs = [
    ...new Set([
      ...inferOshaRefs(selectedScopes, permitLabels),
      ...collectPshsepCatalogOshaRefs({
        scope_of_work_selected: selectedScopes,
        high_risk_focus_areas: highRiskFocusAreas,
        permits_selected: permitLabels,
      }),
    ]),
  ];
  const baseProgramSelections = buildCsepProgramSelections({
    selectedHazards,
    selectedPermits: permitLabels,
    selectedPpe: [...new Set([...selectedPpe, ...asStringArray(normalizedFormData.required_ppe)])],
    selectedTasks: selectedScopes,
    tradeItems: [],
  }).selections;
  const explicitProgramSelections = buildPshsepCatalogProgramSelections({
    scope_of_work_selected: selectedScopes,
    high_risk_focus_areas: highRiskFocusAreas,
    permits_selected: permitLabels,
  });
  const programSelections = normalizeProgramSelections([
    ...baseProgramSelections.map((selection) => ({
      category: selection.category,
      item: selection.item,
      subtype: selection.subtype ?? null,
      relatedTasks: selection.relatedTasks,
      source: selection.source,
    })),
    ...explicitProgramSelections,
  ]);
  const exportProgramIds = derivePshsepExportProgramIds(normalizedFormData);
  const steelReferencePacks = getSteelErectionReferencePacksForPshsepSelection({
    scopeOfWorkSelected: selectedScopes,
    highRiskFocusAreas,
    assumedTradesIndex,
    exportProgramIds,
    programSelections,
  });
  const workConditions = [projectDescription, ownerSpecificRequirementsText].filter(Boolean);
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
          oshaRefs,
          highRiskFocusAreas,
          orientationRequired: Boolean(normalizedFormData.orientation_required),
          liftPlansRequired: Boolean(normalizedFormData.lift_plans_required),
          criticalLiftReviewRequired: Boolean(normalizedFormData.critical_lift_review_required),
          assumedTradesIndex,
          tradeTrainingRequirementsText,
          certificationRequirementsText,
          ppeSpecificsText,
          equipmentControlsText,
          weatherSopText,
          exportProgramIds,
          steelTaskModuleKeys: steelReferencePacks.taskModules.map((module) => module.moduleKey),
          steelHazardModuleKeys: steelReferencePacks.hazardModules.map(
            (module) => module.moduleKey
          ),
          steelProgramModuleKeys: steelReferencePacks.programModules.map(
            (module) => module.moduleKey
          ),
        },
      })
  );

  return ensureOperations({
    project: {
      projectName: String(normalizedFormData.project_name ?? "").trim(),
      projectNumber: ensureOptionalString(normalizedFormData.project_number),
      projectAddress: location || null,
      ownerClient: normalizePartyList(normalizedFormData.owner_client),
      gcCm: normalizeGcCmPartnerEntries(normalizedFormData.gc_cm),
      contractorCompany: ensureOptionalString(normalizedFormData.company_name),
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
      siteRestrictions: extractSiteRestrictions([
        projectDescription,
        ownerSpecificRequirementsText,
        equipmentControlsText,
      ]),
      simultaneousOperations: [...assumedTradesIndex, ...ancillaryContractors],
      weather: {
        conditionCode: null,
        summary: weatherSopText || null,
      },
      metadata: {
        emergencyMap: ensureJsonObject(emergencyMap),
        sectionOrdering: {
          adminFirst: false,
          recommendedSectionOrder: [
            "definitions",
            "project_oversight_roles",
            "contractor_coordination",
            "training_certifications",
            "incident_injury_response",
            "emergency_facilities_contacts",
            "inspections_recurring_events",
            "weather_environmental_controls",
            "ppe_work_access_controls",
            "trade_risk_breakdown",
            "high_risk_sections",
            "admin_sections",
          ],
          tradeHazardSectionOrder: ["trade_risk_breakdown", "task_hazard_analysis", "permit_matrix"],
        },
        starterSections: {
          normalizedCatalogSelections: {
            scopeOfWorkSelected: selectedScopes,
            highRiskFocusAreas,
            permitsSelected: permitLabels,
            assumedTradesIndex,
            ancillaryContractors,
          },
          ownerSpecificRequirementsText,
          definitionsText,
          oversightRolesText,
          competentPersonRequirementsText,
          staffingRequirementsText,
          tradeTrainingRequirementsText,
          certificationRequirementsText,
          contractorCoordinationText,
          ancillaryContractors,
          ancillaryContractorsNotes,
          disciplinaryPolicyText,
          ownerLetterText,
          incidentReportingProcessText,
          incidentInvestigationText,
          specialConditionsPermitText,
          assumedTradesIndex,
          highRiskFocusAreas,
          clinicName,
          clinicAddress,
          clinicHours,
          postedEmergencyContactsText,
          emergencyPostingLocation,
          inspectionProcessText,
          eventCalendarItems,
          eventCalendarNotesText,
          weatherSopText,
          environmentalControlsText,
          ppeSpecificsText,
          equipmentControlsText,
          chemicalStorageText,
        },
        oshaReferenceStrategy: "inline_and_appendix",
        oshaRefs,
        exportProgramIds,
        steelTaskModulePackKey: steelReferencePacks.taskModules.length
          ? STEEL_ERECTION_TASK_MODULE_PACK_KEY
          : null,
        steelTaskModuleTitles: steelReferencePacks.taskModules.map((module) => module.title),
        steelTaskModules: steelReferencePacks.taskModuleAiContext,
        steelHazardModulePackKey: steelReferencePacks.hazardModules.length
          ? STEEL_ERECTION_HAZARD_MODULE_PACK_KEY
          : null,
        steelHazardModuleTitles: steelReferencePacks.hazardModules.map((module) => module.title),
        steelHazardModules: steelReferencePacks.hazardModuleAiContext,
        steelProgramModulePackKey: steelReferencePacks.programModules.length
          ? STEEL_ERECTION_PROGRAM_MODULE_PACK_KEY
          : null,
        steelProgramModuleTitles: steelReferencePacks.programModules.map(
          (module) => module.title
        ),
        steelProgramModules: steelReferencePacks.programModuleAiContext,
      },
    },
    programSelections,
    documentProfile: {
      documentType: "pshsep",
      projectDeliveryType,
      requestedLabel: SITE_SAFETY_BLUEPRINT_TITLE,
      title: null,
      governingState: jurisdictionSelection.governingState,
      jurisdictionCode: jurisdictionSelection.jurisdictionCode,
      jurisdictionLabel: jurisdictionProfile.jurisdictionLabel,
      jurisdictionPlanType: jurisdictionSelection.jurisdictionPlanType,
      jurisdictionStandardsApplied: [],
      source: "builder_submit",
    },
    legacyFormSnapshot: normalizedFormData as JsonObject,
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
  const pricedAttachments = normalizePricedItemSelections(
    raw.pricedAttachments ?? raw.priced_attachments
  );
  const weather = isRecord(siteContext.weather) ? siteContext.weather : {};
  const schedule = isRecord(scope.schedule) ? scope.schedule : {};
  const builderInstructions = normalizeBuilderInstructions(raw.builderInstructions);

  return ensureOperations({
    project: {
      projectName: String(project.projectName ?? project.project_name ?? "").trim(),
      projectNumber: ensureOptionalString(project.projectNumber ?? project.project_number),
      projectAddress: ensureOptionalString(project.projectAddress ?? project.project_address),
      ownerClient: normalizePartyList(project.ownerClient ?? project.owner_client),
      gcCm: normalizeGcCmPartnerEntries(project.gcCm ?? project.gc_cm),
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
    pricedAttachments,
    builderInstructions,
    documentProfile: {
      documentType,
      projectDeliveryType: normalizeProjectDeliveryType(
        documentProfile.projectDeliveryType ?? documentProfile.project_delivery_type
      ),
      requestedLabel: ensureOptionalString(documentProfile.requestedLabel),
      title: ensureOptionalString(documentProfile.title),
      companyId: ensureOptionalString(documentProfile.companyId),
      jobsiteId: ensureOptionalString(documentProfile.jobsiteId),
      governingState: ensureOptionalString(
        documentProfile.governingState ?? documentProfile.governing_state
      ),
      jurisdictionCode: ensureOptionalString(
        documentProfile.jurisdictionCode ?? documentProfile.jurisdiction_code
      ) as SafetyPlanGenerationContext["documentProfile"]["jurisdictionCode"],
      jurisdictionLabel: ensureOptionalString(
        documentProfile.jurisdictionLabel ?? documentProfile.jurisdiction_label
      ),
      jurisdictionPlanType: ensureOptionalString(
        documentProfile.jurisdictionPlanType ?? documentProfile.jurisdiction_plan_type
      ) as SafetyPlanGenerationContext["documentProfile"]["jurisdictionPlanType"],
      jurisdictionStandardsApplied: asStringArray(
        documentProfile.jurisdictionStandardsApplied ?? documentProfile.jurisdiction_standards_applied
      ),
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
  const fallbackBuilderInstructions =
    params.documentType === "csep"
      ? buildCsepGenerationContext(params.formData).builderInstructions ?? null
      : null;

  const jurisdictionProfile = resolveBuilderJurisdiction({
    governingState:
      rawContext.documentProfile.governingState ??
      ensureOptionalString(params.formData.governing_state ?? params.formData.governingState),
    companyState: ensureOptionalString(
      params.formData.company_state_region ?? params.formData.companyStateRegion
    ),
  });

  return {
    ...rawContext,
    siteContext: {
      ...rawContext.siteContext,
      jobsiteId: params.jobsiteId ?? rawContext.siteContext.jobsiteId ?? null,
    },
    builderInstructions:
      params.documentType === "csep"
        ? rawContext.builderInstructions ?? fallbackBuilderInstructions
        : rawContext.builderInstructions ?? null,
    documentProfile: {
      ...rawContext.documentProfile,
      documentType: params.documentType,
      projectDeliveryType:
        rawContext.documentProfile.projectDeliveryType ??
        normalizeProjectDeliveryType(
          params.formData.project_delivery_type ?? params.formData.projectDeliveryType
        ) ??
        DEFAULT_PROJECT_DELIVERY_TYPE,
      companyId: params.companyId ?? rawContext.documentProfile.companyId ?? null,
      jobsiteId: params.jobsiteId ?? rawContext.documentProfile.jobsiteId ?? null,
      governingState:
        rawContext.documentProfile.governingState ?? jurisdictionProfile.governingState,
      jurisdictionCode:
        rawContext.documentProfile.jurisdictionCode ?? jurisdictionProfile.jurisdictionCode,
      jurisdictionLabel:
        rawContext.documentProfile.jurisdictionLabel ?? jurisdictionProfile.jurisdictionLabel,
      jurisdictionPlanType:
        rawContext.documentProfile.jurisdictionPlanType ??
        jurisdictionProfile.jurisdictionPlanType,
      jurisdictionStandardsApplied:
        rawContext.documentProfile.jurisdictionStandardsApplied ?? [],
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
