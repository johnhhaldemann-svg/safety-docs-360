/**
 * AI eval harness — invoked via `npm run test:ai-eval`.
 *
 * This is a Vitest suite kept OUT of the default `npm run test` glob (see
 * `vitest.config.ts`) because it hits real OpenAI and is therefore slower,
 * costs money, and can fail for upstream provider reasons.
 *
 * The CI job that runs this is non-blocking on purpose (see
 * `.github/workflows/ai-eval.yml`) — its failures should be triaged like a
 * regression report, not a merge blocker.
 *
 * Skip behavior: when `OPENAI_API_KEY` is missing, every fixture is marked
 * skipped instead of failing, so engineers can run the harness locally without
 * a key and see the surfaces they would exercise.
 */

import { describe, it, expect } from "vitest";
import { loadAiEvalFixtures } from "@/tests/ai/golden/loadFixtures";
import { getAiEvalAdapter, listAiEvalSurfaces } from "@/tests/ai/golden/surfaces";
import { evaluateAiOutput, summarizeChecks } from "@/tests/ai/golden/assertions";

const HAS_KEY = Boolean(process.env.OPENAI_API_KEY?.trim());
const FIXTURES = loadAiEvalFixtures();

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
      it.skip(`${fixture.name} — no adapter for surface '${fixture.surface}'`, () => {});
      return;
    }

    if (!HAS_KEY) {
      it.skip(`${fixture.name} — OPENAI_API_KEY not set, skipping live call`, () => {});
      return;
    }

    it(
      fixture.name,
      async () => {
        const output = await adapter(fixture.input);
        const checks = evaluateAiOutput(output, fixture.assertions);
        const summary = summarizeChecks(checks);
        if (summary.failed > 0) {
          throw new Error(
            `Fixture '${fixture.surface}/${fixture.name}' failed ${summary.failed}/${summary.passed + summary.failed} assertions:\n - ${summary.failures.join("\n - ")}\n\nOutput preview:\n${JSON.stringify(output, null, 2).slice(0, 4000)}`
          );
        }
        expect(summary.failed).toBe(0);
      },
      120_000
    );
  });
}
