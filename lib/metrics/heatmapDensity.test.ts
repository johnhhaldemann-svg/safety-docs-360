import { describe, expect, it } from "vitest";
import { heatmapCellClassName } from "./heatmapDensity";

describe("heatmapCellClassName", () => {
  it("returns neutral for zero", () => {
    expect(heatmapCellClassName(0)).toContain("246,249,255");
  });
  it("increases intensity with t", () => {
    const a = heatmapCellClassName(0.1);
    const b = heatmapCellClassName(0.9);
    expect(a).not.toBe(b);
  });
});
