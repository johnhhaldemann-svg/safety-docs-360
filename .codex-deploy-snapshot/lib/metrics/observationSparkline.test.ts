import { describe, expect, it } from "vitest";
import {
  buildAreaAndLinePath,
  formatShortAxisDate,
  resolveSparklineData,
  sparkMaxY,
  tickIndices,
} from "./observationSparkline";

describe("resolveSparklineData", () => {
  it("uses placeholder for empty", () => {
    expect(resolveSparklineData([])).toHaveLength(2);
  });
  it("keeps data when non-empty", () => {
    const p = [{ date: "2024-01-01", count: 3 }];
    expect(resolveSparklineData(p)).toEqual(p);
  });
});

describe("sparkMaxY", () => {
  it("is at least 1", () => {
    expect(sparkMaxY([{ count: 0 }, { count: 0 }])).toBe(1);
  });
  it("matches max count", () => {
    expect(sparkMaxY([{ count: 0 }, { count: 7 }])).toBe(7);
  });
});

describe("tickIndices", () => {
  it("returns empty for length 0", () => {
    expect(tickIndices(0)).toEqual([]);
  });
  it("returns single index", () => {
    expect(tickIndices(1)).toEqual([0]);
  });
  it("returns ends for 2", () => {
    expect(tickIndices(2)).toEqual([0, 1]);
  });
  it("returns first mid last for 5", () => {
    expect(tickIndices(5)).toEqual([0, 2, 4]);
  });
});

describe("formatShortAxisDate", () => {
  it("formats ISO", () => {
    const s = formatShortAxisDate("2024-05-20");
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("buildAreaAndLinePath", () => {
  it("produces a path for two points", () => {
    const { dPath, maxY } = buildAreaAndLinePath(
      [
        { date: "a", count: 0 },
        { date: "b", count: 4 },
      ],
      100,
      50,
      4,
    );
    expect(dPath).toContain("M");
    expect(dPath).toContain("L");
    expect(maxY).toBe(4);
  });
});
