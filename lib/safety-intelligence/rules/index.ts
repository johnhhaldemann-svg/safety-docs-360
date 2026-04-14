import type {
  BucketedWorkItem,
  RawTaskInput,
  RiskBand,
  RuleTemplateRecord,
  RulesEvaluation,
  RulesFinding,
} from "@/types/safety-intelligence";
import { findCatalogMatches, STATIC_PLATFORM_RULE_TEMPLATES } from "@/lib/safety-intelligence/rules/catalog";

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function severityPoints(severity: string) {
  if (severity === "critical") return 10;
  if (severity === "high") return 7;
  if (severity === "medium") return 4;
  return 2;
}

function bandFromScore(score: number): RiskBand {
  if (score >= 24) return "critical";
  if (score >= 16) return "high";
  if (score >= 8) return "moderate";
  return "low";
}

function mergeValues(current: string[], incoming: string[], behavior: RuleTemplateRecord["mergeBehavior"]) {
  if (behavior === "override") {
    return dedupe(incoming);
  }
  return dedupe([...current, ...incoming]);
}

function findingSeverityForRequirement(type: RulesFinding["requirementType"], code: string) {
  if (type === "permit_trigger") return "high";
  if (type === "weather_restriction") return "high";
  if (type === "site_restriction") return "high";
  if (type === "prohibited_equipment") return "critical";
  if (type === "hazard_family" && (code === "electrical" || code === "collapse")) {
    return "critical";
  }
  return "medium";
}

function pushFinding(
  findings: RulesFinding[],
  type: RulesFinding["requirementType"],
  code: string,
  detail: string,
  template?: RuleTemplateRecord
) {
  findings.push({
    code,
    label: code.replace(/_/g, " "),
    severity: findingSeverityForRequirement(type, code),
    detail,
    requirementType: type,
    requirementCode: code,
    sourceType: template?.sourceType,
    sourceRuleCode: template?.code ?? null,
  });
}

export function evaluateRules(
  raw: RawTaskInput,
  bucket: BucketedWorkItem,
  templates: RuleTemplateRecord[] = STATIC_PLATFORM_RULE_TEMPLATES
): RulesEvaluation {
  const matches = findCatalogMatches(raw, bucket, templates).sort(
    (left, right) => left.precedence - right.precedence
  );
  const findings: RulesFinding[] = [];
  let permitTriggers = [...bucket.permitTriggers];
  let hazardFamilies = [...bucket.hazardFamilies];
  let hazardCategories = [...(raw.hazardCategories ?? [])];
  let ppeRequirements = [...bucket.ppeRequirements];
  let equipmentChecks: string[] = [];
  let weatherRestrictions: string[] = [];
  let requiredControls = [...bucket.requiredControls];
  let siteRestrictions = [...bucket.siteRestrictions];
  let prohibitedEquipment = [...bucket.prohibitedEquipment];
  let trainingRequirements = [...bucket.trainingRequirementCodes];
  const sourceBreakdown = new Map<string, { sourceType: RuleTemplateRecord["sourceType"]; sourceId?: string | null; ruleCodes: string[] }>();

  for (const match of matches) {
    const sourceKey = `${match.sourceType}:${match.sourceId ?? "global"}`;
    if (!sourceBreakdown.has(sourceKey)) {
      sourceBreakdown.set(sourceKey, {
        sourceType: match.sourceType,
        sourceId: match.sourceId ?? null,
        ruleCodes: [],
      });
    }
    sourceBreakdown.get(sourceKey)?.ruleCodes.push(match.code);

    permitTriggers = mergeValues(
      permitTriggers,
      match.outputs.permitTriggers ?? [],
      match.mergeBehavior
    ) as RulesEvaluation["permitTriggers"];
    hazardFamilies = mergeValues(
      hazardFamilies,
      match.outputs.hazardFamilies ?? [],
      match.mergeBehavior
    ) as RulesEvaluation["hazardFamilies"];
    hazardCategories = mergeValues(
      hazardCategories,
      match.outputs.hazardCategories ?? [],
      match.mergeBehavior
    );
    ppeRequirements = mergeValues(ppeRequirements, match.outputs.ppeRequirements ?? [], match.mergeBehavior);
    equipmentChecks = mergeValues(equipmentChecks, match.outputs.equipmentChecks ?? [], match.mergeBehavior);
    weatherRestrictions = mergeValues(
      weatherRestrictions,
      match.outputs.weatherRestrictions ?? [],
      match.mergeBehavior
    );
    requiredControls = mergeValues(
      requiredControls,
      match.outputs.requiredControls ?? [],
      match.mergeBehavior
    );
    siteRestrictions = mergeValues(
      siteRestrictions,
      match.outputs.siteRestrictions ?? [],
      match.mergeBehavior
    );
    prohibitedEquipment = mergeValues(
      prohibitedEquipment,
      match.outputs.prohibitedEquipment ?? [],
      match.mergeBehavior
    );
    trainingRequirements = mergeValues(
      trainingRequirements,
      match.outputs.trainingRequirements ?? [],
      match.mergeBehavior
    );
  }

  for (const permit of permitTriggers) {
    pushFinding(findings, "permit_trigger", permit, `Permit trigger detected for ${raw.taskTitle}.`);
  }
  for (const hazard of hazardFamilies) {
    pushFinding(findings, "hazard_family", hazard, `Hazard family ${hazard.replace(/_/g, " ")} applies to ${raw.taskTitle}.`);
  }
  for (const category of hazardCategories) {
    pushFinding(findings, "hazard_category", category, `Hazard category ${category} applies to ${raw.taskTitle}.`);
  }
  for (const control of requiredControls) {
    pushFinding(findings, "required_control", control, `Required control ${control.replace(/_/g, " ")} must be verified before work starts.`);
  }
  for (const ppe of ppeRequirements) {
    pushFinding(findings, "ppe_requirement", ppe, `PPE requirement ${ppe.replace(/_/g, " ")} applies.`);
  }
  for (const equipment of equipmentChecks) {
    pushFinding(findings, "equipment_check", equipment, `Equipment check ${equipment.replace(/_/g, " ")} is required.`);
  }
  for (const weather of weatherRestrictions) {
    pushFinding(findings, "weather_restriction", weather, `Weather restriction ${weather.replace(/_/g, " ")} applies.`);
  }
  for (const restriction of siteRestrictions) {
    pushFinding(findings, "site_restriction", restriction, `${restriction} must be enforced for ${raw.taskTitle}.`);
  }
  for (const item of prohibitedEquipment) {
    pushFinding(findings, "prohibited_equipment", item, `${item.replace(/_/g, " ")} is prohibited for ${raw.taskTitle}.`);
  }
  for (const training of trainingRequirements) {
    pushFinding(findings, "training_requirement", training, `Training requirement ${training.replace(/_/g, " ")} is required.`);
  }

  if ((raw.weatherConditionCode ?? "").toLowerCase().includes("storm")) {
    pushFinding(
      findings,
      "weather_restriction",
      "storm_pause",
      "Storm conditions require stop-work review before task execution."
    );
    weatherRestrictions = dedupe([...weatherRestrictions, "storm_pause"]);
  }

  const score = findings.reduce((sum, finding) => sum + severityPoints(finding.severity), 0);

  return {
    bucketKey: bucket.bucketKey,
    operationId: raw.operationId ?? bucket.operationId ?? null,
    findings,
    permitTriggers: dedupe(permitTriggers) as RulesEvaluation["permitTriggers"],
    hazardFamilies: dedupe(hazardFamilies) as RulesEvaluation["hazardFamilies"],
    hazardCategories: dedupe(hazardCategories),
    ppeRequirements: dedupe(ppeRequirements),
    equipmentChecks: dedupe(equipmentChecks),
    weatherRestrictions: dedupe(weatherRestrictions),
    requiredControls: dedupe(requiredControls),
    siteRestrictions: dedupe(siteRestrictions),
    prohibitedEquipment: dedupe(prohibitedEquipment),
    trainingRequirements: dedupe(trainingRequirements),
    score,
    band: bandFromScore(score),
    evaluationVersion: matches.length ? matches.map((match) => match.version).join("|") : "v2",
    sourceBreakdown: [...sourceBreakdown.values()],
  };
}
