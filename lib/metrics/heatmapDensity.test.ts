import { describe, expect, it } from "vitest";
import { heatmapCellClassName } from "./heatmapDensity";

describe("heatmapCellClassName", () => {
  it("returns neutral for inactive cells", () => {
    expect(heatmapCellClassName("Low", false)).toContain("246,249,255");
  });

  it("colors active cells by severity level", () => {
    expect(heatmapCellClassName("Low")).toContain("46,158,91");
    expect(heatmapCellClassName("Moderate")).toContain("67,116,208");
    expect(heatmapCellClassName("High")).toContain("220,112,112");
    expect(heatmapCellClassName("Critical")).toContain("209,72,72");
  });

  it("treats medium as moderate", () => {
    expect(heatmapCellClassName("Medium")).toBe(heatmapCellClassName("Moderate"));
  });
});
