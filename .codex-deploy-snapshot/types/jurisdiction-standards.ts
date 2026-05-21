export type JurisdictionCode = "federal" | "ca" | "wa" | "or" | "mi" | "nc";

export type JurisdictionPlanType = "federal_osha" | "state_plan";

export type JurisdictionSurfaceScope = "csep" | "peshep" | "both";

export type JurisdictionStandardType =
  | "osha_ref"
  | "program_requirement"
  | "permit_requirement"
  | "training_requirement"
  | "builder_prompt_delta"
  | "admin_review_note";

export type JurisdictionStandardMappingType =
  | "program_item"
  | "pshsep_catalog"
  | "section_key"
  | "checklist_field";

export type JurisdictionDefinition = {
  code: JurisdictionCode;
  stateCode: string | null;
  displayName: string;
  planType: JurisdictionPlanType;
  coversPrivateSector: boolean;
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthority: string;
  effectiveDate: string | null;
  lastReviewedDate: string;
  metadata?: Record<string, unknown>;
};

export type JurisdictionStandardContent = {
  body?: string | null;
  bullets?: string[];
  oshaRefs?: string[];
  requiredControls?: string[];
  responsibilitiesTraining?: string[];
  permitNotes?: string[];
  trainingNotes?: string[];
  builderGuidance?: string | null;
  adminReviewNote?: string | null;
  checklist?: {
    requiredFields?: string[];
    note?: string | null;
  } | null;
};

export type JurisdictionStandard = {
  id: string;
  jurisdictionCode: JurisdictionCode;
  surfaceScope: JurisdictionSurfaceScope;
  standardType: JurisdictionStandardType;
  title: string;
  summary: string;
  applicability: Record<string, unknown>;
  content: JurisdictionStandardContent;
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthority: string;
  effectiveDate: string | null;
  lastReviewedDate: string;
  metadata?: Record<string, unknown>;
};

export type JurisdictionStandardMapping = {
  id: string;
  standardId: string;
  mappingType: JurisdictionStandardMappingType;
  mappingKey: string;
  metadata?: Record<string, unknown>;
};

export type JurisdictionStandardOverride = {
  standardId: string;
  title?: string | null;
  summary?: string | null;
  applicability?: Record<string, unknown> | null;
  content?: JurisdictionStandardContent | null;
  effectiveDate?: string | null;
  lastReviewedDate?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type JurisdictionStandardsConfig = {
  jurisdictions: JurisdictionDefinition[];
  standards: JurisdictionStandard[];
  mappings: JurisdictionStandardMapping[];
};

export type ResolvedJurisdictionProfile = {
  governingState: string | null;
  jurisdictionCode: JurisdictionCode;
  jurisdictionName: string;
  jurisdictionLabel: string;
  jurisdictionPlanType: JurisdictionPlanType;
  coversPrivateSector: boolean;
  source: "document_override" | "jobsite" | "company" | "federal_fallback";
};

export type BuilderJurisdictionSelection = {
  governingState: string | null;
  jurisdictionCode: JurisdictionCode;
  jurisdictionPlanType: JurisdictionPlanType;
};
