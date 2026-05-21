import { describe, expect, it } from "vitest";
import { splitParagraphAtEstimatedDocxLineCount } from "@/lib/csepDocxReadableParagraphs";

describe("csepDocxReadableParagraphs", () => {
  it("returns a single chunk when under the estimated line budget", () => {
    const t = "Short note for the field.";
    expect(splitParagraphAtEstimatedDocxLineCount(t)).toEqual([t]);
  });

  it("packs sentences into multiple chunks when a paragraph would exceed ~6 lines", () => {
    const s1 =
      "Report injuries to supervision immediately when the scene is safe and workers are not in further danger.";
    const s2 =
      "Escalate to site safety and the owner or GC/CM when program rules, law, or contract require notification on the same shift.";
    const s3 =
      "Preserve the scene, identify witnesses, and begin documentation without waiting for a polished narrative.";
    const wall = `${s1} ${s2} ${s3}`;
    const chunks = splitParagraphAtEstimatedDocxLineCount(wall, { maxLines: 2, charsPerLine: 80 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.join(" ").replace(/\s+/g, " ").trim()).toBe(wall.replace(/\s+/g, " ").trim());
  });
});
