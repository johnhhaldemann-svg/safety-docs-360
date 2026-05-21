import { describe, expect, it } from "vitest";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { buildAiReviewContext, bucketToRawTaskInput } from "@/lib/safety-intelligence/service";

describe("buildAiReviewContext", () => {
  it("evaluates peer bucket rules with each peer bucket's own task input", () => {
    const primaryInput = {
      companyId: "company-1",
      sourceModule: "manual" as const,
      taskTitle: "Welding pipe supports",
      workAreaLabel: "Area A",
      startsAt: "2026-04-28T14:00:00.000Z",
      endsAt: "2026-04-28T16:00:00.000Z",
    };
    const primaryBucket = buildBucketedWorkItem(primaryInput);
    const peerBucket = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      taskTitle: "Crane lift structural steel",
      tradeCode: "crane",
      workAreaLabel: "Area A",
      startsAt: "2026-04-28T15:00:00.000Z",
      endsAt: "2026-04-28T17:00:00.000Z",
    });

    const { context } = buildAiReviewContext({
      input: primaryInput,
      bucket: primaryBucket,
      peerBuckets: [peerBucket],
    });

    const primaryRules = context.rulesEvaluations.find((row) => row.bucketKey === primaryBucket.bucketKey);
    const peerRules = context.rulesEvaluations.find((row) => row.bucketKey === peerBucket.bucketKey);

    expect(context.buckets.map((bucket) => bucket.bucketKey)).toEqual([
      primaryBucket.bucketKey,
      peerBucket.bucketKey,
    ]);
    expect(primaryRules?.permitTriggers).toContain("hot_work_permit");
    expect(peerRules?.permitTriggers).toContain("lift_plan");
    expect(peerRules?.hazardFamilies).toContain("overhead_work");
  });
});

describe("bucketToRawTaskInput", () => {
  it("reconstructs raw task input fields used by rules and fallbacks", () => {
    const bucket = buildBucketedWorkItem({
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      sourceModule: "company_permit",
      sourceId: "permit-1",
      operationId: "operation-1",
      taskTitle: "Energized panel work",
      description: "Inspect panel",
      hazardCategories: ["Electrical"],
      metadata: { scheduleLabel: "night shift" },
    });

    expect(bucketToRawTaskInput(bucket)).toMatchObject({
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      sourceModule: "company_permit",
      sourceId: "permit-1",
      operationId: "operation-1",
      taskTitle: "Energized panel work",
      description: "Inspect panel",
      hazardCategories: ["Electrical"],
      metadata: { scheduleLabel: "night shift" },
    });
  });
});
