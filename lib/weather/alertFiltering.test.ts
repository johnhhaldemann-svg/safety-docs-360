import { describe, expect, it } from "vitest";
import {
  classifyWeatherAlertSeverity,
  isWeatherAlertRelevant,
  normalizeWeatherEventAllowlist,
  normalizeWeatherSeverityThreshold,
  weatherAlertMeetsSeverity,
} from "@/lib/weather/alertFiltering";

describe("weather alert filtering", () => {
  it("normalizes severity thresholds", () => {
    expect(normalizeWeatherSeverityThreshold("Warning")).toBe("warning");
    expect(normalizeWeatherSeverityThreshold("WATCH")).toBe("watch");
    expect(normalizeWeatherSeverityThreshold("unknown")).toBe("advisory");
  });

  it("classifies construction weather alert severities from event names", () => {
    expect(classifyWeatherAlertSeverity("Tornado Warning")).toBe("warning");
    expect(classifyWeatherAlertSeverity("Severe Thunderstorm Watch")).toBe("watch");
    expect(classifyWeatherAlertSeverity("Heat Advisory")).toBe("advisory");
  });

  it("filters alerts by severity and allowlist", () => {
    expect(weatherAlertMeetsSeverity("Flash Flood Warning", "watch")).toBe(true);
    expect(weatherAlertMeetsSeverity("Heat Advisory", "watch")).toBe(false);
    expect(
      isWeatherAlertRelevant({
        alert: { eventName: "Special Weather Statement" },
        minSeverity: "advisory",
      })
    ).toBe(false);
    expect(
      isWeatherAlertRelevant({
        alert: { eventName: "Special Weather Statement" },
        minSeverity: "advisory",
        eventAllowlist: ["Special Weather Statement"],
      })
    ).toBe(true);
  });

  it("normalizes event allowlists without duplicates", () => {
    expect(normalizeWeatherEventAllowlist([" Tornado Warning ", "tornado warning", ""])).toEqual([
      "Tornado Warning",
    ]);
  });
});
