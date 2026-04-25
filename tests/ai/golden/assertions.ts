/**
 * Lightweight assertion helpers used by the AI eval harness.
 *
 * `mustContain` / `mustNotContain` flatten the entire output into one
 * lowercased JSON string and check substring presence — this is intentionally
 * tolerant of LLM phrasing variation.
 *
 * `schemaShape` walks dotted paths and supports a `[]` suffix to require a
 * non-empty array at the leaf (for example `"review.oshaRelatedStrengths[]"`).
 */

import type { AiEvalAssertions } from "./schema";

export type AiEvalCheck = { ok: true } | { ok: false; reason: string };

export function evaluateAiOutput(output: unknown, assertions: AiEvalAssertions): AiEvalCheck[] {
  const checks: AiEvalCheck[] = [];
  const flat = JSON.stringify(output ?? null).toLowerCase();

  for (const needle of assertions.mustContain ?? []) {
    const lowered = needle.toLowerCase();
    if (!flat.includes(lowered)) {
      checks.push({ ok: false, reason: `mustContain: missing "${needle}"` });
    } else {
      checks.push({ ok: true });
    }
  }

  for (const needle of assertions.mustNotContain ?? []) {
    const lowered = needle.toLowerCase();
    if (flat.includes(lowered)) {
      checks.push({ ok: false, reason: `mustNotContain: forbidden term "${needle}" appeared` });
    } else {
      checks.push({ ok: true });
    }
  }

  for (const path of assertions.schemaShape ?? []) {
    checks.push(checkSchemaPath(output, path));
  }

  return checks;
}

function checkSchemaPath(output: unknown, expr: string): AiEvalCheck {
  const requireNonEmptyArray = expr.endsWith("[]");
  const path = requireNonEmptyArray ? expr.slice(0, -2) : expr;
  const segments = path.length > 0 ? path.split(".") : [];

  let current: unknown = output;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return { ok: false, reason: `schemaShape: '${expr}' missing at '${segment}'` };
    }
    current = (current as Record<string, unknown>)[segment];
    if (typeof current === "undefined") {
      return { ok: false, reason: `schemaShape: '${expr}' missing at '${segment}'` };
    }
  }

  if (requireNonEmptyArray) {
    if (!Array.isArray(current) || current.length === 0) {
      return { ok: false, reason: `schemaShape: '${expr}' is not a non-empty array` };
    }
  }

  return { ok: true };
}

export function summarizeChecks(checks: AiEvalCheck[]): {
  passed: number;
  failed: number;
  failures: string[];
} {
  let passed = 0;
  const failures: string[] = [];
  for (const check of checks) {
    if (check.ok) passed += 1;
    else failures.push(check.reason);
  }
  return { passed, failed: failures.length, failures };
}
