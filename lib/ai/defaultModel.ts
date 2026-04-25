/**
 * Single dial for "the default model the platform uses when no surface-specific
 * env var is set". Today our AI surfaces ship with mixed defaults — Safety
 * Intelligence + company memory assist use `gpt-4o-mini`, permit copilot uses
 * `gpt-4.1` — which makes per-customer cost/latency tuning awkward.
 *
 * `COMPANY_AI_DEFAULT_MODEL`, when set, overrides the per-callsite built-in
 * default everywhere this helper is consulted, while preserving the existing
 * surface-specific env precedence chain (e.g. `SAFETY_INTELLIGENCE_*_MODEL`,
 * `COMPANY_AI_MODEL`, `RISK_MEMORY_LLM_MODEL`).
 *
 * Resolution precedence at every call site is:
 *   1. Surface-specific env var (e.g. `SAFETY_INTELLIGENCE_DOCUMENT_MODEL`)
 *   2. `COMPANY_AI_MODEL` (where call sites already chain it)
 *   3. `COMPANY_AI_DEFAULT_MODEL` (this helper)
 *   4. Hard-coded built-in default (kept as the last-line safety net so the
 *      platform never breaks if env vars are unset).
 */

export function resolveCompanyAiDefaultModel(builtIn: string): string {
  const override = process.env.COMPANY_AI_DEFAULT_MODEL?.trim();
  return override && override.length > 0 ? override : builtIn;
}
