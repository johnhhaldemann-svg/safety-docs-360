import { describe, expect, it } from "vitest";
import { injuryWeatherJobsiteSorScopeBanner, injuryWeatherScopeNote } from "./scopeMessaging";

describe("injuryWeatherScopeNote", () => {
  it("returns empty when no company", () => {
    expect(injuryWeatherScopeNote(undefined, undefined)).toBe("");
    expect(injuryWeatherScopeNote("", null)).toBe("");
  });

  it("describes company-wide SOR when jobsite is set (matches fetchLiveSignals behavior)", () => {
    const note = injuryWeatherScopeNote("company-uuid", "jobsite-uuid");
    expect(note).toContain("SOR observations remain company-wide");
    expect(note).toContain("corrective actions");
    expect(note).toContain("jobsite");
  });

  it("describes full company scope when only company is set", () => {
    expect(injuryWeatherScopeNote("company-uuid", null)).toContain("company’s SOR");
  });
});

describe("injuryWeatherJobsiteSorScopeBanner", () => {
  it("states SOR is company-wide for jobsite-scoped views", () => {
    const text = injuryWeatherJobsiteSorScopeBanner();
    expect(text).toMatch(/company-wide/i);
    expect(text).toMatch(/jobsite/i);
  });
});
