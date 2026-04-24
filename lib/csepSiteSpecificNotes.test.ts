import { describe, expect, it } from "vitest";
import {
  getSiteSpecificNotesNarrativeBody,
  NON_STEEL_SITE_NOTES_FALLBACK,
  STEEL_DECKING_SITE_NOTES_FALLBACK,
} from "@/lib/csepSiteSpecificNotes";

describe("csepSiteSpecificNotes", () => {
  it("uses user text when provided", () => {
    expect(
      getSiteSpecificNotesNarrativeBody({
        userText: "  Gate 3 only after 6am.  ",
        steelErectionInScope: true,
      })
    ).toBe("Gate 3 only after 6am.");
  });

  it("uses steel fallback when user text is empty and steel is in scope", () => {
    expect(
      getSiteSpecificNotesNarrativeBody({
        userText: "",
        steelErectionInScope: true,
      })
    ).toBe(STEEL_DECKING_SITE_NOTES_FALLBACK);
    expect(STEEL_DECKING_SITE_NOTES_FALLBACK).toContain("structural steel erection and decking");
  });

  it("uses non-steel fallback when user text is empty and steel is not in scope", () => {
    expect(
      getSiteSpecificNotesNarrativeBody({
        userText: null,
        steelErectionInScope: false,
      })
    ).toBe(NON_STEEL_SITE_NOTES_FALLBACK);
    expect(NON_STEEL_SITE_NOTES_FALLBACK).toContain("selected construction trade");
  });
});
