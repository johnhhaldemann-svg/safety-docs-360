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

function countFrom(value) {
  if (Array.isArray(value)) return value.length;
  const n = numberOrNull(value);
  return n == null ? null : n;
}

function normalizeEvalResults(metrics) {
  const source = metrics?.evalResults && typeof metrics.evalResults === "object" ? metrics.evalResults : null;
  if (!source) return null;
  return {
    totalFixtures: numberOrNull(source.totalFixtures),
    executedFixtures: numberOrNull(source.executedFixtures ?? source.executedFixtureCount),
    passedFixtures: numberOrNull(source.passedFixtures ?? source.passedFixtureCount),
    failedFixtures: numberOrNull(source.failedFixtures ?? source.failedFixtureCount),
    skippedFixtures: numberOrNull(source.skippedFixtures ?? source.skippedFixtureCount),
    registeredAdapters: countFrom(source.registeredAdapters ?? source.registeredAdapterCount),
    unregisteredFixtures: countFrom(source.unregisteredFixtures ?? source.unregisteredFixtureCount),
    adapterSurfacesWithoutFixtures: countFrom(source.adapterSurfacesWithoutFixtures),
    telemetryAvailable: typeof source.telemetryAvailable === "boolean" ? source.telemetryAvailable : null,
  };
}

function regressionFromBaseline(currentValue, baselineValue) {
  const current = numberOrNull(currentValue);
  const baseline = numberOrNull(baselineValue);
  if (current == null || baseline == null || baseline <= 0) return null;
  return Number(((current - baseline) / baseline).toFixed(4));
}

export function evaluateAiReleaseGate(input) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) };
  const activeSurfaces = input.activeSurfaces?.length ? input.activeSurfaces : DEFAULT_ACTIVE_SURFACES;
  const coverage = input.coverage ?? new Map();
  const metrics = input.metrics ?? {};
  const failures = [];
  const evalResults = normalizeEvalResults(metrics);

  if (!evalResults) {
    failures.push("eval execution results are missing; fixture files alone do not prove release readiness");
  } else {
    if (evalResults.totalFixtures == null || evalResults.totalFixtures < 1) {
      failures.push(`eval total fixture count ${evalResults.totalFixtures ?? "missing"} must be at least 1`);
    }
    if (evalResults.executedFixtures == null || evalResults.executedFixtures < 1) {
      failures.push(`eval executed fixture count ${evalResults.executedFixtures ?? "missing"} must be at least 1`);
    }
    if (evalResults.passedFixtures == null || evalResults.failedFixtures == null || evalResults.skippedFixtures == null) {
      failures.push("eval pass/fail/skipped counts must be present in the release artifact");
    }
    if ((evalResults.failedFixtures ?? 0) > 0) {
      failures.push(`eval failed fixture count ${evalResults.failedFixtures} must be 0`);
    }
    if ((evalResults.unregisteredFixtures ?? 0) > 0) {
      failures.push(`eval fixtures without registered adapters: ${evalResults.unregisteredFixtures}`);
    }
    if (evalResults.telemetryAvailable === false || evalResults.telemetryAvailable == null) {
      failures.push(`telemetry availability ${evalResults.telemetryAvailable ?? "missing"} must be true`);
    }
  }

  const executedPassRate =
    evalResults?.executedFixtures && evalResults.executedFixtures > 0 && evalResults.passedFixtures != null
      ? evalResults.passedFixtures / evalResults.executedFixtures
      : null;
  const criticalEvalPassRate = executedPassRate ?? numberOrNull(metrics.criticalEvalPassRate);
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

  const tokenCostRegression =
    numberOrNull(metrics.tokenCostRegression) ??
    regressionFromBaseline(metrics.current?.totalTokens ?? metrics.currentTotalTokens, metrics.baseline?.totalTokens ?? metrics.baselineTotalTokens);
  if (tokenCostRegression == null || tokenCostRegression > thresholds.tokenCostRegression) {
    failures.push(`token cost regression ${tokenCostRegression ?? "missing"} is above ${thresholds.tokenCostRegression}`);
  }

  const p95LatencyRegression =
    numberOrNull(metrics.p95LatencyRegression) ??
    regressionFromBaseline(metrics.current?.p95LatencyMs ?? metrics.currentP95LatencyMs, metrics.baseline?.p95LatencyMs ?? metrics.baselineP95LatencyMs);
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
    artifact: {
      evalResults,
      runtime: {
        criticalEvalPassRate,
        failureRate,
        fallbackRate,
        tokenCostRegression,
        p95LatencyRegression,
        telemetryAvailable: evalResults?.telemetryAvailable ?? null,
      },
    },
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
