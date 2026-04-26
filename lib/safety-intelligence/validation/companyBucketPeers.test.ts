import { describe, expect, it } from "vitest";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import {
  parseBucketedWorkItemPayload,
  parseCompanyBucketItemPeerRow,
  parseRulesEvaluationPayload,
} from "@/lib/safety-intelligence/validation/companyBucketPeers";

describe("companyBucketPeers validation", () => {
  it("accepts a round-tripped bucket + rules row when bucketKeys match", () => {
    const bucket = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      tradeCode: "welding",
      taskTitle: "Welding",
      workAreaLabel: "North pad",
      hazardFamilies: ["hot_work"],
      permitTriggers: ["hot_work_permit"],
      requiredControls: [],
      trainingRequirementCodes: [],
    });
    const rules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        tradeCode: "welding",
        taskTitle: "Welding",
        hazardFamilies: ["hot_work"],
        permitTriggers: ["hot_work_permit"],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      bucket
    );
    const row = JSON.parse(
      JSON.stringify({
        bucket_payload: bucket,
        rule_results: rules,
      })
    ) as unknown;

    const parsed = parseCompanyBucketItemPeerRow(row);
    expect(parsed).not.toBeNull();
    expect(parsed?.bucket.bucketKey).toBe(bucket.bucketKey);
    expect(parsed?.rules.bucketKey).toBe(bucket.bucketKey);
  });

  it("rejects rows when rule bucketKey does not match bucket", () => {
    const bucket = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      taskTitle: "Task A",
      hazardFamilies: [],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    });
    const other = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      taskTitle: "Task B",
      hazardFamilies: [],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    });
    const rules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        taskTitle: "Task B",
        hazardFamilies: [],
        permitTriggers: [],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      other
    );

    const parsed = parseCompanyBucketItemPeerRow({
      bucket_payload: bucket,
      rule_results: rules,
    });
    expect(parsed).toBeNull();
  });

  it("rejects bucket payloads missing taskTitle string", () => {
    expect(
      parseBucketedWorkItemPayload({
        bucketKey: "k",
        bucketType: "task_execution",
        companyId: "c",
        taskTitle: 123,
        source: { module: "manual", id: null },
        payload: {},
      })
    ).toBeNull();
  });

  it("defaults invalid rule band and coerces numeric score", () => {
    const rules = parseRulesEvaluationPayload(
      JSON.parse(
        JSON.stringify({
          bucketKey: "manual:abc",
          score: "not-a-number",
          band: "nope",
          evaluationVersion: "",
          findings: [],
        })
      ) as unknown
    );
    expect(rules).not.toBeNull();
    expect(rules?.score).toBe(0);
    expect(rules?.band).toBe("low");
    expect(rules?.evaluationVersion).toBe("legacy");
  });
});
