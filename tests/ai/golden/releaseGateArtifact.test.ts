import { describe, expect, it } from "vitest";
import { buildAiEvalReleaseGateArtifact } from "@/tests/ai/golden/releaseGateArtifact";

describe("AI eval release-gate artifact", () => {
  it("turns fixture execution results into release-gate metrics", () => {
    const artifact = buildAiEvalReleaseGateArtifact({
      generatedAt: "2026-06-02T00:00:00.000Z",
      telemetryAvailable: true,
      fixtures: [
        { surface: "gus.verified-learning", name: "deterministic", input: {}, assertions: {} },
        { surface: "injury-weather.insights", name: "live", input: {}, assertions: {} },
      ],
      registeredAdapters: ["gus.verified-learning", "injury-weather.insights", "unused.adapter"],
      executions: [
        { surface: "gus.verified-learning", name: "deterministic", status: "passed" },
        { surface: "injury-weather.insights", name: "live", status: "skipped", reason: "OPENAI_API_KEY missing" },
      ],
    });

    expect(artifact.evalResults).toMatchObject({
      totalFixtures: 2,
      executedFixtures: 1,
      passedFixtures: 1,
      failedFixtures: 0,
      skippedFixtures: 1,
      registeredAdapterCount: 3,
      unregisteredFixtureCount: 0,
      telemetryAvailable: true,
    });
    expect(artifact.evalResults.adapterSurfacesWithoutFixtures).toEqual(["unused.adapter"]);
    expect(artifact.fixtureCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: "gus.verified-learning", adapterRegistered: true }),
    ]));
  });

  it("marks fixtures with no execution record as skipped so coverage cannot be paper-only", () => {
    const artifact = buildAiEvalReleaseGateArtifact({
      fixtures: [{ surface: "missing.adapter", name: "not-run", input: {}, assertions: {} }],
      registeredAdapters: [],
      executions: [],
    });

    expect(artifact.evalResults.executedFixtures).toBe(0);
    expect(artifact.evalResults.skippedFixtures).toBe(1);
    expect(artifact.evalResults.unregisteredFixtureCount).toBe(1);
    expect(artifact.evalResults.unreportedFixtures).toHaveLength(1);
  });
});
