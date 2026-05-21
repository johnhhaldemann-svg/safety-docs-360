import { describe, expect, it } from "vitest";
import {
  buildMarketplacePreviewSections,
  splitPreviewLines,
} from "./marketplacePreviewSections";

describe("buildMarketplacePreviewSections", () => {
  it("groups heading-like content into separate teaser cards", () => {
    const lines = splitPreviewLines(`
      Introduction
      This is the first opening line.
      This is the second line.
      Review Path
      Section detail one.
      Section detail two.
    `);

    const sections = buildMarketplacePreviewSections(lines, {
      teaserLineCount: 1,
      maxSections: 4,
      fallbackGroupSize: 3,
    });

    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections[0].title).toMatch(/Introduction/i);
    expect(sections[0].teaserLines).toHaveLength(1);
    expect(sections[0].blurredLines.length).toBeGreaterThan(0);
    expect(sections[1].title).toMatch(/Review Path/i);
  });

  it("falls back to chunked teasers when headings are not detected", () => {
    const lines = splitPreviewLines("one\ntwo\nthree\nfour\nfive\nsix\nseven");

    const sections = buildMarketplacePreviewSections(lines, {
      teaserLineCount: 2,
      maxSections: 3,
      fallbackGroupSize: 3,
    });

    expect(sections).toHaveLength(3);
    expect(sections[0].lines).toEqual(["one", "two", "three"]);
    expect(sections[0].teaserLines).toEqual(["one", "two"]);
    expect(sections[0].blurredLines).toEqual(["three"]);
  });
});
