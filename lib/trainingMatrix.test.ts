import { describe, expect, it } from "vitest";
import {
  activatesScopedRequirement,
  computeTrainingMatrixRow,
  keywordMatchesHaystack,
  matchesSelectedMatrixFilter,
  normalizeForMatch,
  requirementAppliesToProfile,
} from "./trainingMatrix";

describe("normalizeForMatch", () => {
  it("trims and lowercases", () => {
    expect(normalizeForMatch("  OSHA 30  ")).toBe("osha 30");
  });
});

describe("keywordMatchesHaystack", () => {
  it("matches substring keyword in haystack", () => {
    expect(keywordMatchesHaystack("osha", "osha 30 hour")).toBe(true);
  });
  it("matches when haystack is substring of keyword", () => {
    expect(keywordMatchesHaystack("osha 30 hour certification", "osha 30")).toBe(true);
  });
  it("rejects empty", () => {
    expect(keywordMatchesHaystack("", "x")).toBe(false);
    expect(keywordMatchesHaystack("x", "")).toBe(false);
  });
});

describe("requirementAppliesToProfile", () => {
  it("applies when filters are empty", () => {
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Electrical", job_title: "Foreman" },
        [],
        []
      )
    ).toBe(true);
  });
  it("requires trade match when apply_trades set", () => {
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Electrical", job_title: "Foreman" },
        ["Electrical"],
        []
      )
    ).toBe(true);
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Plumbing", job_title: "Foreman" },
        ["Electrical"],
        []
      )
    ).toBe(false);
  });
  it("requires position match when apply_positions set", () => {
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: null, job_title: "Foreman" },
        [],
        ["Foreman"]
      )
    ).toBe(true);
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: null, job_title: "Laborer" },
        [],
        ["Foreman"]
      )
    ).toBe(false);
  });
  it("requires selected subtrade when apply_sub_trades set", () => {
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Electrical", job_title: "Foreman" },
        ["Electrical"],
        [],
        ["High Voltage"],
        [],
        { selectedSubTrade: "High Voltage" }
      )
    ).toBe(true);
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Electrical", job_title: "Foreman" },
        ["Electrical"],
        [],
        ["High Voltage"],
        [],
        {}
      )
    ).toBe(false);
  });
  it("requires selected task code when apply_task_codes set", () => {
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Electrical", job_title: "Foreman" },
        ["Electrical"],
        [],
        [],
        ["cable_pull"],
        { selectedTaskCode: "cable_pull" }
      )
    ).toBe(true);
    expect(
      requirementAppliesToProfile(
        { certifications: [], trade_specialty: "Electrical", job_title: "Foreman" },
        ["Electrical"],
        [],
        [],
        ["cable_pull"],
        { selectedTaskCode: "panel_install" }
      )
    ).toBe(false);
  });
});

describe("matchesSelectedMatrixFilter", () => {
  it("keeps scoped requirements visible when no top-level filter is selected", () => {
    expect(matchesSelectedMatrixFilter(["Electrical"], null)).toBe(true);
  });

  it("allows unrestricted requirements when a filter is selected", () => {
    expect(matchesSelectedMatrixFilter([], "Electrical")).toBe(true);
  });

  it("requires a match once a top-level filter is selected", () => {
    expect(matchesSelectedMatrixFilter(["Electrical"], "Electrical")).toBe(true);
    expect(matchesSelectedMatrixFilter(["Electrical"], "Plumbing")).toBe(false);
  });
});

describe("activatesScopedRequirement", () => {
  it("keeps unrestricted scoped filters active with no selection", () => {
    expect(activatesScopedRequirement([], null)).toBe(true);
  });

  it("hides scoped requirements until matching context is selected", () => {
    expect(activatesScopedRequirement(["High Voltage"], null)).toBe(false);
    expect(activatesScopedRequirement(["High Voltage"], "High Voltage")).toBe(true);
    expect(activatesScopedRequirement(["High Voltage"], "Low Voltage")).toBe(false);
  });
});

describe("computeTrainingMatrixRow", () => {
  it("marks requirement satisfied when cert contains keyword", () => {
    const { cells, cellDetails, unmatchedCertifications } = computeTrainingMatrixRow(
      { certifications: ["OSHA 30 Hour", "First Aid"] },
      [{ id: "r1", match_keywords: ["osha 30"] }]
    );
    expect(cells.r1).toBe("match");
    expect(cellDetails.r1?.state).toBe("match");
    expect(cellDetails.r1?.matchedLabel).toBe("OSHA 30 Hour");
    expect(unmatchedCertifications).toEqual(["First Aid"]);
  });

  it("treats cert as matched for multiple requirements without duplicating unmatched", () => {
    const { cells, cellDetails, unmatchedCertifications } = computeTrainingMatrixRow(
      { certifications: ["OSHA 30"] },
      [
        { id: "a", match_keywords: ["osha"] },
        { id: "b", match_keywords: ["30"] },
      ]
    );
    expect(cells.a).toBe("match");
    expect(cells.b).toBe("match");
    expect(cellDetails.a?.matchedLabel).toBe("OSHA 30");
    expect(unmatchedCertifications).toEqual([]);
  });

  it("matches job_title when match_fields includes job_title", () => {
    const { cells, cellDetails, unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: ["CPR"],
        job_title: "Site Safety Supervisor",
      },
      [
        {
          id: "safety",
          match_keywords: ["supervisor"],
          match_fields: ["job_title"],
        },
      ]
    );
    expect(cells.safety).toBe("match");
    expect(cellDetails.safety?.matchSource).toBe("job_title");
    expect(unmatchedCertifications).toEqual(["CPR"]);
  });

  it("returns gap when nothing matches", () => {
    const { cells, cellDetails, unmatchedCertifications } = computeTrainingMatrixRow(
      { certifications: ["Forklift"] },
      [{ id: "r1", match_keywords: ["crane"] }]
    );
    expect(cells.r1).toBe("gap");
    expect(cellDetails.r1?.gapKeywords).toEqual(["crane"]);
    expect(unmatchedCertifications).toEqual(["Forklift"]);
  });

  it("marks na when trade scope excludes profile", () => {
    const { cells, cellDetails } = computeTrainingMatrixRow(
      {
        certifications: ["OSHA 30"],
        trade_specialty: "Plumbing",
        job_title: "Foreman",
      },
      [
        {
          id: "r1",
          match_keywords: ["osha"],
          apply_trades: ["Electrical"],
        },
      ]
    );
    expect(cells.r1).toBe("na");
    expect(cellDetails.r1?.state).toBe("na");
  });

  it("does not consume certifications for na requirements", () => {
    const { unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: ["OSHA 30"],
        trade_specialty: "Plumbing",
        job_title: "Foreman",
      },
      [
        {
          id: "scoped",
          match_keywords: ["osha"],
          apply_trades: ["Electrical"],
        },
      ]
    );
    expect(unmatchedCertifications).toEqual(["OSHA 30"]);
  });

  it("marks task-scoped requirements na when no task context is selected", () => {
    const { cells, cellDetails } = computeTrainingMatrixRow(
      {
        certifications: ["OSHA 30"],
        trade_specialty: "Electrical",
        job_title: "Foreman",
      },
      [
        {
          id: "scoped-task",
          match_keywords: ["osha"],
          apply_trades: ["Electrical"],
          apply_task_codes: ["cable_pull"],
        },
      ]
    );
    expect(cells["scoped-task"]).toBe("na");
    expect(cellDetails["scoped-task"]?.state).toBe("na");
  });

  it("activates subtrade and task scoped requirements when matching context is selected", () => {
    const { cells, cellDetails } = computeTrainingMatrixRow(
      {
        certifications: ["OSHA 30"],
        trade_specialty: "Electrical",
        job_title: "Foreman",
      },
      [
        {
          id: "scoped-context",
          match_keywords: ["osha"],
          apply_trades: ["Electrical"],
          apply_sub_trades: ["High Voltage"],
          apply_task_codes: ["cable_pull"],
        },
      ],
      new Date("2026-01-01T00:00:00.000Z"),
      { selectedSubTrade: "High Voltage", selectedTaskCode: "cable_pull" }
    );
    expect(cells["scoped-context"]).toBe("match");
    expect(cellDetails["scoped-context"]?.state).toBe("match");
  });

  it("treats certifications past expiration as absent for matching", () => {
    const { cells, unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: ["OSHA 30 Hour", "First Aid"],
        certificationExpirations: { "OSHA 30 Hour": "2000-01-01" },
      },
      [{ id: "r1", match_keywords: ["osha 30"] }]
    );
    expect(cells.r1).toBe("gap");
    expect(unmatchedCertifications).toEqual(["First Aid"]);
  });

  it("includes expiry metadata on matched certification cells", () => {
    const { cells, cellDetails } = computeTrainingMatrixRow(
      {
        certifications: ["OSHA 10"],
        certificationExpirations: { "OSHA 10": "2030-06-15" },
      },
      [{ id: "r1", match_keywords: ["osha 10"] }],
      new Date("2026-01-01T12:00:00.000Z")
    );
    expect(cells.r1).toBe("match");
    expect(cellDetails.r1?.expiresOn).toBe("2030-06-15");
    expect(cellDetails.r1?.expiryStatus).toBe("ok");
  });
});
