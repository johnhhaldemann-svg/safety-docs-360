import { describe, expect, it } from "vitest";
import { isForecasterSyntheticIncident } from "@/lib/injuryWeather/excludeForecasterIncidents";

describe("isForecasterSyntheticIncident", () => {
  it("returns false for normal rows", () => {
    expect(isForecasterSyntheticIncident("Worker strain", "Lifted beam awkwardly")).toBe(false);
    expect(isForecasterSyntheticIncident(null, null)).toBe(false);
  });

  it("detects tagged forecaster rows", () => {
    expect(isForecasterSyntheticIncident("Slip", "Note [injury-weather-forecaster]")).toBe(true);
    expect(isForecasterSyntheticIncident("[iw-forecaster] test", null)).toBe(true);
    expect(isForecasterSyntheticIncident(null, "Created via Injury Weather forecaster")).toBe(true);
  });
});
