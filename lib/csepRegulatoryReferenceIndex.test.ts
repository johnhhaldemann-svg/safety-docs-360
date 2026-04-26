import { describe, expect, it } from "vitest";
import {
  CSEP_REGULATORY_REFERENCE_INDEX,
  formatApplicableReferenceBullets,
  mapOshaRefLineToRCode,
  mapOshaRefStringsToSortedRCodes,
  substituteOshaCitationsWithRCodes,
} from "@/lib/csepRegulatoryReferenceIndex";

describe("csepRegulatoryReferenceIndex", () => {
  it("defines R1 through R9 with the expected subparts", () => {
    const codes = CSEP_REGULATORY_REFERENCE_INDEX.slice(0, 9).map((e) => e.code);
    expect(codes).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"]);
    expect(CSEP_REGULATORY_REFERENCE_INDEX[1]?.citation).toContain("Subpart M");
    expect(CSEP_REGULATORY_REFERENCE_INDEX[8]?.citation).toContain("1926.59");
  });

  it("maps common program definition strings to stable R-codes", () => {
    expect(mapOshaRefLineToRCode("OSHA 1926 Subpart M - Fall Protection")).toBe("R2");
    expect(mapOshaRefLineToRCode("OSHA 1926 Subpart J - Fire Protection and Prevention")).toBe("R5");
    expect(mapOshaRefLineToRCode("OSHA 1926 Subpart K - Electrical")).toBe("R11");
    expect(mapOshaRefLineToRCode("OSHA 1926.59 - Hazard Communication")).toBe("R9");
  });

  it("dedupes and sorts R-codes", () => {
    expect(mapOshaRefStringsToSortedRCodes(["OSHA 1926 Subpart M", "OSHA 1926 Subpart M", "OSHA 1926 Subpart E"])).toEqual([
      "R2",
      "R10",
    ]);
  });

  it("formats applicable reference bullets as R-numbers only", () => {
    expect(formatApplicableReferenceBullets(["OSHA 1926 Subpart M - Fall Protection", "OSHA 1926 Subpart X"])).toEqual([
      "R2",
      "R6",
    ]);
  });

  it("substitutes long OSHA phrases in prose with R-codes", () => {
    const t = substituteOshaCitationsWithRCodes(
      "Workers shall follow OSHA 1926 Subpart M - Fall Protection when at height."
    );
    expect(t).toContain("R2");
    expect(t).not.toContain("Subpart M");
  });

  it("does not double-substitute Appendix G style reference lines", () => {
    const line = "R2 OSHA 29 CFR 1926 Subpart M - Fall Protection";
    expect(substituteOshaCitationsWithRCodes(line)).toBe(line);
  });
});
