/**
 * Lightweight concurrent HTTP stress against public pages and anonymous API GETs.
 *
 * Requires a running server (e.g. after `npm run build` → `npm run start`).
 *
 * Env:
 *   STRESS_BASE_URL       default http://127.0.0.1:3000
 *   STRESS_CONCURRENCY    parallel clients (default 30)
 *   STRESS_DURATION_MS    how long each client runs (default 15000)
 *   STRESS_SKIP_API       set to 1 to only hit HTML routes
 */

const BASE = (process.env.STRESS_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const CONCURRENCY = Math.max(1, Number(process.env.STRESS_CONCURRENCY || 30));
const DURATION_MS = Math.max(1000, Number(process.env.STRESS_DURATION_MS || 15_000));
const SKIP_API = process.env.STRESS_SKIP_API === "1" || process.env.STRESS_SKIP_API === "true";

/** Public document routes (HTML). */
const HTML_ROUTES = [
  "/",
  "/login",
  "/marketing",
  "/terms",
  "/privacy",
  "/liability-waiver",
  "/company-signup",
];

/**
 * GET endpoints that do not require a bearer token (401/403 expected for some).
 * Only safe, read-only paths — extend cautiously.
 */
const API_GET_ROUTES = [
  "/api/legal/config",
  "/api/auth/me",
];

const TARGETS = SKIP_API
  ? HTML_ROUTES.map((path) => ({ path, accept: "text/html", kind: "html" }))
  : [
      ...HTML_ROUTES.map((path) => ({ path, accept: "text/html", kind: "html" })),
      ...API_GET_ROUTES.map((path) => ({ path, accept: "application/json", kind: "api" })),
    ];

async function clientWorker(workerId) {
  const end = Date.now() + DURATION_MS;
  let requests = 0;
  let errors = 0;
  let status5xx = 0;
  const statusHistogram = Object.create(null);

  while (Date.now() < end) {
    const t = TARGETS[Math.floor(Math.random() * TARGETS.length)];
    requests++;
    try {
      const res = await fetch(`${BASE}${t.path}`, {
        redirect: "follow",
        headers: { Accept: t.accept },
      });
      const code = res.status;
      statusHistogram[code] = (statusHistogram[code] || 0) + 1;
      if (code >= 500) status5xx++;
    } catch {
      errors++;
    }
  }

  return { workerId, requests, errors, status5xx, statusHistogram };
}

function mergeHistograms(rows) {
  const out = Object.create(null);
  for (const row of rows) {
    for (const [k, v] of Object.entries(row.statusHistogram)) {
      out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

async function main() {
  console.log(
    `[stress-platform] base=${BASE} concurrency=${CONCURRENCY} durationMs=${DURATION_MS} targets=${TARGETS.length} (api=${SKIP_API ? "off" : "on"})`
  );

  try {
    const warm = await fetch(`${BASE}/login`, { redirect: "follow" });
    if (!warm.ok && warm.status >= 500) {
      console.error(`[stress-platform] warmup failed HTTP ${warm.status}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(
      "[stress-platform] server not reachable. Start production server, e.g.:\n  npm run build && npm run start"
    );
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const t0 = Date.now();
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => clientWorker(i));
  const results = await Promise.all(workers);
  const elapsed = Date.now() - t0;

  const totalRequests = results.reduce((s, r) => s + r.requests, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  const total5xx = results.reduce((s, r) => s + r.status5xx, 0);
  const hist = mergeHistograms(results);

  const rps = ((totalRequests / elapsed) * 1000).toFixed(1);
  console.log("[stress-platform] done", {
    elapsedMs: elapsed,
    totalRequests,
    approxRps: Number(rps),
    connectionErrors: totalErrors,
    responses5xx: total5xx,
    statusHistogram: hist,
  });

  const failRate = totalRequests > 0 ? (totalErrors + total5xx) / totalRequests : 1;
  if (failRate > 0.05) {
    console.error(`[stress-platform] FAIL: error+5xx rate ${(failRate * 100).toFixed(2)}% (threshold 5%)`);
    process.exit(1);
  }
  console.log("[stress-platform] OK (within threshold)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
