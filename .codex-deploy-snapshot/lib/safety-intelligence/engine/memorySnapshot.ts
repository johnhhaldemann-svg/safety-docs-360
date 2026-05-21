import type {
  BucketedWorkItem,
  ConflictEvaluation,
  JsonObject,
  RawTaskInput,
  RulesEvaluation,
  SafetyMemorySnapshot,
} from "@/types/safety-intelligence";
import { SAFETY_MEMORY_SNAPSHOT_VERSION } from "@/types/safety-intelligence";

export function buildSafetyMemorySnapshot(params: {
  input: RawTaskInput;
  bucket: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
  riskMemorySummary?: JsonObject | null;
}): SafetyMemorySnapshot {
  const { input, bucket, rules, conflicts, riskMemorySummary } = params;
  const now = new Date().toISOString();

  const companyRefs = [`company:${input.companyId}`];
  const jobsiteRefs =
    input.jobsiteId != null && String(input.jobsiteId).length > 0
      ? [`jobsite:${input.jobsiteId}`]
      : [];

  const tradeCodes = [bucket.tradeCode, bucket.subTradeCode, input.tradeCode, input.subTradeCode].filter(
    (c): c is string => Boolean(c && String(c).trim())
  );

  const hazardFamilies = [...new Set([...bucket.hazardFamilies, ...rules.hazardFamilies])];
  const hazardCategories = [...new Set([...rules.hazardCategories, ...(input.hazardCategories ?? [])])];

  const incidentModules =
    bucket.bucketType === "incident_signal" && bucket.source?.module
      ? [bucket.source.module]
      : [];

  const rmHints: string[] = [];
  if (riskMemorySummary && typeof riskMemorySummary === "object") {
    const band = riskMemorySummary.aggregatedWithBaseline;
    const agg = band && typeof band === "object" ? band : riskMemorySummary.aggregated;
    if (agg && typeof agg === "object" && "band" in agg) {
      rmHints.push(`Risk Memory rollup band (window): ${String((agg as { band?: string }).band ?? "")}`);
    }
    const fc = riskMemorySummary.facetCount;
    if (typeof fc === "number") {
      rmHints.push(`Facet observations in window: ${fc}`);
    }
  }

  return {
    version: SAFETY_MEMORY_SNAPSHOT_VERSION,
    generatedAt: now,
    company: { companyId: input.companyId, refs: companyRefs, notes: null },
    jobsite: { jobsiteId: input.jobsiteId ?? null, refs: jobsiteRefs, notes: null },
    trade: { codes: [...new Set(tradeCodes)] },
    hazard: { families: hazardFamilies, categories: hazardCategories },
    task: {
      titles: [bucket.taskTitle].filter(Boolean),
      taskCodes: [bucket.taskCode, input.taskCode].filter((c): c is string => Boolean(c)),
    },
    permit: { triggers: [...new Set([...bucket.permitTriggers, ...rules.permitTriggers])] },
    training: {
      requirementCodes: [...new Set([...bucket.trainingRequirementCodes, ...rules.trainingRequirements])],
    },
    incident: {
      signalCount: bucket.bucketType === "incident_signal" ? 1 : 0,
      sourceModules: incidentModules,
    },
    documentQuality: {
      hints: [
        ...new Set([
          ...(conflicts.matrix?.length
            ? [`${conflicts.matrix.length} conflict-matrix item(s) require coordination review.`]
            : []),
          ...rmHints,
        ]),
      ],
    },
  };
}
