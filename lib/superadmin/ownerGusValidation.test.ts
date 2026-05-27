import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWNER_GUS_VALIDATION_TEST_CASES,
  OWNER_GUS_SOURCE_RULES,
  validateOwnerGusResultUpdateInput,
  validateOwnerGusRunInput,
  validateOwnerGusTestCaseInput,
} from "@/lib/superadmin/ownerGusValidation";

describe("owner Gus validation helpers", () => {
  it("defines the required default Gus safety scenarios", () => {
    const titles = DEFAULT_OWNER_GUS_VALIDATION_TEST_CASES.map((testCase) => testCase.title);

    expect(titles).toEqual([
      "Hot work near combustible material",
      "Trench/excavation work",
      "Confined space entry",
      "Fall protection scenario",
      "Missing training scenario",
      "Incident response scenario",
      "Stop work authority scenario",
    ]);
  });

  it("keeps source rules conservative", () => {
    expect(OWNER_GUS_SOURCE_RULES).toContain(
      "Gus must not invent OSHA, company, or safety requirements."
    );
    expect(OWNER_GUS_SOURCE_RULES).toContain(
      "Gus should mark uncertain or unsupported answers as needing review."
    );
  });

  it("normalizes Gus validation run input", () => {
    expect(
      validateOwnerGusRunInput({
        scenario: "  Crew is doing hot work.  ",
        testCaseId: "case-1",
      })
    ).toEqual({
      scenario: "Crew is doing hot work.",
      testCaseId: "case-1",
    });
  });

  it("normalizes saved test cases and result status updates", () => {
    expect(
      validateOwnerGusTestCaseInput({
        title: "  Custom scenario  ",
        scenario: "  Test this  ",
        expectedFocus: [" source rules ", "", 9],
      })
    ).toEqual({
      title: "Custom scenario",
      scenario: "Test this",
      expectedFocus: ["source rules"],
    });

    expect(validateOwnerGusResultUpdateInput({ status: "flagged", notes: "  Unsupported claim  " })).toEqual({
      status: "flagged",
      notes: "Unsupported claim",
    });
    expect(validateOwnerGusResultUpdateInput({ status: "approved-ish" })).toEqual({
      status: "needs_review",
      notes: null,
    });
  });
});
