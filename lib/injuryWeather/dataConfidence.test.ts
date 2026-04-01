import { describe, expect, it } from "vitest";
import { computeDataConfidenceFromMetrics, riskBandMeaningForDataConfidence } from "./dataConfidence";

describe("computeDataConfidenceFromMetrics", () => {
  it("returns LOW when there are no observations", () => {
    expect(computeDataConfidenceFromMetrics(0, 5, 4)).toBe("LOW");
  });

  it("returns HIGH when density thresholds are met", () => {
    expect(computeDataConfidenceFromMetrics(50, 5, 4)).toBe("HIGH");
  });
});

describe("riskBandMeaningForDataConfidence", () => {
  it("pairs LOW with baseline wording (not low hazard)", () => {
    expect(riskBandMeaningForDataConfidence("LOW")).toBe("Estimate based on baseline only");
  });

  it("pairs HIGH with live-data confirmation", () => {
    expect(riskBandMeaningForDataConfidence("HIGH")).toBe("Confirmed by live data");
  });
});
