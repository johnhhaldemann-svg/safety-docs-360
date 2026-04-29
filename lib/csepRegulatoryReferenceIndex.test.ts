import { describe, expect, it } from "vitest";
import {
  CSEP_REGULATORY_REFERENCE_INDEX,
  formatApplicableReferenceBullets,
  mapOshaRefLineToRCode,
  mapOshaRefStringsToSortedRCodes,
  substituteOshaCitationsWithRCodes,
} from "@/lib/csepRegulatoryReferenceIndex";

describe("csepRegulatoryReferenceIndex", () => {
  it("defines the Version C R1 through R17 reference map", () => {
    const codes = CSEP_REGULATORY_REFERENCE_INDEX.map((e) => e.code);
    expect(codes).toEqual([
      "R1",
      "R2",
      "R3",
      "R4",
      "R5",
      "R6",
      "R7",
      "R8",
      "R9",
      "R10",
      "R11",
      "R12",
      "R13",
      "R14",
      "R15",
      "R16",
      "R17",
    ]);
    expect(CSEP_REGULATORY_REFERENCE_INDEX[0]?.citation).toContain("Subpart R");
    expect(CSEP_REGULATORY_REFERENCE_INDEX[9]?.citation).toContain("Hazard Communication");
  });

  it("maps common program definition strings to stable R-codes", () => {
    expect(mapOshaRefLineToRCode("OSHA 1926 Subpart M - Fall Protection")).toBe("R2");
    expect(mapOshaRefLineToRCode("OSHA 1926 Subpart J - Fire Protection and Prevention")).toBe("R4");
    expect(mapOshaRefLineToRCode("OSHA 1926 Subpart CC - Cranes and Derricks")).toBe("R6");
    expect(mapOshaRefLineToRCode("OSHA 1926.59 - Hazard Communication")).toBe("R10");
    expect(mapOshaRefLineToRCode("Project-specific permit and owner rule")).toBe("R12");
    expect(mapOshaRefLineToRCode("OSHA 1904 recordkeeping")).toBe("R16");
    expect(mapOshaRefLineToRCode("Severe weather lightning wind heat cold controls")).toBe("R17");
  });

  it("dedupes and sorts R-codes", () => {
    expect(mapOshaRefStringsToSortedRCodes(["OSHA 1926 Subpart M", "OSHA 1926 Subpart M", "OSHA 1926 Subpart E"])).toEqual([
      "R2",
      "R11",
    ]);
  });

  it("formats applicable reference bullets as R-numbers only", () => {
    expect(formatApplicableReferenceBullets(["OSHA 1926 Subpart M - Fall Protection", "OSHA 1926 Subpart X"])).toEqual([
      "R2",
      "R8",
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
