# AI Eval Harness

Golden-file regression tests that exercise our AI surfaces against real OpenAI.
Run via `npm run test:ai-eval` (requires `OPENAI_API_KEY` in the environment).

This is intentionally **non-blocking** in CI — see `.github/workflows/ai-eval.yml`.
Failures should be triaged like a regression report, not a merge blocker.

## Why this exists

`lib/ai/responses.ts` is the chokepoint for almost every AI surface in the app.
Without golden tests, prompt drift, model-version changes, or schema regressions
in any one surface can ship silently. The harness gives us a way to catch the
"stopped mentioning fall protection" / "started returning markdown fences" /
"forgot a required JSON key" classes of regression in <2 minutes.

## Layout

```
tests/ai/
├── runEval.test.ts                 # Vitest suite that loops every fixture
└── golden/
    ├── README.md                   # this file
    ├── schema.ts                   # AiEvalFixture type
    ├── loadFixtures.ts             # walks the directory, parses JSON
    ├── surfaces.ts                 # surface -> production adapter map
    ├── assertions.ts               # mustContain / schemaShape engine
    ├── <surface>/
    │   └── <fixture-name>.json     # one fixture
    └── ...
```

The `<surface>` directory name MUST match the `surface` key inside each fixture
JSON, and that surface must be registered in `surfaces.ts`.

## Adding a fixture

1. Pick the surface (e.g. `gc-program.review`).
2. Drop `tests/ai/golden/<surface>/<descriptive-name>.json` matching the schema:

```json
{
  "name": "fall-protection-thin",
  "surface": "gc-program.review",
  "input": { /* surface-specific input the adapter forwards */ },
  "assertions": {
    "mustContain": ["fall"],
    "mustNotContain": ["i'm sorry"],
    "schemaShape": ["review.executiveSummary", "review.oshaRelatedStrengths[]"]
  }
}
```

3. `npm run test:ai-eval` to verify it runs locally.

## Adding a new surface

1. Add an entry to the `adapters` map in `surfaces.ts` that takes the fixture's
   `input` and invokes the production codepath (NOT a stub).
2. Create a sibling `tests/ai/golden/<surface>/` directory with at least one
   fixture.
3. Prefer adapters that are hermetic against `OPENAI_API_KEY` only — i.e. don't
   require a live Supabase connection. If a surface needs DB context, accept a
   pre-built structured input in the fixture JSON instead of fetching it.

## Assertions

- `mustContain[]` — lowercased substrings the stringified output must contain.
- `mustNotContain[]` — lowercased substrings that must NOT appear (great for
  catching apologetic refusals, raw fallback markers, hallucinated citations).
- `schemaShape[]` — dotted JSON paths that must exist on the output. Suffix a
  path with `[]` to require a non-empty array (e.g. `"drafts[]"`).

Keep assertions tolerant of LLM phrasing variation. The point is to catch
*structural* regressions and *topic drift*, not to lock in exact wording.

## Skip behavior

If `OPENAI_API_KEY` is not set, every fixture is marked skipped (not failed),
so the harness can be inspected locally without burning tokens.
