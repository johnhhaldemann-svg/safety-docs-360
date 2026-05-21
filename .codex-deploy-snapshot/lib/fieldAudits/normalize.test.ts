import { describe, expect, it } from "vitest";
import { normalizeFieldAuditPayload } from "@/lib/fieldAudits/normalize";

describe("normalizeFieldAuditPayload", () => {
  it("turns scored field items into structured observations", () => {
    const result = normalizeFieldAuditPayload({
      selectedTrade: "electrical",
      statusMap: {
        "field-electrical-gfci": "pass",
        "field-electrical-overhead-lines": "fail",
      },
      notesMap: {
        "field-electrical-overhead-lines": "Observed ladder work near overhead lines.",
      },
      photoCounts: {
        "field-electrical-overhead-lines": 2,
      },
    });

    expect(result.scoreSummary).toMatchObject({
      total: 2,
      pass: 1,
      fail: 1,
      scored: 2,
      compliancePercent: 50,
      failedCritical: 1,
      photoCount: 2,
    });
    expect(result.observations[1]).toMatchObject({
      sourceKey: "field-electrical-overhead-lines",
      templateSource: "field",
      tradeCode: "electrical",
      status: "fail",
      severity: "critical",
      notes: "Observed ladder work near overhead lines.",
      photoCount: 2,
    });
  });

  it("includes Excel-derived rows when they are scored", () => {
    const result = normalizeFieldAuditPayload({
      selectedTrade: "roofing",
      statusMap: {
        "hs-0-0": "fail",
      },
    });

    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      sourceKey: "hs-0-0",
      templateSource: "hs",
      tradeCode: "roofing",
      status: "fail",
    });
    expect(result.observations[0]?.itemLabel.length).toBeGreaterThan(0);
  });
});
