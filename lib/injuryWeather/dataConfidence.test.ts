import { describe, expect, it } from "vitest";
import {
  computeDataConfidenceFromMetrics,
  forecastModeDisplayLabel,
  riskBandMeaningForDataConfidence,
} from "./dataConfidence";

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

  it("pairs HIGH with daily-snapshot wording (not live feed)", () => {
    expect(riskBandMeaningForDataConfidence("HIGH")).toBe("Strong support from latest daily snapshot");
  });

  it("pairs MEDIUM with snapshot wording", () => {
    expect(riskBandMeaningForDataConfidence("MEDIUM")).toBe("Partially supported by latest daily snapshot");
  });
});

describe("forecastModeDisplayLabel", () => {
  it("maps internal modes to user-facing daily snapshot labels", () => {
    expect(forecastModeDisplayLabel("baseline_only")).toBe("Baseline only (no signals in current window)");
    expect(forecastModeDisplayLabel("live_adjusted")).toBe("Daily snapshot (safety signals in window)");
  });
});
