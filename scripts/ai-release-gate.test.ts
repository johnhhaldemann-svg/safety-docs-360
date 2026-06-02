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
        evalResults: {
          totalFixtures: 2,
          executedFixtures: 2,
          passedFixtures: 2,
          failedFixtures: 0,
          skippedFixtures: 0,
          registeredAdapters: 2,
          unregisteredFixtures: 0,
          telemetryAvailable: true,
        },
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
        evalResults: {
          totalFixtures: 10,
          executedFixtures: 10,
          passedFixtures: 9,
          failedFixtures: 1,
          skippedFixtures: 0,
          registeredAdapterCount: 1,
          unregisteredFixtureCount: 0,
          telemetryAvailable: true,
        },
        failureRate: 0.03,
        fallbackRate: 0.08,
        tokenCostRegression: 0.2,
        p95LatencyRegression: 0.25,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(6);
  });

  it("fails when active surfaces have no fixture", () => {
    const result = evaluateAiReleaseGate({
      activeSurfaces: ["field-audits.ai-review"],
      coverage,
      metrics: {
        evalResults: {
          totalFixtures: 1,
          executedFixtures: 1,
          passedFixtures: 1,
          failedFixtures: 0,
          skippedFixtures: 0,
          registeredAdapters: 1,
          unregisteredFixtures: 0,
          telemetryAvailable: true,
        },
        failureRate: 0,
        fallbackRate: 0,
        tokenCostRegression: 0,
        p95LatencyRegression: 0,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain("field-audits.ai-review");
  });

  it("fails when fixture files exist but execution or adapter proof is missing", () => {
    const result = evaluateAiReleaseGate({
      activeSurfaces: ["injury-weather.insights"],
      coverage,
      metrics: {
        evalResults: {
          totalFixtures: 1,
          executedFixtures: 0,
          passedFixtures: 0,
          failedFixtures: 0,
          skippedFixtures: 1,
          registeredAdapters: 1,
          unregisteredFixtures: ["injury-weather.insights/missing-adapter.json"],
          telemetryAvailable: false,
        },
        failureRate: 0,
        fallbackRate: 0,
        tokenCostRegression: 0,
        p95LatencyRegression: 0,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.join(" ")).toContain("executed fixture count 0");
    expect(result.failures.join(" ")).toContain("fixtures without registered adapters: 1");
    expect(result.failures.join(" ")).toContain("telemetry availability false");
  });

  it("fails when no eval execution artifact is provided", () => {
    const result = evaluateAiReleaseGate({
      activeSurfaces: ["injury-weather.insights"],
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
    expect(result.failures[0]).toContain("eval execution results are missing");
  });
});
