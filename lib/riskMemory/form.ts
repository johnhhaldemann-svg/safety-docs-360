export type RiskMemoryFormInput = {
  scopeOfWork: string;
  trade: string;
  subTrade: string;
  task: string;
  primaryHazard: string;
  secondaryHazard1: string;
  secondaryHazard2: string;
  rootCauseLevel1: string;
  rootCauseLevel2: string;
  failedControl: string;
  weather: string;
  potentialSeverity: string;
  actualOutcomeSeverity: string;
  /** Free-text contractor label (stored on facet as contractor_label). */
  contractor: string;
  /** Optional FK to company_contractors when configured in workspace. */
  contractorId: string;
  /** Optional FK to company_crews (company-wide or jobsite-scoped). */
  crewId: string;
  behaviorCategory: string;
  trainingStatus: string;
  supervisionStatus: string;
  equipmentType: string;
  costImpactBand: string;
  /** 0–1 string for input control; API sends number when valid. */
  forecastConfidence: string;
  locationGrid: string;
  locationArea: string;
  timeOfDay: string;
  permitStatus: string;
  ppeStatus: string;
  correctiveActionStatus: string;
};

export const EMPTY_RISK_MEMORY_FORM: RiskMemoryFormInput = {
  scopeOfWork: "",
  trade: "",
  subTrade: "",
  task: "",
  primaryHazard: "",
  secondaryHazard1: "",
  secondaryHazard2: "",
  rootCauseLevel1: "",
  rootCauseLevel2: "",
  failedControl: "",
  weather: "",
  potentialSeverity: "",
  actualOutcomeSeverity: "",
  contractor: "",
  contractorId: "",
  crewId: "",
  behaviorCategory: "",
  trainingStatus: "",
  supervisionStatus: "",
  equipmentType: "",
  costImpactBand: "",
  forecastConfidence: "",
  locationGrid: "",
  locationArea: "",
  timeOfDay: "",
  permitStatus: "",
  ppeStatus: "",
  correctiveActionStatus: "",
};

export function buildRiskMemoryApiObject(f: RiskMemoryFormInput): Record<string, unknown> | null {
  const secondaryHazards = [f.secondaryHazard1, f.secondaryHazard2].filter(Boolean);
  const fcRaw = f.forecastConfidence.trim();
  const fcNum = fcRaw === "" ? null : Number(fcRaw);
  const forecastConfidence =
    fcNum != null && Number.isFinite(fcNum) ? Math.min(1, Math.max(0, fcNum)) : undefined;
  const has =
    f.scopeOfWork ||
    f.trade ||
    f.subTrade ||
    f.task ||
    f.primaryHazard ||
    secondaryHazards.length > 0 ||
    f.rootCauseLevel1 ||
    f.rootCauseLevel2 ||
    f.failedControl ||
    f.weather ||
    f.potentialSeverity ||
    f.actualOutcomeSeverity ||
    f.contractor ||
    f.contractorId ||
    f.crewId ||
    f.behaviorCategory ||
    f.trainingStatus ||
    f.supervisionStatus ||
    f.equipmentType ||
    f.costImpactBand ||
    forecastConfidence !== undefined ||
    f.locationGrid.trim() ||
    f.locationArea ||
    f.timeOfDay ||
    f.permitStatus ||
    f.ppeStatus ||
    f.correctiveActionStatus;
  if (!has) return null;
  return {
    scopeOfWork: f.scopeOfWork || undefined,
    trade: f.trade || undefined,
    subTrade: f.subTrade || undefined,
    task: f.task || undefined,
    primaryHazard: f.primaryHazard || undefined,
    secondaryHazards: secondaryHazards.length ? secondaryHazards : undefined,
    rootCauseLevel1: f.rootCauseLevel1 || undefined,
    rootCauseLevel2: f.rootCauseLevel2 || undefined,
    failedControl: f.failedControl || undefined,
    weather: f.weather || undefined,
    potentialSeverity: f.potentialSeverity || undefined,
    actualOutcomeSeverity: f.actualOutcomeSeverity || undefined,
    contractor: f.contractor || undefined,
    contractorId: f.contractorId || undefined,
    crewId: f.crewId || undefined,
    behaviorCategory: f.behaviorCategory || undefined,
    trainingStatus: f.trainingStatus || undefined,
    supervisionStatus: f.supervisionStatus || undefined,
    equipmentType: f.equipmentType.trim() || undefined,
    costImpactBand: f.costImpactBand || undefined,
    forecastConfidence,
    locationGrid: f.locationGrid.trim() || undefined,
    locationArea: f.locationArea || undefined,
    timeOfDay: f.timeOfDay || undefined,
    permitStatus: f.permitStatus || undefined,
    ppeStatus: f.ppeStatus || undefined,
    correctiveActionStatus: f.correctiveActionStatus || undefined,
  };
}
