import { describe, expect, it } from "vitest";
import { isLegacyOperationHref, mapSafePredictOperationHref } from "@/lib/safePredictRouteMap";

describe("safePredictRouteMap", () => {
  it("moves workspace operating routes into SafePredict beta pages", () => {
    expect(mapSafePredictOperationHref("/dashboard")).toBe("/safe-predict");
    expect(mapSafePredictOperationHref("/jobsites")).toBe("/safe-predict/jobsites");
    expect(mapSafePredictOperationHref("/incidents")).toBe("/safe-predict/incidents");
    expect(mapSafePredictOperationHref("/analytics/predictive-model")).toBe("/safe-predict/predictive-risk");
    expect(mapSafePredictOperationHref("/library?tab=marketplace")).toBe("/safe-predict/reports");
  });

  it("preserves jobsite identity and leaves SafePredict routes alone", () => {
    expect(mapSafePredictOperationHref("/jobsites/riverside/permits")).toBe("/safe-predict/jobsites/riverside");
    expect(mapSafePredictOperationHref("/profile")).toBe("/profile");
    expect(mapSafePredictOperationHref("/safe-predict/jobsites")).toBe("/safe-predict/jobsites");
    expect(isLegacyOperationHref("/permits")).toBe(true);
    expect(isLegacyOperationHref("/profile")).toBe(false);
  });
});
