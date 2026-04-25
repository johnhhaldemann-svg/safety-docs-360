import { describe, expect, it } from "vitest";
import { EVALUATION } from "./chartLibraryEvaluation";

describe("chartLibraryEvaluation", () => {
  it("documents options", () => {
    expect(EVALUATION.stayCustom.when).toBeTruthy();
    expect(EVALUATION.recharts.approxGzipKb).toBeGreaterThan(0);
  });
});
