import { describe, expect, it } from "vitest";
import { selectGusMessage } from "@/lib/gus/gusMessageSelector";
import { resetGusMemoryForTests } from "@/lib/gus/gusMemory";

const baseRequest = {
  companyId: "123e4567-e89b-12d3-a456-426614174000",
  jobsiteId: "123e4567-e89b-12d3-a456-426614174001",
  userId: "123e4567-e89b-12d3-a456-426614174002",
  currentPage: "Dashboard",
  route: "/dashboard",
};

describe("Gus message selector", () => {
  it("selects a permit alert when permit types are missing", () => {
    resetGusMemoryForTests();

    const message = selectGusMessage({
      ...baseRequest,
      liveContext: {
        riskLevel: "low",
        missingPermitTypes: ["hot work"],
      },
    });

    expect(message.category).toBe("permit_alert");
    expect(message.actionHref).toBe("/permits");
    expect(message.message).toContain("hot work");
  });

  it("selects a training alert when training is expired", () => {
    resetGusMemoryForTests();

    const message = selectGusMessage({
      ...baseRequest,
      liveContext: {
        riskLevel: "low",
        expiredTrainingCount: 2,
      },
    });

    expect(message.category).toBe("training_alert");
    expect(message.actionHref).toBe("/training");
    expect(message.message).toContain("2 expired training");
  });

  it("selects a risk alert for high predictive risk", () => {
    resetGusMemoryForTests();

    const message = selectGusMessage({
      ...baseRequest,
      liveContext: {
        riskLevel: "high",
        riskDrivers: ["confined space", "new crew"],
      },
    });

    expect(message.category).toBe("risk_alert");
    expect(message.actionHref).toBe("/risk");
    expect(message.reason).toContain("confined space");
  });

  it("selects a safety tip when no risk signals are present", () => {
    resetGusMemoryForTests();

    const message = selectGusMessage({
      ...baseRequest,
      liveContext: {
        riskLevel: "low",
      },
    });

    expect(message.category).toBe("safety_tip");
    expect(message.message).toContain("Quick safety check");
    expect(message.message).not.toMatch(/\bapproved\b|\bcompliant\b|\bsafe to start\b/i);
  });
});

