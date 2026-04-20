export type CSEPProgramCategory = "hazard" | "permit" | "ppe";

export type CSEPProgramSubtypeGroup = "confined_space_classification";

export type CSEPProgramSubtypeValue = "permit_required" | "non_permit";

export type CSEPProgramSelectionSource = "selected" | "derived" | "default";

export type CSEPProgramSelection = {
  category: CSEPProgramCategory;
  item: string;
  subtype?: CSEPProgramSubtypeValue | null;
  relatedTasks: string[];
  source: CSEPProgramSelectionSource;
};

export type CSEPProgramSubtypeOption = {
  value: CSEPProgramSubtypeValue;
  label: string;
  description: string;
};

export type CSEPProgramSubtypeConfig = {
  group: CSEPProgramSubtypeGroup;
  label: string;
  prompt: string;
  options: CSEPProgramSubtypeOption[];
};

export type CSEPProgramSelectionInput = {
  category: CSEPProgramCategory;
  item: string;
  relatedTasks?: string[];
  subtype?: CSEPProgramSubtypeValue | null;
  source?: CSEPProgramSelectionSource;
};

export type CSEPProgramDefinitionContent = {
  title: string;
  summary: string;
  oshaRefs: string[];
  applicableWhen: string[];
  responsibilities: string[];
  preTaskProcedures: string[];
  workProcedures: string[];
  stopWorkProcedures: string[];
  closeoutProcedures: string[];
  controls: string[];
  training: string[];
};

export type CSEPProgramDefinition = CSEPProgramDefinitionContent & {
  category: CSEPProgramCategory;
  item: string;
  subtypeGroup?: CSEPProgramSubtypeGroup;
  subtypeVariants?: Partial<
    Record<CSEPProgramSubtypeValue, Partial<CSEPProgramDefinitionContent>>
  >;
};

export type CSEPProgramConfig = {
  definitions: CSEPProgramDefinition[];
};

export type CSEPProgramSection = {
  key: string;
  category: CSEPProgramCategory;
  item: string;
  subtype?: CSEPProgramSubtypeValue | null;
  title: string;
  summary: string;
  relatedTasks: string[];
  subsections: Array<{
    title: string;
    bullets: string[];
  }>;
};
