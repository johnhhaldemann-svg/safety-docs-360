import { describe, expect, it } from "vitest";
import {
  getProjectSpecificSafetyNotesNarrativeBody,
  getSiteSpecificNotesNarrativeBody,
  PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK,
} from "@/lib/csepSiteSpecificNotes";

describe("csepSiteSpecificNotes / project-specific safety notes", () => {
  it("uses user text when provided", () => {
    expect(
      getProjectSpecificSafetyNotesNarrativeBody({
        userText: "  Gate 3 only after 6am.  ",
      })
    ).toBe("Gate 3 only after 6am.");
  });

  it("uses the standard empty fallback when user text is empty", () => {
    expect(getProjectSpecificSafetyNotesNarrativeBody({ userText: "" })).toBe(
      PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK
    );
    expect(getProjectSpecificSafetyNotesNarrativeBody({ userText: null })).toBe(
      PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK
    );
    expect(PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK).toContain("Field supervision shall confirm");
  });

  it("legacy getSiteSpecificNotesNarrativeBody ignores steel flag and matches new helper", () => {
    expect(
      getSiteSpecificNotesNarrativeBody({
        userText: "",
        steelErectionInScope: true,
      })
    ).toBe(PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK);
  });
});
