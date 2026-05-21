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
    checks.push(checkMustNotContain(flat, needle, "mustNotContain"));
  }

  for (const needle of assertions.mustNotSay ?? []) {
    checks.push(checkMustNotContain(flat, needle, "mustNotSay"));
  }

  for (const path of assertions.schemaShape ?? []) {
    checks.push(checkSchemaPath(output, path));
  }

  for (const field of assertions.expectedFields ?? []) {
    checks.push(checkExpectedField(output, field));
  }

  for (const evidence of assertions.requiredEvidence ?? []) {
    checks.push(checkRequiredEvidence(output, evidence));
  }

  if (assertions.severity) {
    checks.push(checkSeverity(output, assertions.severity));
  }

  if (assertions.confidenceRange) {
    checks.push(checkConfidenceRange(output, assertions.confidenceRange));
  }

  return checks;
}

function checkMustNotContain(flat: string, needle: string, label: string): AiEvalCheck {
    const lowered = needle.toLowerCase();
    if (flat.includes(lowered)) {
      return { ok: false, reason: `${label}: forbidden term "${needle}" appeared` };
    }
    return { ok: true };
}

function valueAtPath(output: unknown, path: string): { found: boolean; value: unknown; missingAt?: string } {
  const segments = path.length > 0 ? path.split(".") : [];
  let current: unknown = output;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return { found: false, value: undefined, missingAt: segment };
    }
    current = (current as Record<string, unknown>)[segment];
    if (typeof current === "undefined") {
      return { found: false, value: undefined, missingAt: segment };
    }
  }
  return { found: true, value: current };
}

function checkSchemaPath(output: unknown, expr: string): AiEvalCheck {
  const requireNonEmptyArray = expr.endsWith("[]");
  const path = requireNonEmptyArray ? expr.slice(0, -2) : expr;
  const resolved = valueAtPath(output, path);
  if (!resolved.found) {
    return { ok: false, reason: `schemaShape: '${expr}' missing at '${resolved.missingAt ?? path}'` };
  }

  if (requireNonEmptyArray) {
    if (!Array.isArray(resolved.value) || resolved.value.length === 0) {
      return { ok: false, reason: `schemaShape: '${expr}' is not a non-empty array` };
    }
  }

  return { ok: true };
}

function checkExpectedField(output: unknown, field: NonNullable<AiEvalAssertions["expectedFields"]>[number]): AiEvalCheck {
  const spec = typeof field === "string" ? { path: field } : field;
  const resolved = valueAtPath(output, spec.path);
  if (!resolved.found) return { ok: false, reason: `expectedFields: '${spec.path}' is missing` };
  const value = resolved.value;

  if (spec.type) {
    const ok =
      spec.type === "array"
        ? Array.isArray(value)
        : spec.type === "object"
          ? value != null && typeof value === "object" && !Array.isArray(value)
          : typeof value === spec.type;
    if (!ok) return { ok: false, reason: `expectedFields: '${spec.path}' is not ${spec.type}` };
  }
  if (spec.nonEmpty) {
    const ok =
      (typeof value === "string" && value.trim().length > 0) ||
      (Array.isArray(value) && value.length > 0) ||
      (value != null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
    if (!ok) return { ok: false, reason: `expectedFields: '${spec.path}' is empty` };
  }
  if ("equals" in spec && JSON.stringify(value) !== JSON.stringify(spec.equals)) {
    return { ok: false, reason: `expectedFields: '${spec.path}' did not equal expected value` };
  }
  if (spec.oneOf && !spec.oneOf.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
    return { ok: false, reason: `expectedFields: '${spec.path}' was not one of allowed values` };
  }
  if (typeof value === "number") {
    if (spec.min != null && value < spec.min) return { ok: false, reason: `expectedFields: '${spec.path}' below ${spec.min}` };
    if (spec.max != null && value > spec.max) return { ok: false, reason: `expectedFields: '${spec.path}' above ${spec.max}` };
  }
  return { ok: true };
}

function checkRequiredEvidence(output: unknown, evidence: NonNullable<AiEvalAssertions["requiredEvidence"]>[number]): AiEvalCheck {
  const spec = typeof evidence === "string" ? { terms: [evidence], minMatches: 1 } : evidence;
  const haystack =
    spec.path && valueAtPath(output, spec.path).found
      ? JSON.stringify(valueAtPath(output, spec.path).value ?? null).toLowerCase()
      : JSON.stringify(output ?? null).toLowerCase();
  const matches = spec.terms.filter((term) => haystack.includes(term.toLowerCase()));
  const minMatches = spec.minMatches ?? spec.terms.length;
  if (matches.length < minMatches) {
    return {
      ok: false,
      reason: `requiredEvidence: matched ${matches.length}/${minMatches} term(s): ${spec.terms.join(", ")}`,
    };
  }
  return { ok: true };
}

function checkSeverity(output: unknown, severity: NonNullable<AiEvalAssertions["severity"]>): AiEvalCheck {
  const resolved = valueAtPath(output, severity.path);
  if (!resolved.found) return { ok: false, reason: `severity: '${severity.path}' is missing` };
  const value = String(resolved.value ?? "");
  if (severity.expected && value !== severity.expected) {
    return { ok: false, reason: `severity: expected '${severity.expected}', got '${value}'` };
  }
  if (severity.allowed && !severity.allowed.includes(value)) {
    return { ok: false, reason: `severity: '${value}' not in allowed set` };
  }
  return { ok: true };
}

function checkConfidenceRange(output: unknown, range: NonNullable<AiEvalAssertions["confidenceRange"]>): AiEvalCheck {
  const resolved = valueAtPath(output, range.path);
  if (!resolved.found) return { ok: false, reason: `confidenceRange: '${range.path}' is missing` };
  const value = typeof resolved.value === "number" ? resolved.value : Number(resolved.value);
  if (!Number.isFinite(value)) return { ok: false, reason: `confidenceRange: '${range.path}' is not numeric` };
  if (value < range.min || value > range.max) {
    return { ok: false, reason: `confidenceRange: '${range.path}' ${value} outside ${range.min}-${range.max}` };
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
