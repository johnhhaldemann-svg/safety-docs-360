import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPIRING_SOON_DAYS,
  buildStage1TrainingDetail,
  requirementSourcesForWorker,
  stage1StatusForRequirement,
  summarizeStage1Training,
} from "./trainingMatrixStage1";

const hotWorkRequirement = {
  id: "hot-work",
  title: "Hot Work Training",
  matchKeywords: ["Hot Work"],
  applyTrades: ["Electrician"],
  applyPositions: ["Foreman"],
  applySubTrades: ["hillcrest-office-fit-out"],
  applyTaskCodes: ["hot_work"],
  generatedSourceType: "permit",
};

describe("Stage 1 training matrix logic", () => {
  it("uses the default 30 day expiring soon threshold", () => {
    expect(DEFAULT_EXPIRING_SOON_DAYS).toBe(30);
    expect(
      stage1StatusForRequirement({
        requirement: hotWorkRequirement,
        state: "match",
        detail: {
          state: "match",
          matchSource: "certifications",
          matchedLabel: "Hot Work",
          expiresOn: "2026-06-10",
          daysUntilExpiry: 20,
          expiryStatus: "soon",
        },
        expiringSoonDays: DEFAULT_EXPIRING_SOON_DAYS,
      })
    ).toBe("Expiring Soon");

    expect(
      stage1StatusForRequirement({
        requirement: hotWorkRequirement,
        state: "match",
        detail: {
          state: "match",
          matchSource: "certifications",
          matchedLabel: "Hot Work",
          expiresOn: "2026-07-05",
          daysUntilExpiry: 45,
          expiryStatus: "soon",
        },
        expiringSoonDays: DEFAULT_EXPIRING_SOON_DAYS,
      })
    ).toBe("Complete");
  });

  it("derives required-because reasons from role, trade, jobsite, permit, equipment, policy, and manual assignment", () => {
    expect(
      requirementSourcesForWorker(hotWorkRequirement, {
        jobTitle: "Foreman",
        tradeSpecialty: "Electrician",
        assignedJobsiteCount: 1,
      })
    ).toEqual(["Supervisor role", "Role requirement", "Site requirement", "Permit exposure"]);

    expect(
      requirementSourcesForWorker(
        {
          id: "forklift",
          title: "Forklift Equipment Training",
          matchKeywords: ["Forklift"],
        },
        {}
      )
    ).toEqual(["Equipment requirement"]);

    expect(
      requirementSourcesForWorker(
        {
          id: "policy",
          title: "Company Orientation",
          applyTrades: ["Steel"],
        },
        {}
      )
    ).toEqual(["Company policy"]);

    expect(requirementSourcesForWorker({ id: "manual", title: "Supervisor Assigned Course" }, {})).toEqual([
      "Manually assigned",
    ]);
  });

  it("summarizes permit-linked missing or expired training as restricted with prevention messaging", () => {
    const missingHotWork = buildStage1TrainingDetail({
      requirement: hotWorkRequirement,
      state: "gap",
      worker: { jobTitle: "Foreman", tradeSpecialty: "Electrician", assignedJobsiteCount: 1 },
    });
    const completePolicy = buildStage1TrainingDetail({
      requirement: { id: "orientation", title: "Company Orientation", matchKeywords: ["Orientation"] },
      state: "match",
      detail: {
        state: "match",
        matchSource: "certifications",
        matchedLabel: "Orientation",
        expiryStatus: "none",
      },
      worker: {},
    });
    const summary = summarizeStage1Training([missingHotWork, completePolicy]);

    expect(missingHotWork.requiredBecause).toContain("Permit exposure");
    expect(missingHotWork.preventionMessage).toBe(
      "Worker is restricted from permit-controlled activity until Hot Work Training is current."
    );
    expect(summary.permitLinkedGaps).toBe(1);
    expect(summary.overallStatus).toBe("Restricted");
  });
});
