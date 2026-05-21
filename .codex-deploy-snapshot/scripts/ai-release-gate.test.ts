import { describe, expect, it } from "vitest";
import { evaluateAiReleaseGate } from "./ai-release-gate.mjs";

const coverage = new Map([
  ["injury-weather.insights", 1],
  ["jobsite.site-visual.generate", 1],
]);

describe("AI release gate", () => {
  it("passes when thresholds and coverage pass", () => {
    const result = evaluateAiReleaseGate({
      activeSurfaces: ["injury-weather.insights", "jobsite.site-visual.generate"],
      coverage,
      metrics: {
        criticalEvalPassRate: 0.96,
        failureRate: 0.01,
        fallbackRate: 0.03,
        tokenCostRegression: 0.1,
        p95LatencyRegression: 0.12,
      },
    });
    expect(result.ok).toBe(true);
  });

  it("fails when runtime thresholds regress", () => {
    const result = evaluateAiReleaseGate({
      activeSurfaces: ["injury-weather.insights"],
      coverage,
      metrics: {
        criticalEvalPassRate: 0.9,
        failureRate: 0.03,
        fallbackRate: 0.08,
        tokenCostRegression: 0.2,
        p95LatencyRegression: 0.25,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(5);
  });

  it("fails when active surfaces have no fixture", () => {
    const result = evaluateAiReleaseGate({
      activeSurfaces: ["field-audits.ai-review"],
      coverage,
      metrics: {
        criticalEvalPassRate: 1,
        failureRate: 0,
        fallbackRate: 0,
        tokenCostRegression: 0,
        p95LatencyRegression: 0,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain("field-audits.ai-review");
  });
});
