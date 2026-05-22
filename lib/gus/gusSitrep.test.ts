import { describe, expect, it } from "vitest";
import { buildGusSitrepMessage, buildGusSteadySitrepMessage, isSafePredictSitrepRoute } from "@/lib/gus/gusSitrep";
import type { GusContext } from "@/lib/gus/gusContext";

const severeContext: GusContext = {
  currentPage: "SafePredict - Hillcrest",
  route: "/safe-predict/predictive-risk",
  riskLevel: "severe",
  riskDrivers: ["Drop Hazard 3rd Floor", "Open incident review", "Permit gap"],
  missingPermitTypes: ["Hot Work", "Lift Plan"],
  expiredTrainingCount: 2,
  openCorrectiveActionCount: 6,
  openHighPriorityActionCount: 3,
  recentObservationTypes: ["housekeeping", "fall exposure"],
  scheduleUploadedToday: true,
};

describe("Gus SITREP", () => {
  it("only runs on SafePredict routes", () => {
    expect(isSafePredictSitrepRoute("/safe-predict")).toBe(true);
    expect(isSafePredictSitrepRoute("/safe-predict/predictive-risk")).toBe(true);
    expect(isSafePredictSitrepRoute("/dashboard")).toBe(false);
    expect(buildGusSitrepMessage({ ...severeContext, route: "/dashboard" })).toBeNull();
  });

  it("summarizes severe risk, permit gaps, training gaps, and open actions", () => {
    const message = buildGusSitrepMessage(severeContext);

    expect(message).not.toBeNull();
    expect(message?.message).toContain("SITREP");
    expect(message?.message).toContain("Severe risk");
    expect(message?.message).toContain("Drop Hazard 3rd Floor");
    expect(message?.message).toContain("Hot Work");
    expect(message?.message).toContain("2 expired trainings");
    expect(message?.message).toContain("3 high-priority actions");
    expect(message?.message).toContain("human reviewer");
    expect(message?.shouldSpeak).toBe(true);
    expect(message?.priority).toBe(1);
  });

  it("keeps SITREP output draft-only and free of approval language", () => {
    const message = buildGusSitrepMessage(severeContext);
    const combined = `${message?.message ?? ""} ${message?.reason ?? ""} ${message?.spokenText ?? ""}`;

    expect(combined).toContain("Human review required");
    expect(combined).not.toMatch(/approved|compliant|safe to start|released for work|no review needed/i);
  });

  it("uses a stable message id and can create a non-duplicate steady follow-up", () => {
    const first = buildGusSitrepMessage(severeContext);
    const second = buildGusSitrepMessage(severeContext);
    const changed = buildGusSitrepMessage({
      ...severeContext,
      missingPermitTypes: ["Hot Work", "Lift Plan", "Confined Space"],
    });
    const steady = first ? buildGusSteadySitrepMessage(first) : null;

    expect(first?.messageId).toBe(second?.messageId);
    expect(steady?.messageId).not.toBe(first?.messageId);
    expect(steady?.message).toContain("No major change");
    expect(changed?.messageId).not.toBe(first?.messageId);
  });

  it("keeps normal SITREPs visual-only", () => {
    const message = buildGusSitrepMessage({
      currentPage: "SafePredict",
      route: "/safe-predict",
      riskLevel: "low",
      scheduleUploadedToday: true,
    });

    expect(message?.priority).toBe(4);
    expect(message?.shouldSpeak).toBe(false);
  });
});
