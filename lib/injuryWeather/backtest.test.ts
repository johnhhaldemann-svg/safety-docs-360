import { describe, expect, it } from "vitest";
import { pearsonCorrelation, spearmanCorrelation } from "./backtest";

describe("pearsonCorrelation", () => {
  it("returns 1 for perfect positive linear relationship", () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });

  it("returns null when variance is zero", () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("returns null when fewer than 3 pairs", () => {
    expect(pearsonCorrelation([1, 2], [1, 2])).toBeNull();
  });
});

describe("spearmanCorrelation", () => {
  it("returns 1 for monotonic increasing ranks", () => {
    const xs = [10, 20, 30, 40, 50];
    const ys = [1, 2, 3, 4, 5];
    expect(spearmanCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });
});
