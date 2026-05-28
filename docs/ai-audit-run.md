# AI Audit Run

Audit timestamp: 2026-05-26T13:26:45-05:00
Mode: live golden eval using `OPENAI_API_KEY` from `.env.local`
Scope: existing AI eval harness, release-gate readiness, and Safety AI Engine guardrail signals.

## Executive Summary

The live AI audit did not pass. The eval harness completed with 22 tests: 6 passed, 10 failed, and 6 skipped. The failures show three concrete issues:

- `gus.verified-learning` has six golden fixtures but no registered eval adapter, so coverage exists on disk but cannot run.
- Several OpenAI-backed surfaces fell into fallback paths because the provider returned HTTP 400 or 429 responses.
- Some fallback outputs violate the audit assertions, including explicit fallback markers and missing safety-critical structured fields.

The release gate also failed because no runtime metrics were supplied for pass rate, failure rate, fallback rate, token-cost regression, or p95 latency regression. That is expected for the current local command, but it means the AI release gate is not yet wired to real telemetry.

No app code, schema, or runtime behavior was changed.

## Follow-up - 2026-05-28

The `gus.verified-learning` gap from this audit is fixed in the local harness:

- Registered a deterministic `gus.verified-learning` adapter in `tests/ai/golden/surfaces.ts`.
- Converted the six Gus fixtures to the standard `input` / `assertions` schema.
- Allowed deterministic Gus fixtures to run without `OPENAI_API_KEY` while OpenAI-backed fixtures still skip locally when no key is present.
- `npm run test:ai-eval` now passes locally with 8 passed and 14 skipped when no OpenAI key is provided.

This does not close the full AI release gate. Live OpenAI-backed evals and real runtime metrics are still required before paid pilot launch.

## Commands Run

```powershell
$keyLine = Get-Content -Path '.env.local' | Where-Object { $_ -match '^OPENAI_API_KEY=' } | Select-Object -First 1
$env:OPENAI_API_KEY = $keyLine.Substring($keyLine.IndexOf('=') + 1).Trim()
& 'C:\Program Files\nodejs\npm.cmd' run test:ai-eval
```

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run ai:release-gate
```

The key was loaded into process environment only and was not printed.

## Fixture Coverage

| Surface | Fixture count | Audit status |
| --- | ---: | --- |
| `field-audits.ai-review` | 1 | Passed |
| `gc-program.review` | 3 | Failed |
| `gus.verified-learning` | 6 | Skipped; adapter missing |
| `injury-weather.insights` | 1 | Passed |
| `injury-weather.sparse-web-research` | 1 | Failed |
| `jobsite.site-visual.generate` | 1 | Passed |
| `responses-api.json` | 2 | Failed |
| `risk-memory.llm-recommendations` | 3 | 1 passed, 2 failed |
| `superadmin.ai-engine.recommendations` | 1 | Passed |
| `training-records.photo-extract` | 1 | Failed |

Harness summary:
- Test files: 1 failed
- Tests: 10 failed, 6 passed, 6 skipped
- Duration: 28.70 seconds

## Failed Eval Details

| Surface / fixture | Failure signal | Safety impact |
| --- | --- | --- |
| Harness adapter registration | `gus.verified-learning` fixtures are not registered in `tests/ai/golden/surfaces.ts`. | Verified-learning safety claims are not being audited despite having six fixtures for prompt injection, unsupported OSHA claims, stale knowledge, and source priority. |
| `gc-program.review / fall-protection-thin` | OpenAI call returned HTTP 400 and `generateGcProgramAiReview` threw `OpenAI request failed: http_error`. | GC program review cannot produce safety recommendations under this provider failure mode. |
| `gc-program.review / hot-work-with-site-reference` | OpenAI call returned HTTP 400 and threw `OpenAI request failed: http_error`. | Hot-work review path lacks a successful audited response for citation-aware site reference handling. |
| `gc-program.review / insufficient-context-empty` | OpenAI call returned HTTP 400 and threw `OpenAI request failed: http_error`. | Missing-context conservatism is not verified because the surface fails before producing the expected safe empty/limited review. |
| `injury-weather.sparse-web-research / osha-public-guidance-citations` | Provider returned HTTP 429; output was `null`; missing `bullets`, `citations`, `disclaimer`, and required evidence terms. | Citation-bearing risk guidance fails closed to null, leaving no explainable user-facing safety guidance. |
| `responses-api.json / hazard-summary-json-shape` | Provider returned HTTP 429; fallback output included forbidden term `fallback-control`. | Fallback leaks internal placeholder language into safety control output. |
| `responses-api.json / training-topics-two` | Provider returned HTTP 429; fallback output included forbidden term `fallback-topic`. | Fallback leaks placeholder training content instead of practical safety topics. |
| `risk-memory.llm-recommendations / confined-space-mid-band-rollup` | Provider returned HTTP 429; `drafts[]` empty and required `confined` content missing. | Confined-space risk recommendations fail to produce actionable controls under provider rate limit. |
| `risk-memory.llm-recommendations / high-band-roofing-rollup` | Provider returned HTTP 429; `drafts[]` empty. | High-risk roofing recommendation path does not meet the expectation for non-empty draft actions. |
| `training-records.photo-extract / osha-card-visible-text` | Provider returned HTTP 429; `parsed` was null; missing title, provider, dates, evidence, and confidence. | Training record extraction cannot verify worker qualification evidence under provider rate limit. |

## Release Gate Result

`npm run ai:release-gate` failed because runtime metrics were missing:

- `criticalEvalPassRate` missing; threshold is at least `0.95`.
- `failureRate` missing; threshold is at most `0.02`.
- `fallbackRate` missing; threshold is at most `0.05`.
- `tokenCostRegression` missing; threshold is at most `0.15`.
- `p95LatencyRegression` missing; threshold is at most `0.2`.

Coverage check itself has fixture directories for all default active surfaces, including `gus.verified-learning`. The gap is that release-gate coverage does not currently verify adapter registration or actual fixture execution.

## Safety AI Engine Guardrail Findings

- High and critical risk escalation is partly covered by fixtures, but provider failures currently prevent some surfaces from reaching the assertions that would verify stop-work or immediate-review language.
- Missing-data conservatism is not fully proven. The `gc-program.review / insufficient-context-empty` fixture fails on provider HTTP 400 rather than returning a conservative, explainable limited review.
- Explainability and source grounding are fragile under provider failure. The injury-weather citation fixture returned `null`, so it did not provide citations, disclaimers, or evidence-backed bullets.
- Fallback behavior needs cleanup. Placeholder terms such as `fallback-control` and `fallback-topic` should never surface in user-facing safety outputs.
- Verified-learning safeguards are not active in the eval harness until `gus.verified-learning` is registered in the adapter map.

## Recommended Next Fixes

Fix now:
- Register a `gus.verified-learning` adapter in `tests/ai/golden/surfaces.ts` or move those fixtures out of active coverage until the adapter exists.
- Investigate the HTTP 400 responses for `gc-program.review`; likely causes include request shape/model compatibility or Responses API schema settings.
- Replace placeholder fallback outputs with conservative, user-safe fallback responses that explicitly mention missing AI output and require human review where safety risk is non-trivial.

Fix next:
- Add a metrics artifact for local and CI release gate runs, or teach the release gate to read summarized eval results from the harness.
- Add adapter-registration and executed-fixture counts to the release gate so fixture directories alone cannot create false confidence.
- Add rate-limit-aware retry/backoff or fixture throttling for live eval runs to reduce HTTP 429 failures.

Monitor:
- Keep live AI eval non-blocking until pass/fail and telemetry are stable.
- Track fallback rate and provider status codes by surface in the superadmin AI Engine metrics.
- Re-run this audit after the Supabase hardening work, because broad data grants and service-role usage can affect AI context retrieval and audit logging.

## Acceptance Criteria Status

| Criterion | Status |
| --- | --- |
| `npm run test:ai-eval` completes and results are captured | Completed; command exited failed with captured results. |
| Report lists every fixture surface | Completed. |
| Failing fixtures include reproducible details | Completed. |
| `npm run ai:release-gate` result reported accurately | Completed. |
| No secrets printed or written | Completed. |
