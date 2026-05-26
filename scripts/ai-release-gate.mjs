#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_THRESHOLDS = {
  criticalEvalPassRate: 0.95,
  failureRate: 0.02,
  fallbackRate: 0.05,
  tokenCostRegression: 0.15,
  p95LatencyRegression: 0.2,
};

export const DEFAULT_ACTIVE_SURFACES = [
  "injury-weather.insights",
  "injury-weather.sparse-web-research",
  "jobsite.site-visual.generate",
  "training-records.photo-extract",
  "field-audits.ai-review",
  "superadmin.ai-engine.recommendations",
  "gus.verified-learning",
];

function readJsonFile(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function fixtureCoverage(rootDir) {
  const coverage = new Map();
  if (!existsSync(rootDir)) return coverage;
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(rootDir, entry.name);
    const count = readdirSync(dir).filter((file) => file.endsWith(".json")).length;
    coverage.set(entry.name, count);
  }
  return coverage;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function evaluateAiReleaseGate(input) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) };
  const activeSurfaces = input.activeSurfaces?.length ? input.activeSurfaces : DEFAULT_ACTIVE_SURFACES;
  const coverage = input.coverage ?? new Map();
  const metrics = input.metrics ?? {};
  const failures = [];

  const criticalEvalPassRate = numberOrNull(metrics.criticalEvalPassRate);
  if (criticalEvalPassRate == null || criticalEvalPassRate < thresholds.criticalEvalPassRate) {
    failures.push(
      `critical eval pass rate ${criticalEvalPassRate ?? "missing"} is below ${thresholds.criticalEvalPassRate}`
    );
  }

  const failureRate = numberOrNull(metrics.failureRate);
  if (failureRate == null || failureRate > thresholds.failureRate) {
    failures.push(`failure rate ${failureRate ?? "missing"} is above ${thresholds.failureRate}`);
  }

  const fallbackRate = numberOrNull(metrics.fallbackRate);
  if (fallbackRate == null || fallbackRate > thresholds.fallbackRate) {
    failures.push(`fallback rate ${fallbackRate ?? "missing"} is above ${thresholds.fallbackRate}`);
  }

  const tokenCostRegression = numberOrNull(metrics.tokenCostRegression);
  if (tokenCostRegression == null || tokenCostRegression > thresholds.tokenCostRegression) {
    failures.push(`token cost regression ${tokenCostRegression ?? "missing"} is above ${thresholds.tokenCostRegression}`);
  }

  const p95LatencyRegression = numberOrNull(metrics.p95LatencyRegression);
  if (p95LatencyRegression == null || p95LatencyRegression > thresholds.p95LatencyRegression) {
    failures.push(`p95 latency regression ${p95LatencyRegression ?? "missing"} is above ${thresholds.p95LatencyRegression}`);
  }

  const missingCoverage = activeSurfaces.filter((surface) => (coverage.get(surface) ?? 0) < 1);
  if (missingCoverage.length > 0) {
    failures.push(`active surfaces missing golden coverage: ${missingCoverage.join(", ")}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    activeSurfaces,
    thresholds,
  };
}

function parseArgs(argv) {
  const args = { metricsPath: null, fixtureRoot: null, activeSurfaces: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--metrics") args.metricsPath = argv[++i] ?? null;
    else if (arg === "--fixtures") args.fixtureRoot = argv[++i] ?? null;
    else if (arg === "--active-surfaces") args.activeSurfaces = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.fixtureRoot ?? join(process.cwd(), "tests", "ai", "golden"));
  const metrics =
    readJsonFile(args.metricsPath ? resolve(args.metricsPath) : "") ??
    (process.env.AI_RELEASE_GATE_METRICS_JSON ? JSON.parse(process.env.AI_RELEASE_GATE_METRICS_JSON) : null);

  const result = evaluateAiReleaseGate({
    metrics,
    coverage: fixtureCoverage(root),
    activeSurfaces: args.activeSurfaces,
  });

  if (!result.ok) {
    console.error("AI release gate failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("AI release gate passed.");
}
