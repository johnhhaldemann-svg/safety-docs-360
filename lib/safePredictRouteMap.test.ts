import { describe, expect, it } from "vitest";
import { isLegacyOperationHref, mapSafePredictOperationHref } from "@/lib/safePredictRouteMap";

describe("safePredictRouteMap", () => {
  it("moves old SafePredict pages into the company workspace", () => {
    expect(mapSafePredictOperationHref("/safe-predict")).toBe("/dashboard");
    expect(mapSafePredictOperationHref("/safe-predict/jobsites")).toBe("/jobsites");
    expect(mapSafePredictOperationHref("/safe-predict/incidents")).toBe("/incidents");
    expect(mapSafePredictOperationHref("/safe-predict/predictive-risk")).toBe("/analytics/predictive-model");
    expect(mapSafePredictOperationHref("/safe-predict/reports?tab=marketplace")).toBe("/reports");
  });

  it("preserves jobsite identity and leaves workspace routes alone", () => {
    expect(mapSafePredictOperationHref("/safe-predict/jobsites/riverside")).toBe("/jobsites/riverside/overview");
    expect(mapSafePredictOperationHref("/dashboard")).toBe("/dashboard");
    expect(mapSafePredictOperationHref("/profile")).toBe("/profile");
    expect(isLegacyOperationHref("/safe-predict/permits")).toBe(true);
    expect(isLegacyOperationHref("/permits")).toBe(false);
    expect(isLegacyOperationHref("/profile")).toBe(false);
  });
});
