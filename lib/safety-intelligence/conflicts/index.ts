import type {
  BucketedWorkItem,
  ConflictEvaluation,
  ConflictMatrix,
  ConflictMatrixItem,
  RulesEvaluation,
  RiskBand,
} from "@/types/safety-intelligence";
import { DEFAULT_CONFLICT_SEEDS, includeRulesTokens } from "@/lib/safety-intelligence/conflicts/defaultPairs";

function safeArray<T>(value: T[] | undefined | null) {
  return Array.isArray(value) ? value : [];
}

function toTimestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function overlaps(aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) {
  const startA = toTimestamp(aStart);
  const endA = toTimestamp(aEnd) ?? startA;
  const startB = toTimestamp(bStart);
  const endB = toTimestamp(bEnd) ?? startB;
  if (startA == null || startB == null) return false;
  return startA <= (endB ?? startB) && startB <= (endA ?? startA);
}

function bandFromScore(score: number): RiskBand {
  if (score >= 18) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "moderate";
  return "low";
}

function scoreConflict(item: ConflictMatrixItem) {
  if (item.severity === "critical") return 8;
  if (item.severity === "high") return 5;
  if (item.severity === "medium") return 3;
  return 1;
}

function dedupeMatrix(items: ConflictMatrixItem[]) {
  const seen = new Set<string>();
  const next: ConflictMatrixItem[] = [];

  for (const item of items) {
    const key = [
      item.code,
      item.type,
      item.sourceScope,
      [...item.operationIds].sort().join("|"),
      [...item.relatedBucketKeys].sort().join("|"),
    ].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }

  return next;
}

function maybePush(conflicts: ConflictMatrixItem[], item: ConflictMatrixItem | null) {
  if (item) {
    conflicts.push(item);
  }
}

function buildPairConflictItems(params: {
  left: BucketedWorkItem;
  right: BucketedWorkItem;
  leftRules: RulesEvaluation;
  rightRules: RulesEvaluation;
  sourceScope: ConflictMatrixItem["sourceScope"];
}) {
  const { left, right, leftRules, rightRules, sourceScope } = params;
  const items: ConflictMatrixItem[] = [];
  const leftText = includeRulesTokens(`${left.tradeCode ?? ""} ${left.taskTitle}`, leftRules);
  const rightText = includeRulesTokens(`${right.tradeCode ?? ""} ${right.taskTitle}`, rightRules);
  const sameArea =
    left.workAreaLabel &&
    right.workAreaLabel &&
    left.workAreaLabel.toLowerCase() === right.workAreaLabel.toLowerCase();
  const overlappingWindow = overlaps(left.startsAt, left.endsAt, right.startsAt, right.endsAt);
  const sharedOperationIds = [left.operationId ?? left.bucketKey, right.operationId ?? right.bucketKey];
  const sharedBucketKeys = [left.bucketKey, right.bucketKey];
  const leftPermitTriggers = safeArray(leftRules.permitTriggers);
  const rightPermitTriggers = safeArray(rightRules.permitTriggers);
  const leftHazardFamilies = safeArray(leftRules.hazardFamilies);
  const rightHazardFamilies = safeArray(rightRules.hazardFamilies);
  const permitDependencies = [
    ...leftPermitTriggers,
    ...rightPermitTriggers,
  ].filter((permit) => permit !== "none");

  if (sameArea) {
    maybePush(
      items,
      {
        code: "location_overlap",
        type: "location_overlap",
        severity: overlappingWindow ? "high" : "medium",
        sourceScope,
        rationale: `Operations share work area ${left.workAreaLabel}.`,
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: ["area_coordination_meeting", "boundary_control"],
        permitDependencies,
        resequencingSuggestion: overlappingWindow ? "Stagger work in the shared area." : null,
        metadata: {
          workAreaLabel: left.workAreaLabel ?? null,
          overlappingWindow: Boolean(overlappingWindow),
        },
      }
    );
  }

  if (overlappingWindow) {
    maybePush(
      items,
      {
        code: "schedule_overlap",
        type: "schedule_overlap",
        severity: sameArea ? "high" : "medium",
        sourceScope,
        rationale: "Operations overlap in time and require sequencing review.",
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: ["staggered_schedule", "daily_coordination_meeting"],
        permitDependencies,
        resequencingSuggestion: "Resequence crews or create a protected work window.",
        metadata: {
          sameArea: Boolean(sameArea),
        },
      }
    );
  }

  if (
    overlappingWindow &&
    sameArea &&
    left.tradeCode &&
    right.tradeCode &&
    left.tradeCode !== right.tradeCode
  ) {
    maybePush(
      items,
      {
        code: "trade_vs_trade_overlap",
        type: "trade_vs_trade",
        severity: "high",
        sourceScope,
        rationale: `${left.tradeCode} and ${right.tradeCode} are active together in the same work zone.`,
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: ["trade_coordination_meeting", "shared_work_plan"],
        permitDependencies,
        resequencingSuggestion: "Separate trade work windows or define a lead trade.",
      }
    );
  }

  if (overlappingWindow && left.taskTitle.toLowerCase() === right.taskTitle.toLowerCase()) {
    maybePush(
      items,
      {
        code: "task_overlap",
        type: "task_vs_task",
        severity: "medium",
        sourceScope,
        rationale: `Duplicate or overlapping task execution detected for ${left.taskTitle}.`,
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: ["scope_alignment", "single_owner_assignment"],
        permitDependencies,
        resequencingSuggestion: "Assign a single owner or split the task boundary.",
      }
    );
  }

  const hotWorkPresent = permitDependencies.includes("hot_work_permit");
  const flammableExposure =
    leftHazardFamilies.includes("fire") ||
    leftHazardFamilies.includes("fumes") ||
    rightHazardFamilies.includes("fire") ||
    rightHazardFamilies.includes("fumes");
  if (sameArea && overlappingWindow && hotWorkPresent && flammableExposure) {
    maybePush(
      items,
      {
        code: "hot_work_permit_conflict",
        type: "permit_conflict",
        severity: "critical",
        sourceScope,
        rationale: "Hot work overlaps with an ignition-sensitive operation.",
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: ["separate_work_windows", "fire_watch", "permit_revalidation"],
        permitDependencies,
        resequencingSuggestion: "Move hot work outside of flammable exposure windows.",
      }
    );
  }

  if (
    sameArea &&
    overlappingWindow &&
    (leftHazardFamilies.includes("overhead_work") || rightHazardFamilies.includes("overhead_work"))
  ) {
    maybePush(
      items,
      {
        code: "overhead_hazard_propagation",
        type: "hazard_propagation",
        severity: "high",
        sourceScope,
        rationale: "Overhead work in the same area creates a downstream exposure for adjacent crews.",
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: ["drop_zone_control", "overhead_protection", "crew_separation"],
        permitDependencies,
        resequencingSuggestion: "Run overhead work in an isolated work window.",
      }
    );
  }

  for (const seed of DEFAULT_CONFLICT_SEEDS) {
    const leftMatched = seed.leftMatch.some((token) => leftText.includes(token));
    const rightMatched = seed.rightMatch.some((token) => rightText.includes(token));
    const reverseMatched =
      seed.leftMatch.some((token) => rightText.includes(token)) &&
      seed.rightMatch.some((token) => leftText.includes(token));

    if ((leftMatched && rightMatched) || reverseMatched) {
      items.push({
        code: seed.code,
        type:
          seed.type === "time_overlap"
            ? "schedule_overlap"
            : seed.type === "location_overlap"
              ? "location_overlap"
              : seed.type,
        severity: seed.severity,
        sourceScope,
        rationale: seed.rationale,
        operationIds: sharedOperationIds,
        relatedBucketKeys: sharedBucketKeys,
        requiredMitigations: seed.controls,
        permitDependencies,
        resequencingSuggestion: sameArea && overlappingWindow ? "Separate the affected crews before work starts." : null,
        metadata: {
          sameArea: Boolean(sameArea),
          overlappingWindow: Boolean(overlappingWindow),
        },
      });
    }
  }

  return items;
}

export function buildConflictMatrix(params: {
  buckets: BucketedWorkItem[];
  rulesEvaluations: RulesEvaluation[];
  externalPeers?: Array<{ bucket: BucketedWorkItem; rules: RulesEvaluation }>;
}): ConflictMatrix {
  const items: ConflictMatrixItem[] = [];
  const { buckets, rulesEvaluations } = params;

  for (let index = 0; index < buckets.length; index += 1) {
    const left = buckets[index];
    const leftRules = rulesEvaluations.find((row) => row.bucketKey === left.bucketKey);
    if (!leftRules) continue;
    const leftWeatherRestrictions = safeArray(leftRules.weatherRestrictions);
    const leftPermitTriggers = safeArray(leftRules.permitTriggers);

    for (let peerIndex = index + 1; peerIndex < buckets.length; peerIndex += 1) {
      const right = buckets[peerIndex];
      const rightRules = rulesEvaluations.find((row) => row.bucketKey === right.bucketKey);
      if (!rightRules) continue;
      items.push(
        ...buildPairConflictItems({
          left,
          right,
          leftRules,
          rightRules,
          sourceScope: "intra_document",
        })
      );
    }

    if (
      left.weatherConditionCode &&
      ["storm", "wind", "lightning", "rain"].some((token) =>
        left.weatherConditionCode?.toLowerCase().includes(token)
      ) &&
      leftWeatherRestrictions.length > 0
    ) {
      items.push({
        code: "weather_sensitive_conflict",
        type: "weather_sensitive",
        severity: "high",
        sourceScope: "intra_document",
        rationale: `Weather condition ${left.weatherConditionCode} conflicts with task sensitivity.`,
        operationIds: [left.operationId ?? left.bucketKey],
        relatedBucketKeys: [left.bucketKey],
        requiredMitigations: leftWeatherRestrictions,
        permitDependencies: [...leftPermitTriggers].filter((permit) => permit !== "none"),
        resequencingSuggestion: "Delay work until weather restrictions are cleared.",
      });
    }
  }

  for (const peer of params.externalPeers ?? []) {
    for (const bucket of buckets) {
      const localRules = rulesEvaluations.find((row) => row.bucketKey === bucket.bucketKey);
      if (!localRules) continue;
      items.push(
        ...buildPairConflictItems({
          left: bucket,
          right: peer.bucket,
          leftRules: localRules,
          rightRules: peer.rules,
          sourceScope: "external_jobsite",
        })
      );
    }
  }

  const deduped = dedupeMatrix(items);
  const score = deduped.reduce((sum, item) => sum + scoreConflict(item), 0);

  return {
    items: deduped,
    score,
    band: bandFromScore(score),
    intraDocumentConflictCount: deduped.filter((item) => item.sourceScope === "intra_document").length,
    externalConflictCount: deduped.filter((item) => item.sourceScope === "external_jobsite").length,
  };
}

export function detectConflicts(
  primary: BucketedWorkItem,
  _primaryRules: RulesEvaluation,
  allBuckets: BucketedWorkItem[],
  allRules: RulesEvaluation[]
): ConflictEvaluation {
  const matrix = buildConflictMatrix({
    buckets: allBuckets,
    rulesEvaluations: allRules,
  });
  const relatedItems = matrix.items.filter(
    (item) =>
      item.relatedBucketKeys.includes(primary.bucketKey) ||
      item.operationIds.includes(primary.operationId ?? primary.bucketKey)
  );
  const conflicts: ConflictEvaluation["conflicts"] = relatedItems.map((item) => ({
    code: item.code === "location_overlap" && item.metadata?.overlappingWindow ? "same_area_same_time" : item.code,
    type: item.type === "schedule_overlap" ? "time_overlap" : item.type,
    severity: item.severity,
    rationale: item.rationale,
    relatedBucketKeys: item.relatedBucketKeys.filter((key) => key !== primary.bucketKey),
    recommendedControls: item.requiredMitigations,
    metadata: item.metadata,
  }));
  const score = relatedItems.reduce((sum, item) => sum + scoreConflict(item), 0);

  return {
    bucketKey: primary.bucketKey,
    operationId: primary.operationId ?? primary.bucketKey,
    conflicts,
    score,
    band: bandFromScore(score),
    matrix: relatedItems,
  };
}
