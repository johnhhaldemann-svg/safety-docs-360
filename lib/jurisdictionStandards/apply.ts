import { getProgramSelectionKey } from "@/lib/csepPrograms";
import { getJurisdictionSurfaceStandards } from "@/lib/jurisdictionStandards/catalog";
import { getStateRequirementSupplement } from "@/lib/jurisdictionStandards/stateRequirements";
import type { ChecklistMappingEvidence } from "@/lib/compliance/checklistMapping";
import type { ChecklistSurface, HseChecklistItem } from "@/lib/compliance/types";
import type { CSEPProgramSelection } from "@/types/csep-programs";
import type {
  JurisdictionStandardsConfig,
  ResolvedJurisdictionProfile,
} from "@/types/jurisdiction-standards";
import type {
  GeneratedSafetyPlanSection,
  SafetyPlanGenerationContext,
} from "@/types/safety-intelligence";

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function hasSignal(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function appendBody(current: string | null | undefined, additions: string[]) {
  const next = dedupe([current ?? "", ...additions]);
  return next.length ? next.join(" ") : current ?? null;
}

function appendBullets(current: string[] | undefined, additions: string[]) {
  return dedupe([...(current ?? []), ...additions]);
}

function appendToSubsection(
  section: GeneratedSafetyPlanSection,
  title: string,
  additions: string[]
): GeneratedSafetyPlanSection {
  if (additions.length === 0) return section;
  const subsections = section.subsections ?? [];
  const existing = subsections.find((item) => item.title === title);

  if (!existing) {
    return {
      ...section,
      subsections: [...subsections, { title, bullets: additions }],
    };
  }

  return {
    ...section,
    subsections: subsections.map((item) =>
      item.title === title ? { ...item, bullets: appendBullets(item.bullets, additions) } : item
    ),
  };
}

function applyStandardToSection(
  section: GeneratedSafetyPlanSection,
  standard: ReturnType<typeof getJurisdictionSurfaceStandards>[number]
): GeneratedSafetyPlanSection {
  // `builderGuidance` is for builder / super-admin tooling only — never merge into issued document text.
  const suppressFederalBaselineProfileNarrative =
    section.key === "jurisdiction_profile" && standard.id === "std_federal_baseline";
  const bodyAdditions = suppressFederalBaselineProfileNarrative
    ? []
    : [standard.content.body ?? ""].filter((text) => text.trim().length > 0);
  const bulletAdditions = suppressFederalBaselineProfileNarrative ? [] : standard.content.bullets ?? [];

  const sectionWithBody: GeneratedSafetyPlanSection = {
    ...section,
    body: appendBody(section.body, bodyAdditions),
    bullets: appendBullets(section.bullets, bulletAdditions),
  };

  let next = sectionWithBody;
  next = appendToSubsection(next, "Applicable References", standard.content.oshaRefs ?? []);
  next = appendToSubsection(
    next,
    "Minimum Required Controls",
    [...(standard.content.requiredControls ?? []), ...(standard.content.permitNotes ?? [])]
  );
  next = appendToSubsection(
    next,
    "Responsibilities and Training",
    [...(standard.content.responsibilitiesTraining ?? []), ...(standard.content.trainingNotes ?? [])]
  );
  return next;
}

export function buildJurisdictionProfileSection(params: {
  profile: ResolvedJurisdictionProfile;
  appliedStandards: ReturnType<typeof getJurisdictionSurfaceStandards>;
}): GeneratedSafetyPlanSection {
  const stateSupplement = getStateRequirementSupplement(params.profile.governingState) ?? {
    body: null,
    bullets: [] as string[],
  };
  const standardLines = params.appliedStandards.map(
    (standard) => `Applicable standard: ${standard.title}.`
  );
  const bullets = standardLines.length
    ? standardLines
    : ["No jurisdiction-specific standards were applied."];

  return {
    key: "jurisdiction_profile",
    title: "Jurisdiction Profile",
    body:
      params.profile.jurisdictionPlanType === "state_plan"
        ? appendBody(
            `${params.profile.jurisdictionLabel} governs this project. Federal OSHA baseline requirements remain in scope, and applicable state-plan requirements must also be followed.`,
            [stateSupplement.body ?? ""]
          )
        : appendBody(
            `${params.profile.jurisdictionLabel} governs this project. The document follows the federal OSHA construction baseline unless a project-specific jurisdictional requirement adds to it.`,
            [stateSupplement.body ?? ""]
          ),
    bullets: appendBullets(bullets, stateSupplement.bullets),
  } satisfies GeneratedSafetyPlanSection;
}

export function applyJurisdictionStandardsToCsep(params: {
  sections: GeneratedSafetyPlanSection[];
  selections: CSEPProgramSelection[];
  profile: ResolvedJurisdictionProfile;
  config?: JurisdictionStandardsConfig;
}) {
  const appliedStandards = getJurisdictionSurfaceStandards({
    jurisdictionCode: params.profile.jurisdictionCode,
    surface: "csep",
    config: params.config,
  });
  const sectionMap = new Map(params.sections.map((section) => [section.key, section]));

  sectionMap.set(
    "jurisdiction_profile",
    buildJurisdictionProfileSection({ profile: params.profile, appliedStandards })
  );

  for (const standard of appliedStandards) {
    for (const mapping of standard.mappings) {
      if (mapping.mappingType === "section_key") {
        const section = sectionMap.get(mapping.mappingKey);
        if (section) {
          sectionMap.set(mapping.mappingKey, applyStandardToSection(section, standard));
        }
        continue;
      }

      if (mapping.mappingType === "program_item") {
        const [category, item] = mapping.mappingKey.split(":");
        const selection = params.selections.find(
          (candidate) => candidate.category === category && candidate.item === item
        );
        if (!selection) continue;
        const sectionKey = `program_${getProgramSelectionKey(selection.category, selection.item, selection.subtype)}`;
        const section = sectionMap.get(sectionKey);
        if (section) {
          sectionMap.set(sectionKey, applyStandardToSection(section, standard));
        }
      }
    }
  }

  return {
    sections: [...sectionMap.values()],
    appliedStandards,
  };
}

export function applyJurisdictionStandardsToPeshep(params: {
  sections: GeneratedSafetyPlanSection[];
  profile: ResolvedJurisdictionProfile;
  config?: JurisdictionStandardsConfig;
}) {
  const appliedStandards = getJurisdictionSurfaceStandards({
    jurisdictionCode: params.profile.jurisdictionCode,
    surface: "peshep",
    config: params.config,
  });
  const sectionMap = new Map(params.sections.map((section) => [section.key, section]));

  sectionMap.set(
    "jurisdiction_profile",
    buildJurisdictionProfileSection({ profile: params.profile, appliedStandards })
  );

  for (const standard of appliedStandards) {
    for (const mapping of standard.mappings) {
      if (mapping.mappingType !== "section_key") continue;
      const section = sectionMap.get(mapping.mappingKey);
      if (section) {
        sectionMap.set(mapping.mappingKey, applyStandardToSection(section, standard));
      }
    }
  }

  return {
    sections: [...sectionMap.values()],
    appliedStandards,
  };
}

export function buildJurisdictionChecklistEvidence(params: {
  surface: ChecklistSurface;
  formData: Record<string, unknown>;
  profile: ResolvedJurisdictionProfile;
  config?: JurisdictionStandardsConfig;
}): ChecklistMappingEvidence[] {
  const appliedStandards = getJurisdictionSurfaceStandards({
    jurisdictionCode: params.profile.jurisdictionCode,
    surface: params.surface,
    config: params.config,
  });

  return appliedStandards
    .filter((standard) => (standard.content.checklist?.requiredFields?.length ?? 0) > 0)
    .map((standard) => {
      const requiredFields = standard.content.checklist?.requiredFields ?? [];
      const currentFields = requiredFields.filter((field) => hasSignal(readPath(params.formData, field)));
      const missingFields = requiredFields.filter((field) => !currentFields.includes(field));
      const item: HseChecklistItem = {
        id: `jurisdiction:${standard.id}`,
        category: "CompanyPolicy",
        item: `${params.profile.jurisdictionLabel}: ${standard.title}`,
        appliesTo: params.surface,
        requirementType: "project_specific",
        outputSection: "jurisdiction_profile",
        aiAction: "manual_review",
        requiredUserConfirmation: true,
        manualReviewDefault: true,
      };

      return {
        item,
        applies: true,
        triggerActive: true,
        evidencePresent: currentFields.length > 0,
        currentFields,
        missingFields,
        notes: dedupe([
          `jurisdiction:${params.profile.jurisdictionCode}`,
          params.profile.jurisdictionPlanType === "state_plan" ? "state_plan_delta" : "federal_baseline",
          standard.content.checklist?.note ?? "",
        ]),
      };
    });
}

export function getJurisdictionProfileFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): ResolvedJurisdictionProfile {
  return {
    governingState: generationContext.documentProfile.governingState ?? null,
    jurisdictionCode: generationContext.documentProfile.jurisdictionCode ?? "federal",
    jurisdictionName:
      generationContext.documentProfile.jurisdictionCode === "federal"
        ? "Federal OSHA"
        : generationContext.documentProfile.jurisdictionCode?.toUpperCase() ?? "Federal OSHA",
    jurisdictionLabel: generationContext.documentProfile.jurisdictionLabel ?? "Federal OSHA",
    jurisdictionPlanType: generationContext.documentProfile.jurisdictionPlanType ?? "federal_osha",
    coversPrivateSector: true,
    source: "document_override",
  };
}
