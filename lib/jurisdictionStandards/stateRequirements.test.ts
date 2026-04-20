import { describe, expect, it } from "vitest";
import { getStateRequirementSupplement } from "@/lib/jurisdictionStandards/stateRequirements";

describe("state requirement supplements", () => {
  it("returns Wisconsin building and environmental requirements from the dataset", () => {
    const supplement = getStateRequirementSupplement("WI");

    expect(supplement?.stateName).toBe("Wisconsin");
    expect(supplement?.body).toContain("Wisconsin building and environmental requirements supplement active");
    expect(supplement?.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Commercial Building Code (SPS 361-366)"),
        expect.stringContaining("WPDES General Permit WI-S067831-6"),
        expect.stringContaining("Asbestos notification for demolition/renovation"),
      ])
    );
  });

  it("returns federal-OSHA states like Texas with state permitting details", () => {
    const supplement = getStateRequirementSupplement("TX");

    expect(supplement?.stateName).toBe("Texas");
    expect(supplement?.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Texas Department of Licensing and Regulation"),
        expect.stringContaining("TXR150000"),
        expect.stringContaining("No mandatory statewide building code"),
      ])
    );
  });

  it("returns null when no state code is supplied", () => {
    expect(getStateRequirementSupplement(null)).toBeNull();
  });
});
