/**
 * AI eval harness fixture schema.
 *
 * Each fixture lives at `tests/ai/golden/<surface>/<name>.json` and exercises
 * one production AI codepath end-to-end against a real OpenAI key. The harness
 * (`tests/ai/runEval.test.ts`) loops fixtures, dispatches each `surface` to its
 * adapter in `surfaces.ts`, and checks the model output against `assertions`.
 *
 * Fixtures are deliberately permissive: they assert structural properties +
 * keyword presence rather than exact strings, so we catch regressions
 * (missing field, missing topic, hallucinated forbidden term) without breaking
 * on cosmetic LLM variation.
 */

export type AiEvalAssertions = {
  /** Lowercased substrings the stringified output MUST contain (logical AND). */
  mustContain?: string[];
  /** Lowercased substrings the stringified output MUST NOT contain. */
  mustNotContain?: string[];
  /** Alias for mustNotContain, named for release-gate readability. */
  mustNotSay?: string[];
  /**
   * Dotted JSON paths that must exist on the output object. A trailing `[]`
   * marks "must be a non-empty array". Examples:
   *   "review.executiveSummary"
   *   "review.oshaRelatedStrengths[]"
   *   "drafts[]"
   */
  schemaShape?: string[];
  /** Required JSON fields, with optional type/value/range checks. */
  expectedFields?: Array<
    | string
    | {
        path: string;
        type?: "string" | "number" | "boolean" | "array" | "object";
        nonEmpty?: boolean;
        equals?: unknown;
        oneOf?: unknown[];
        min?: number;
        max?: number;
      }
  >;
  /** Required citations/evidence terms, checked against a path or the full output. */
  requiredEvidence?: Array<
    | string
    | {
        path?: string;
        terms: string[];
        minMatches?: number;
      }
  >;
  /** Severity classification check. */
  severity?: {
    path: string;
    expected?: string;
    allowed?: string[];
  };
  /** Numeric confidence range check, commonly 0..1. */
  confidenceRange?: {
    path: string;
    min: number;
    max: number;
  };
};

export type AiEvalFixture = {
  /** Fixture display name. Should match the file basename. */
  name: string;
  /** Logical surface (e.g. `"gc-program.review"`) — must match an adapter key. */
  surface: string;
  /** Surface-specific input. Adapters cast this to their expected shape. */
  input: unknown;
  assertions: AiEvalAssertions;
  /** Optional human-readable note about why this fixture exists. */
  notes?: string;
};
