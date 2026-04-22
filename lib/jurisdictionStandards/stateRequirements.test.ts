import { describe, expect, it } from "vitest";
import { getStateRequirementSupplement } from "@/lib/jurisdictionStandards/stateRequirements";

describe("state requirement supplements", () => {
  it("returns Wisconsin building and environmental requirements from the dataset", () => {
    const supplement = getStateRequirementSupplement("WI");

    expect(supplement?.stateName).toBe("Wisconsin");
    expect(supplement?.body).toContain(
      "Wisconsin state-specific building, environmental, and permit requirements may apply"
    );
    expect(supplement?.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Commercial Building Code (SPS 361-366)"),
        expect.stringContaining("WPDES General Permit WI-S067831-6"),
        expect.stringContaining("Asbestos notification for demolition/renovation"),
      ])
    );
    expect(supplement?.body).not.toContain("workspace dataset");
    expect(supplement?.body).not.toContain("official_resources");
    expect(supplement?.bullets.join(" ")).not.toContain("Official resources:");
    expect(supplement?.bullets.join(" ")).not.toContain("State notes:");
  });

  it("returns federal-OSHA states like Texas with state permitting details", () => {
    const supplement = getStateRequirementSupplement("TX");

    expect(supplement?.stateName).toBe("Texas");
    const bulletsText = supplement?.bullets.join(" ") ?? "";
    expect(bulletsText).toContain("Texas Department of Licensing and Regulation");
    expect(bulletsText).toContain("TXR150000");
    expect(bulletsText).toContain("Primarily local / home-rule");
  });

  it("returns null when no state code is supplied", () => {
    expect(getStateRequirementSupplement(null)).toBeNull();
  });
});
