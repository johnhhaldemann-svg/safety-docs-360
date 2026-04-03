import { describe, expect, it } from "vitest";
import { buildEventToInjuryCounts, eventToInjuryLikelihoodTable } from "./injuryHistoricalModel";

describe("injuryHistoricalModel", () => {
  it("normalizes legacy exposure_event_type aliases when counting pairs", () => {
    const rows = [
      {
        category: "incident",
        exposure_event_type: "exposure_to_harmful_substance",
        injury_type: "laceration",
      },
    ];
    const counts = buildEventToInjuryCounts(rows);
    expect(counts.has("exposure_harmful_substance")).toBe(true);
    const table = eventToInjuryLikelihoodTable(rows, 4);
    expect(table.some((t) => t.exposureEventType === "exposure_harmful_substance")).toBe(true);
  });
});
