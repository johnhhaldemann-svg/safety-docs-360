import { describe, expect, it } from "vitest";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { buildConflictMatrix, detectConflicts } from "@/lib/safety-intelligence/conflicts";
import { evaluateRules } from "@/lib/safety-intelligence/rules";

describe("detectConflicts", () => {
  it("detects welding near painters in same area and time", () => {
    const welding = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      tradeCode: "welding",
      taskTitle: "Welding and hot work",
      workAreaLabel: "Area B",
      startsAt: "2026-04-13T14:00:00.000Z",
      endsAt: "2026-04-13T17:00:00.000Z",
      hazardFamilies: ["hot_work"],
      permitTriggers: ["hot_work_permit"],
      requiredControls: [],
      trainingRequirementCodes: [],
    });
    const painting = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      tradeCode: "painting",
      taskTitle: "Spray painting",
      workAreaLabel: "Area B",
      startsAt: "2026-04-13T13:00:00.000Z",
      endsAt: "2026-04-13T22:00:00.000Z",
      hazardFamilies: ["flammables"],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    });

    const weldingRules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        tradeCode: "welding",
        taskTitle: "Welding and hot work",
        hazardFamilies: ["hot_work"],
        permitTriggers: ["hot_work_permit"],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      welding
    );
    const paintingRules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        tradeCode: "painting",
        taskTitle: "Spray painting",
        hazardFamilies: ["flammables"],
        permitTriggers: [],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      painting
    );

    const result = detectConflicts(welding, weldingRules, [welding, painting], [weldingRules, paintingRules]);
    expect(result.conflicts.some((conflict) => conflict.code === "welding_near_painters")).toBe(true);
    expect(result.conflicts.some((conflict) => conflict.code === "same_area_same_time")).toBe(true);
  });

  it("distinguishes intra-document and external jobsite conflicts", () => {
    const local = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      operationId: "op-1",
      tradeCode: "welding",
      taskTitle: "Welding and hot work",
      workAreaLabel: "Area A",
      startsAt: "2026-04-13T14:00:00.000Z",
      endsAt: "2026-04-13T17:00:00.000Z",
      hazardFamilies: ["hot_work"],
      permitTriggers: ["hot_work_permit"],
      requiredControls: [],
      trainingRequirementCodes: [],
    });
    const localPeer = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      operationId: "op-2",
      tradeCode: "electrical",
      taskTitle: "Electrical rough-in",
      workAreaLabel: "Area A",
      startsAt: "2026-04-13T15:00:00.000Z",
      endsAt: "2026-04-13T18:00:00.000Z",
      hazardFamilies: ["electrical"],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    });
    const externalPeer = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      operationId: "op-3",
      tradeCode: "painting",
      taskTitle: "Spray painting",
      workAreaLabel: "Area A",
      startsAt: "2026-04-13T15:00:00.000Z",
      endsAt: "2026-04-13T19:00:00.000Z",
      hazardFamilies: ["fire", "fumes"],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    });

    const localRules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        operationId: "op-1",
        tradeCode: "welding",
        taskTitle: "Welding and hot work",
        hazardFamilies: ["hot_work"],
        permitTriggers: ["hot_work_permit"],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      local
    );
    const localPeerRules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        operationId: "op-2",
        tradeCode: "electrical",
        taskTitle: "Electrical rough-in",
        hazardFamilies: ["electrical"],
        permitTriggers: [],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      localPeer
    );
    const externalRules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        operationId: "op-3",
        tradeCode: "painting",
        taskTitle: "Spray painting",
        hazardFamilies: ["fire", "fumes"],
        permitTriggers: [],
        requiredControls: [],
        trainingRequirementCodes: [],
      },
      externalPeer
    );

    const matrix = buildConflictMatrix({
      buckets: [local, localPeer],
      rulesEvaluations: [localRules, localPeerRules],
      externalPeers: [{ bucket: externalPeer, rules: externalRules }],
    });

    expect(matrix.intraDocumentConflictCount).toBeGreaterThan(0);
    expect(matrix.externalConflictCount).toBeGreaterThan(0);
    expect(matrix.items.some((item) => item.sourceScope === "external_jobsite")).toBe(true);
    expect(matrix.items.some((item) => item.code === "hot_work_permit_conflict")).toBe(true);
  });

  it("tolerates sparse external peer rule payloads from historical bucket rows", () => {
    const local = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      operationId: "op-local",
      tradeCode: "excavation",
      taskTitle: "Excavating",
      workAreaLabel: "Area C",
      startsAt: "2026-04-13T14:00:00.000Z",
      endsAt: "2026-04-13T17:00:00.000Z",
      hazardFamilies: ["excavation"],
      permitTriggers: ["excavation_permit"],
      requiredControls: ["barricade"],
      trainingRequirementCodes: [],
    });
    const externalPeer = buildBucketedWorkItem({
      companyId: "company-1",
      sourceModule: "manual",
      operationId: "op-peer",
      tradeCode: "painting",
      taskTitle: "Spray painting",
      workAreaLabel: "Area C",
      startsAt: "2026-04-13T15:00:00.000Z",
      endsAt: "2026-04-13T18:00:00.000Z",
      hazardFamilies: ["fumes"],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    });

    const localRules = evaluateRules(
      {
        companyId: "company-1",
        sourceModule: "manual",
        operationId: "op-local",
        tradeCode: "excavation",
        taskTitle: "Excavating",
        hazardFamilies: ["excavation"],
        permitTriggers: ["excavation_permit"],
        requiredControls: ["barricade"],
        trainingRequirementCodes: [],
      },
      local
    );

    const matrix = buildConflictMatrix({
      buckets: [local],
      rulesEvaluations: [localRules],
      externalPeers: [
        {
          bucket: externalPeer,
          rules: {
            bucketKey: externalPeer.bucketKey,
            operationId: externalPeer.operationId ?? null,
          } as any,
        },
      ],
    });

    expect(matrix.items.some((item) => item.sourceScope === "external_jobsite")).toBe(true);
  });
});
