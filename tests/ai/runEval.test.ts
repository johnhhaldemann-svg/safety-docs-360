/**
 * AI eval harness - invoked via `npm run test:ai-eval`.
 *
 * This is a Vitest suite kept OUT of the default `npm run test` glob (see
 * `vitest.config.ts`) because it hits real OpenAI and is therefore slower,
 * costs money, and can fail for upstream provider reasons.
 *
 * The CI job that runs this is non-blocking on purpose (see
 * `.github/workflows/ai-eval.yml`) - its failures should be triaged like a
 * regression report, not a merge blocker.
 *
 * Skip behavior: when `OPENAI_API_KEY` is missing, live model fixtures are
 * skipped instead of failing. Deterministic surfaces still run so source-safety
 * regressions are caught without requiring a provider key.
 *
 * Set `AI_EVAL_RELEASE_GATE_METRICS_OUT=tests/ai/release-gate.metrics.json`
 * to write a release-gate artifact from actual fixture execution.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadAiEvalFixtures } from "@/tests/ai/golden/loadFixtures";
import { aiEvalSurfaceRequiresOpenAi, getAiEvalAdapter, listAiEvalSurfaces } from "@/tests/ai/golden/surfaces";
import { evaluateAiOutput, summarizeChecks } from "@/tests/ai/golden/assertions";
import { buildAiEvalReleaseGateArtifact, type AiEvalFixtureExecution } from "@/tests/ai/golden/releaseGateArtifact";

const HAS_KEY = Boolean(process.env.OPENAI_API_KEY?.trim());
const FIXTURES = loadAiEvalFixtures();
const EXECUTIONS: AiEvalFixtureExecution[] = [];

afterAll(() => {
  const outputPath = process.env.AI_EVAL_RELEASE_GATE_METRICS_OUT?.trim();
  if (!outputPath) return;
  const resolved = resolve(outputPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(
    resolved,
    `${JSON.stringify(buildAiEvalReleaseGateArtifact({
      fixtures: FIXTURES,
      registeredAdapters: listAiEvalSurfaces(),
      executions: EXECUTIONS,
      telemetryAvailable: process.env.AI_EVAL_TELEMETRY_AVAILABLE === "true",
      fallbackRate: Number(process.env.AI_EVAL_FALLBACK_RATE ?? 0),
      failureRate: Number(process.env.AI_EVAL_FAILURE_RATE ?? 0),
      tokenCostRegression: Number(process.env.AI_EVAL_TOKEN_COST_REGRESSION ?? 0),
      p95LatencyRegression: Number(process.env.AI_EVAL_P95_LATENCY_REGRESSION ?? 0),
    }), null, 2)}\n`,
    "utf8",
  );
});

describe("AI eval harness", () => {
  it("loads at least one fixture (otherwise the suite is meaningless)", () => {
    expect(FIXTURES.length).toBeGreaterThan(0);
  });

  it("only references registered adapters", () => {
    const known = new Set(listAiEvalSurfaces());
    const unknown = FIXTURES.filter((f) => !known.has(f.surface)).map((f) => f.surface);
    expect(unknown).toEqual([]);
  });
});

for (const fixture of FIXTURES) {
  describe(`AI eval / ${fixture.surface}`, () => {
    const adapter = getAiEvalAdapter(fixture.surface);

    if (!adapter) {
      EXECUTIONS.push({ surface: fixture.surface, name: fixture.name, status: "skipped", reason: `no adapter for surface '${fixture.surface}'` });
      it.skip(`${fixture.name} - no adapter for surface '${fixture.surface}'`, () => {});
      return;
    }

    if (!HAS_KEY && aiEvalSurfaceRequiresOpenAi(fixture.surface)) {
      EXECUTIONS.push({ surface: fixture.surface, name: fixture.name, status: "skipped", reason: "OPENAI_API_KEY not set" });
      it.skip(`${fixture.name} - OPENAI_API_KEY not set, skipping live call`, () => {});
      return;
    }

    it(
      fixture.name,
      async () => {
        try {
          const output = await adapter(fixture.input);
          const checks = evaluateAiOutput(output, fixture.assertions);
          const summary = summarizeChecks(checks);
          if (summary.failed > 0) {
            EXECUTIONS.push({ surface: fixture.surface, name: fixture.name, status: "failed", reason: summary.failures.join("; ") });
            throw new Error(
              `Fixture '${fixture.surface}/${fixture.name}' failed ${summary.failed}/${summary.passed + summary.failed} assertions:\n - ${summary.failures.join("\n - ")}\n\nOutput preview:\n${JSON.stringify(output, null, 2).slice(0, 4000)}`
            );
          }
          EXECUTIONS.push({ surface: fixture.surface, name: fixture.name, status: "passed" });
          expect(summary.failed).toBe(0);
        } catch (error) {
          const alreadyRecorded = EXECUTIONS.some((execution) => execution.surface === fixture.surface && execution.name === fixture.name);
          if (!alreadyRecorded) {
            EXECUTIONS.push({ surface: fixture.surface, name: fixture.name, status: "failed", reason: error instanceof Error ? error.message : "Fixture execution failed" });
          }
          throw error;
        }
      },
      120_000,
    );
  });
}
