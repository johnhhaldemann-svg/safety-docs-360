import type {
  BucketedWorkItem,
  ConflictEvaluation,
  JsonObject,
  PreventionLogicResult,
  RawTaskInput,
  RulesEvaluation,
} from "@/types/safety-intelligence";

function dedupe(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function riskMemoryPatterns(riskMemorySummary: JsonObject | null | undefined): string[] {
  if (!riskMemorySummary || typeof riskMemorySummary !== "object") return [];
  const out: string[] = [];
  const topScopes = riskMemorySummary.topScopes;
  const topHazards = riskMemorySummary.topHazards;
  if (Array.isArray(topScopes)) {
    for (const row of topScopes.slice(0, 5)) {
      if (row && typeof row === "object" && "code" in row && "count" in row) {
        const code = (row as { code?: string | null }).code;
        const count = (row as { count?: number }).count;
        if (code != null && count != null) {
          out.push(`Recurring scope theme: ${String(code)} (${count} signals in window)`);
        }
      }
    }
  }
  if (Array.isArray(topHazards)) {
    for (const row of topHazards.slice(0, 5)) {
      if (row && typeof row === "object" && "code" in row && "count" in row) {
        const code = (row as { code?: string | null }).code;
        const count = (row as { count?: number }).count;
        if (code != null && count != null) {
          out.push(`Recurring hazard theme: ${String(code)} (${count} signals in window)`);
        }
      }
    }
  }
  const grids = riskMemorySummary.topLocationGrids;
  if (Array.isArray(grids)) {
    for (const row of grids.slice(0, 3)) {
      if (row && typeof row === "object" && "label" in row && "count" in row) {
        const label = (row as { label?: string }).label;
        const count = (row as { count?: number }).count;
        if (label && count != null) {
          out.push(`Location hotspot (grid): ${label} (${count})`);
        }
      }
    }
  }
  return dedupe(out);
}

function documentQualityHints(input: RawTaskInput, bucket: BucketedWorkItem): string[] {
  const hints: string[] = [];
  const desc = (input.description ?? "").trim();
  if (desc.length > 0 && desc.length < 40) {
    hints.push("Task description is very short - expand steps, energy sources, and adjacent work.");
  }
  if (desc.length === 0) {
    hints.push("Add a written task description so reviewers can verify hazards and controls.");
  }
  if ((bucket.hazardFamilies?.length ?? 0) === 0 && (input.hazardCategories?.length ?? 0) === 0) {
    hints.push("No hazard families recorded - confirm hazard identification against the work package.");
  }
  if ((bucket.requiredControls?.length ?? 0) === 0 && (input.requiredControls?.length ?? 0) === 0) {
    hints.push("No explicit required controls on the work item - cross-check against trade standards.");
  }
  return hints;
}

export function buildPreventionLogicResult(params: {
  input: RawTaskInput;
  bucket: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
  riskMemorySummary?: JsonObject | null;
}): PreventionLogicResult {
  const { input, bucket, rules, conflicts, riskMemorySummary } = params;

  const missingControls = dedupe([
    ...bucket.requiredControls,
    ...rules.requiredControls,
    ...rules.findings
      .filter((f) => f.requirementType === "required_control")
      .map((f) => f.requirementCode ?? f.code),
  ]);

  const permitRecommendations = dedupe([
    ...bucket.permitTriggers.filter((p) => p !== "none"),
    ...rules.permitTriggers.filter((p) => p !== "none"),
    ...rules.findings
      .filter((f) => f.requirementType === "permit_trigger")
      .map((f) => String(f.requirementCode ?? f.code)),
  ]).map((code) => `Confirm permit / authorization: ${code.replace(/_/g, " ")}`);

  const declaredTraining = dedupe([
    ...bucket.trainingRequirementCodes,
    ...rules.trainingRequirements,
    ...rules.findings
      .filter((f) => f.requirementType === "training_requirement")
      .map((f) => String(f.requirementCode ?? f.code)),
  ]);
  const trainingGaps =
    declaredTraining.length > 0
      ? declaredTraining.map((code) => `Verify training / competency recorded for: ${code.replace(/_/g, " ")}`)
      : ["No explicit training codes on this item - validate role- and equipment-specific training."];

  const repeatRiskPatterns = [
    ...riskMemoryPatterns(riskMemorySummary ?? null),
    ...conflicts.conflicts
      .filter((c) => c.severity === "high" || c.severity === "critical")
      .map((c) => `Simultaneous-operations risk: ${c.rationale}`),
  ];

  return {
    missingControls,
    permitRecommendations,
    trainingGaps: dedupe(trainingGaps),
    repeatRiskPatterns: dedupe(repeatRiskPatterns),
    documentQualityHints: documentQualityHints(input, bucket),
  };
}
