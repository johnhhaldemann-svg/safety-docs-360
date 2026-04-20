import { US_STATE_OPTIONS } from "@/lib/injuryWeather/locationWeather";
import manifest from "@/lib/jurisdictionStandards/source-manifest.json";
import type {
  BuilderJurisdictionSelection,
  JurisdictionCode,
  JurisdictionStandardContent,
  JurisdictionStandardOverride,
  JurisdictionStandardsConfig,
  ResolvedJurisdictionProfile,
} from "@/types/jurisdiction-standards";

type ManifestInput = Partial<JurisdictionStandardsConfig>;

const STATE_NAME_BY_CODE = new Map(US_STATE_OPTIONS.map((item) => [item.code, item.name]));

function normalizeStateCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return STATE_NAME_BY_CODE.has(normalized) ? normalized : null;
}

function dedupe(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalizeContent(input: JurisdictionStandardContent | Record<string, unknown> | undefined) {
  const content = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const checklistSource =
    content.checklist && typeof content.checklist === "object"
      ? (content.checklist as Record<string, unknown>)
      : null;
  const checklist =
    checklistSource
      ? {
          requiredFields: dedupe(
            Array.isArray(checklistSource.requiredFields)
              ? checklistSource.requiredFields.filter(
                  (value): value is string => typeof value === "string"
                )
              : []
          ),
          note:
            typeof checklistSource.note === "string" && checklistSource.note.trim()
              ? checklistSource.note.trim()
              : null,
        }
      : null;

  return {
    body: typeof content.body === "string" && content.body.trim() ? content.body.trim() : null,
    bullets: dedupe(
      Array.isArray(content.bullets)
        ? content.bullets.filter((value): value is string => typeof value === "string")
        : []
    ),
    oshaRefs: dedupe(
      Array.isArray(content.oshaRefs)
        ? content.oshaRefs.filter((value): value is string => typeof value === "string")
        : []
    ),
    requiredControls: dedupe(
      Array.isArray(content.requiredControls)
        ? content.requiredControls.filter((value): value is string => typeof value === "string")
        : []
    ),
    responsibilitiesTraining: dedupe(
      Array.isArray(content.responsibilitiesTraining)
        ? content.responsibilitiesTraining.filter(
            (value): value is string => typeof value === "string"
          )
        : []
    ),
    permitNotes: dedupe(
      Array.isArray(content.permitNotes)
        ? content.permitNotes.filter((value): value is string => typeof value === "string")
        : []
    ),
    trainingNotes: dedupe(
      Array.isArray(content.trainingNotes)
        ? content.trainingNotes.filter((value): value is string => typeof value === "string")
        : []
    ),
    builderGuidance:
      typeof content.builderGuidance === "string" && content.builderGuidance.trim()
        ? content.builderGuidance.trim()
        : null,
    adminReviewNote:
      typeof content.adminReviewNote === "string" && content.adminReviewNote.trim()
        ? content.adminReviewNote.trim()
        : null,
    checklist,
  } satisfies JurisdictionStandardContent;
}

export function normalizeJurisdictionStandardsConfig(
  input: ManifestInput | null | undefined
): JurisdictionStandardsConfig {
  const raw = input ?? {};
  const jurisdictionMap = new Map<
    string,
    JurisdictionStandardsConfig["jurisdictions"][number]
  >();
  const standardMap = new Map<string, JurisdictionStandardsConfig["standards"][number]>();
  const mappingMap = new Map<string, JurisdictionStandardsConfig["mappings"][number]>();

  for (const jurisdiction of Array.isArray(raw.jurisdictions) ? raw.jurisdictions : []) {
    if (!jurisdiction?.code) continue;
    jurisdictionMap.set(jurisdiction.code, {
      ...jurisdiction,
      metadata:
        jurisdiction.metadata && typeof jurisdiction.metadata === "object"
          ? jurisdiction.metadata
          : {},
    });
  }

  for (const standard of Array.isArray(raw.standards) ? raw.standards : []) {
    if (!standard?.id) continue;
    standardMap.set(standard.id, {
      ...standard,
      applicability:
        standard.applicability && typeof standard.applicability === "object"
          ? standard.applicability
          : {},
      content: normalizeContent(standard.content),
      metadata:
        standard.metadata && typeof standard.metadata === "object" ? standard.metadata : {},
    });
  }

  for (const mapping of Array.isArray(raw.mappings) ? raw.mappings : []) {
    if (!mapping?.id || !mapping?.standardId || !mapping?.mappingType || !mapping?.mappingKey) {
      continue;
    }
    mappingMap.set(mapping.id, {
      ...mapping,
      metadata: mapping.metadata && typeof mapping.metadata === "object" ? mapping.metadata : {},
    });
  }

  return {
    jurisdictions: [...jurisdictionMap.values()],
    standards: [...standardMap.values()],
    mappings: [...mappingMap.values()],
  };
}

export const DEFAULT_JURISDICTION_STANDARDS_CONFIG = normalizeJurisdictionStandardsConfig(
  manifest as ManifestInput
);

export function mergeJurisdictionStandardsConfig(params: {
  base: JurisdictionStandardsConfig;
  overrides?: JurisdictionStandardOverride[] | null;
}): JurisdictionStandardsConfig {
  const overridesById = new Map(
    (params.overrides ?? []).map((override) => [override.standardId, override])
  );

  return {
    ...params.base,
    standards: params.base.standards.map((standard) => {
      const override = overridesById.get(standard.id);
      if (!override) {
        return standard;
      }

      return {
        ...standard,
        title:
          typeof override.title === "string" && override.title.trim()
            ? override.title.trim()
            : standard.title,
        summary:
          typeof override.summary === "string" && override.summary.trim()
            ? override.summary.trim()
            : standard.summary,
        applicability:
          override.applicability && typeof override.applicability === "object"
            ? override.applicability
            : standard.applicability,
        content: normalizeContent(override.content ?? standard.content),
        effectiveDate:
          override.effectiveDate === null
            ? null
            : typeof override.effectiveDate === "string" && override.effectiveDate.trim()
              ? override.effectiveDate
              : standard.effectiveDate,
        lastReviewedDate:
          typeof override.lastReviewedDate === "string" && override.lastReviewedDate.trim()
            ? override.lastReviewedDate
            : standard.lastReviewedDate,
        metadata:
          override.metadata && typeof override.metadata === "object"
            ? override.metadata
            : standard.metadata,
      };
    }),
  };
}

export function stateCodeToJurisdictionCode(stateCode: string | null | undefined): JurisdictionCode {
  const normalized = normalizeStateCode(stateCode);
  switch (normalized) {
    case "CA":
      return "ca";
    case "WA":
      return "wa";
    case "OR":
      return "or";
    case "MI":
      return "mi";
    case "NC":
      return "nc";
    default:
      return "federal";
  }
}

export function resolveBuilderJurisdiction(params: {
  governingState?: string | null;
  jobsiteState?: string | null;
  companyState?: string | null;
  config?: JurisdictionStandardsConfig;
}): ResolvedJurisdictionProfile {
  const config = params.config ?? DEFAULT_JURISDICTION_STANDARDS_CONFIG;
  const governingState = normalizeStateCode(params.governingState);
  const jobsiteState = normalizeStateCode(params.jobsiteState);
  const companyState = normalizeStateCode(params.companyState);
  const stateCode = governingState ?? jobsiteState ?? companyState;
  const source = governingState
    ? "document_override"
    : jobsiteState
      ? "jobsite"
      : companyState
        ? "company"
        : "federal_fallback";
  const jurisdictionCode = stateCodeToJurisdictionCode(stateCode);
  const jurisdiction =
    config.jurisdictions.find((item) => item.code === jurisdictionCode) ??
    config.jurisdictions.find((item) => item.code === "federal");
  const stateName = stateCode ? STATE_NAME_BY_CODE.get(stateCode) ?? stateCode : null;

  return {
    governingState: stateCode,
    jurisdictionCode,
    jurisdictionName: jurisdiction?.displayName ?? (stateName || "Federal OSHA"),
    jurisdictionLabel:
      jurisdictionCode === "federal"
        ? stateName
          ? `${stateName} (Federal OSHA)`
          : "Federal OSHA"
        : `${jurisdiction?.displayName ?? stateName ?? jurisdictionCode} State Plan`,
    jurisdictionPlanType:
      jurisdiction?.planType ?? (jurisdictionCode === "federal" ? "federal_osha" : "state_plan"),
    coversPrivateSector: jurisdiction?.coversPrivateSector ?? true,
    source,
  };
}

export function getJurisdictionSurfaceStandards(params: {
  jurisdictionCode: JurisdictionCode;
  surface: "csep" | "peshep";
  config?: JurisdictionStandardsConfig;
}) {
  const config = params.config ?? DEFAULT_JURISDICTION_STANDARDS_CONFIG;
  const standards = config.standards.filter((standard) => {
    if (standard.surfaceScope !== "both" && standard.surfaceScope !== params.surface) {
      return false;
    }
    if (standard.jurisdictionCode === "federal") {
      return true;
    }
    return standard.jurisdictionCode === params.jurisdictionCode;
  });

  return standards.map((standard) => ({
    ...standard,
    mappings: config.mappings.filter((mapping) => mapping.standardId === standard.id),
  }));
}

export function describeJurisdictionSelection(
  profile: ResolvedJurisdictionProfile
): BuilderJurisdictionSelection {
  return {
    governingState: profile.governingState,
    jurisdictionCode: profile.jurisdictionCode,
    jurisdictionPlanType: profile.jurisdictionPlanType,
  };
}

export function getJurisdictionStateOptions() {
  return US_STATE_OPTIONS;
}
