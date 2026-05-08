import { describe, expect, it } from "vitest";
import {
  safePredictModuleHealth,
  safePredictModuleRoute,
  summarizeSafePredictLaunch,
  type SafePredictModuleSummary,
} from "@/lib/safePredictLaunchReadiness";

const moduleWithData: SafePredictModuleSummary = {
  key: "permits",
  label: "Permits",
  total: 8,
  open: 2,
  inProgress: 1,
  closed: 5,
};

describe("safePredictLaunchReadiness", () => {
  it("maps connected modules to company workspace routes", () => {
    expect(safePredictModuleRoute("jobsites")).toBe("/jobsites");
    expect(safePredictModuleRoute("actions")).toBe("/field-id-exchange");
    expect(safePredictModuleRoute("permits")).toBe("/permits");
    expect(safePredictModuleRoute("training")).toBe("/training-matrix");
  });

  it("classifies module health for launch readiness cards", () => {
    expect(safePredictModuleHealth({ ...moduleWithData, total: 0 })).toBe("needs-data");
    expect(safePredictModuleHealth(moduleWithData)).toBe("attention");
    expect(safePredictModuleHealth({ ...moduleWithData, open: 0, inProgress: 0 })).toBe("ready");
  });

  it("summarizes live and demo launch modes without relying on network data", () => {
    expect(
      summarizeSafePredictLaunch({
        loading: false,
        companyName: "Apex Industrial Constructors",
        hasLiveCompanyProfile: false,
        moduleSummaries: [moduleWithData],
        activeJobsites: 5,
        activeUsers: 12,
        demoCompanyName: "Apex Industrial Constructors",
      })
    ).toMatchObject({
      mode: "demo",
      companyName: "Apex Industrial Constructors",
      activeJobsites: 5,
      activeUsers: 12,
      openWorkItems: 3,
      connectedRecords: 25,
      health: "attention",
    });

    expect(
      summarizeSafePredictLaunch({
        loading: true,
        companyName: null,
        hasLiveCompanyProfile: false,
        moduleSummaries: [],
        activeJobsites: 0,
        activeUsers: 0,
        demoCompanyName: "Demo Co",
      })
    ).toMatchObject({ mode: "loading", health: "needs-data" });
  });
});
