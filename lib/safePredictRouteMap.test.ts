import { describe, expect, it } from "vitest";
import {
  isLegacyOperationHref,
  mapSafePredictOperationHref,
  mapSafePredictSurfaceHref,
} from "@/lib/safePredictRouteMap";

describe("safePredictRouteMap", () => {
  it("moves workspace operating routes into SafePredict beta pages", () => {
    expect(mapSafePredictOperationHref("/dashboard")).toBe("/safe-predict");
    expect(mapSafePredictOperationHref("/jobsites")).toBe("/safe-predict/jobsites");
    expect(mapSafePredictOperationHref("/analytics/predictive-model")).toBe("/safe-predict/predictive-risk");
    expect(mapSafePredictOperationHref("/safety-submit")).toBe("/safe-predict/observations");
    expect(mapSafePredictOperationHref("/documents")).toBe("/safe-predict/documents");
    expect(mapSafePredictOperationHref("/library")).toBe("/safe-predict/documents");
    expect(mapSafePredictOperationHref("/library?tab=documents&doc=doc-1")).toBe("/safe-predict/documents?doc=doc-1");
    expect(mapSafePredictOperationHref("/library?tab=marketplace")).toBe("/safe-predict/documents?tab=marketplace");
    expect(mapSafePredictOperationHref("/csep")).toBe("/safe-predict/csep");
    expect(mapSafePredictOperationHref("/peshep")).toBe("/safe-predict/peshep");
    expect(mapSafePredictOperationHref("/training-matrix")).toBe("/safe-predict/training-tracker");
    expect(mapSafePredictOperationHref("/settings/risk-memory")).toBe("/safe-predict/risk-memory");
  });

  it("preserves jobsite identity and leaves SafePredict routes alone", () => {
    expect(mapSafePredictOperationHref("/jobsites/riverside/permits")).toBe("/safe-predict/jobsites/riverside");
    expect(mapSafePredictOperationHref("/jobsites/riverside/site-visual?tab=overlaps#zone-1")).toBe(
      "/safe-predict/jobsites/riverside#zone-1"
    );
    expect(mapSafePredictOperationHref("/incidents")).toBe("/safe-predict/incidents");
    expect(mapSafePredictOperationHref("/profile")).toBe("/profile");
    expect(mapSafePredictOperationHref("/safe-predict/jobsites")).toBe("/safe-predict/jobsites");
    expect(isLegacyOperationHref("/permits")).toBe(true);
    expect(isLegacyOperationHref("/profile")).toBe(false);
  });

  it("keeps direct admin surfaces available but maps SafePredict surfaces to the beta shell", () => {
    expect(mapSafePredictOperationHref("/company-integrations")).toBe("/company-integrations");
    expect(mapSafePredictOperationHref("/company-users")).toBe("/company-users");
    expect(mapSafePredictOperationHref("/permits")).toBe("/safe-predict/permits");
    expect(mapSafePredictSurfaceHref("/profile")).toBe("/safe-predict/profile");
    expect(mapSafePredictSurfaceHref("/company-integrations")).toBe("/safe-predict/apps-integrations");
    expect(mapSafePredictSurfaceHref("/company-users")).toBe("/safe-predict/team-access");
    expect(mapSafePredictSurfaceHref("/company-onboarding")).toBe("/safe-predict/onboarding-import");
    expect(mapSafePredictSurfaceHref("/training-matrix")).toBe("/safe-predict/training-tracker");
    expect(mapSafePredictSurfaceHref("/company-safety-forms")).toBe("/safe-predict/safety-forms");
    expect(mapSafePredictSurfaceHref("/company-inductions")).toBe("/safe-predict/inductions");
    expect(mapSafePredictSurfaceHref("/customer/billing")).toBe("/safe-predict/billing");
    expect(mapSafePredictSurfaceHref("/settings/risk-memory")).toBe("/safe-predict/risk-memory");
    expect(mapSafePredictSurfaceHref("/permits?jobsiteId=abc&jsaActivityId=step-1")).toBe(
      "/safe-predict/permit-center?jobsiteId=abc&jsaActivityId=step-1"
    );
  });
});
