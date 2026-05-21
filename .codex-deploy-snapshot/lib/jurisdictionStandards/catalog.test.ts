import { describe, expect, it } from "vitest";
import {
  DEFAULT_JURISDICTION_STANDARDS_CONFIG,
  getJurisdictionSurfaceStandards,
  normalizeJurisdictionStandardsConfig,
  resolveBuilderJurisdiction,
} from "@/lib/jurisdictionStandards/catalog";

describe("jurisdiction standards catalog", () => {
  it("resolves document override ahead of company state", () => {
    const profile = resolveBuilderJurisdiction({
      governingState: "CA",
      companyState: "TX",
    });

    expect(profile.governingState).toBe("CA");
    expect(profile.jurisdictionCode).toBe("ca");
    expect(profile.source).toBe("document_override");
  });

  it("falls back to federal when no mapped state is available", () => {
    const profile = resolveBuilderJurisdiction({
      companyState: "TX",
    });

    expect(profile.jurisdictionCode).toBe("federal");
    expect(profile.jurisdictionPlanType).toBe("federal_osha");
    expect(profile.jurisdictionLabel).toContain("Texas");
  });

  it("returns federal baseline plus state-plan deltas for pilot states", () => {
    const standards = getJurisdictionSurfaceStandards({
      jurisdictionCode: "wa",
      surface: "csep",
    });

    expect(standards.some((standard) => standard.id === "std_federal_baseline")).toBe(true);
    expect(standards.some((standard) => standard.id === "std_wa_construction_rules")).toBe(true);
    expect(standards.some((standard) => standard.id === "std_wa_excavation")).toBe(true);
  });

  it("collapses duplicate manifest rows deterministically", () => {
    const duplicated = normalizeJurisdictionStandardsConfig({
      jurisdictions: [
        ...DEFAULT_JURISDICTION_STANDARDS_CONFIG.jurisdictions,
        {
          ...DEFAULT_JURISDICTION_STANDARDS_CONFIG.jurisdictions[0],
          displayName: "Federal OSHA Updated",
        },
      ],
      standards: [
        ...DEFAULT_JURISDICTION_STANDARDS_CONFIG.standards,
        {
          ...DEFAULT_JURISDICTION_STANDARDS_CONFIG.standards[0],
          title: "Federal OSHA construction baseline updated",
        },
      ],
      mappings: [
        ...DEFAULT_JURISDICTION_STANDARDS_CONFIG.mappings,
        {
          ...DEFAULT_JURISDICTION_STANDARDS_CONFIG.mappings[0],
          mappingKey: "references_updated",
        },
      ],
    });

    expect(duplicated.jurisdictions).toHaveLength(
      DEFAULT_JURISDICTION_STANDARDS_CONFIG.jurisdictions.length
    );
    expect(duplicated.standards).toHaveLength(
      DEFAULT_JURISDICTION_STANDARDS_CONFIG.standards.length
    );
    expect(duplicated.mappings).toHaveLength(
      DEFAULT_JURISDICTION_STANDARDS_CONFIG.mappings.length
    );
    expect(duplicated.jurisdictions[0].displayName).toBe("Federal OSHA Updated");
    expect(duplicated.standards[0].title).toBe("Federal OSHA construction baseline updated");
    expect(duplicated.mappings[0].mappingKey).toBe("references_updated");
  });

  it("ships every seeded pilot-state standard with source attribution", () => {
    const pilotStates = new Set(["ca", "wa", "or", "mi", "nc"]);
    const pilotStandards = DEFAULT_JURISDICTION_STANDARDS_CONFIG.standards.filter((standard) =>
      pilotStates.has(standard.jurisdictionCode)
    );

    expect(pilotStandards.length).toBeGreaterThan(0);
    for (const standard of pilotStandards) {
      expect(standard.sourceUrl).toContain("http");
      expect(standard.lastReviewedDate).toBe("2026-04-15");
    }
  });
});
