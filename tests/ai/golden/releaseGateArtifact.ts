import type { AiEvalFixture } from "@/tests/ai/golden/schema";

export type AiEvalFixtureExecution = {
  surface: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  reason?: string | null;
};

export function buildAiEvalReleaseGateArtifact(params: {
  fixtures: AiEvalFixture[];
  registeredAdapters: string[];
  executions: AiEvalFixtureExecution[];
  generatedAt?: string;
  telemetryAvailable?: boolean;
  fallbackRate?: number;
  failureRate?: number;
  tokenCostRegression?: number;
  p95LatencyRegression?: number;
}) {
  const executionByKey = new Map(params.executions.map((execution) => [fixtureKey(execution.surface, execution.name), execution]));
  const unreportedFixtures = params.fixtures
    .filter((fixture) => !executionByKey.has(fixtureKey(fixture.surface, fixture.name)))
    .map((fixture) => ({ surface: fixture.surface, name: fixture.name }));
  const registeredAdapters = [...new Set(params.registeredAdapters)].sort();
  const adapterSet = new Set(registeredAdapters);
  const unregisteredFixtures = params.fixtures
    .filter((fixture) => !adapterSet.has(fixture.surface))
    .map((fixture) => `${fixture.surface}/${fixture.name}`);
  const fixtureSurfaces = new Set(params.fixtures.map((fixture) => fixture.surface));

  return {
    source: "ai eval harness execution artifact",
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    evalResults: {
      totalFixtures: params.fixtures.length,
      executedFixtures: params.executions.filter((execution) => execution.status === "passed" || execution.status === "failed").length,
      passedFixtures: params.executions.filter((execution) => execution.status === "passed").length,
      failedFixtures: params.executions.filter((execution) => execution.status === "failed").length,
      skippedFixtures: params.executions.filter((execution) => execution.status === "skipped").length + unreportedFixtures.length,
      registeredAdapters,
      registeredAdapterCount: registeredAdapters.length,
      unregisteredFixtures,
      unregisteredFixtureCount: unregisteredFixtures.length,
      adapterSurfacesWithoutFixtures: registeredAdapters.filter((surface) => !fixtureSurfaces.has(surface)),
      unreportedFixtures,
      telemetryAvailable: params.telemetryAvailable ?? false,
    },
    failureRate: params.failureRate ?? 0,
    fallbackRate: params.fallbackRate ?? 0,
    tokenCostRegression: params.tokenCostRegression ?? 0,
    p95LatencyRegression: params.p95LatencyRegression ?? 0,
    fixtureCoverage: Array.from(fixtureSurfaces).sort().map((surface) => ({
      surface,
      fixtures: params.fixtures.filter((fixture) => fixture.surface === surface).length,
      adapterRegistered: adapterSet.has(surface),
    })),
  };
}

function fixtureKey(surface: string, name: string) {
  return `${surface}/${name}`;
}
