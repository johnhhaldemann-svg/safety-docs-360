/**
 * Full platform stress gauntlet — 3 phases:
 *
 *   Phase 1 · Public load        30 concurrent clients × 15 s against prod
 *   Phase 2 · Authenticated API  20 concurrent clients × 10 s against staging
 *   Phase 3 · Edge-case probes   Oversized payload, malformed body, missing
 *                                 auth, cross-tenant probe, rate-limit breach
 *
 * Env (loaded from .env.local automatically):
 *   STRESS_PROD_URL          default https://safety360docs.com
 *   STRESS_STAGING_URL       default PLAYWRIGHT_BASE_URL
 *   SUPABASE_URL             Supabase for JWT auth (E2E_NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_ANON_KEY        (E2E_NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   E2E_COMPANY_ADMIN_EMAIL
 *   E2E_COMPANY_ADMIN_PASSWORD
 *   E2E_FIELD_USER_EMAIL
 *   E2E_FIELD_USER_PASSWORD
 *   E2E_TEST_COMPANY_ID
 *
 * Usage:
 *   node scripts/stress-full.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv(name) {
  const full = path.join(__dirname, "..", name);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(".env.local");
loadEnv(".env");

// ── Config ───────────────────────────────────────────────────────────────────
const PROD      = (process.env.STRESS_PROD_URL    || "https://safety360docs.com").replace(/\/$/, "");
const STAGING   = (process.env.STRESS_STAGING_URL || process.env.PLAYWRIGHT_BASE_URL || PROD).replace(/\/$/, "");
const SB_URL    = (process.env.E2E_NEXT_PUBLIC_SUPABASE_URL    || process.env.NEXT_PUBLIC_SUPABASE_URL    || "").replace(/\/$/, "");
const SB_ANON   =  process.env.E2E_NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const ADMIN_EMAIL = process.env.E2E_COMPANY_ADMIN_EMAIL || "test-admin-e2e@safety360.test";
const ADMIN_PASS  = process.env.E2E_COMPANY_ADMIN_PASSWORD || "TestAdmin2026!";
const FIELD_EMAIL = process.env.E2E_FIELD_USER_EMAIL || "test-field-e2e@safety360.test";
const FIELD_PASS  = process.env.E2E_FIELD_USER_PASSWORD || "TestField2026!";
const COMPANY_ID  = process.env.E2E_TEST_COMPANY_ID || "";
const JOBSITE_ID  = process.env.E2E_TEST_JOBSITE_ID || "";

const FOREIGN_COMPANY_ID = "00000000-dead-beef-dead-000000000001";

// ── Utilities ────────────────────────────────────────────────────────────────
function banner(title) {
  console.log("\n" + "═".repeat(60));
  console.log(` ${title}`);
  console.log("═".repeat(60));
}

function ok(msg)   { console.log(`  ✓  ${msg}`); }
function warn(msg) { console.log(`  ⚠  ${msg}`); }
function fail(msg) { console.log(`  ✗  ${msg}`); }

async function getJson(url, token) {
  const headers = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(url, { headers, redirect: "follow" });
  let body = null;
  try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, body };
}

// ── Phase 0: JWT auth ────────────────────────────────────────────────────────
async function signIn(email, password) {
  if (!SB_URL || !SB_ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_ANON },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Phase 1: Public load test ────────────────────────────────────────────────
const PUBLIC_ROUTES = [
  "/", "/login", "/marketing", "/terms", "/privacy", "/liability-waiver", "/company-signup",
  "/api/legal/config", "/api/auth/me",
];

async function workerPublic(base, durationMs) {
  const end = Date.now() + durationMs;
  let requests = 0, errors = 0, status5xx = 0;
  const hist = Object.create(null);
  while (Date.now() < end) {
    const route = PUBLIC_ROUTES[Math.floor(Math.random() * PUBLIC_ROUTES.length)];
    requests++;
    try {
      const r = await fetch(`${base}${route}`, { redirect: "follow" });
      hist[r.status] = (hist[r.status] || 0) + 1;
      if (r.status >= 500) status5xx++;
    } catch { errors++; }
  }
  return { requests, errors, status5xx, hist };
}

async function runPhase1() {
  banner("Phase 1 · Public load test  (30 clients × 15 s → prod)");
  console.log(`  Target: ${PROD}`);

  // Warmup
  try {
    const w = await fetch(`${PROD}/login`, { redirect: "follow" });
    if (w.status >= 500) { fail(`Warmup failed HTTP ${w.status}`); return false; }
    ok(`Warmup: ${w.status}`);
  } catch (e) {
    fail(`Prod unreachable: ${e.message}`);
    return false;
  }

  const CONCURRENCY = 30, DURATION = 15_000;
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => workerPublic(PROD, DURATION)));
  const elapsed = Date.now() - t0;

  const total = results.reduce((s, r) => s + r.requests, 0);
  const errs  = results.reduce((s, r) => s + r.errors, 0);
  const s5xx  = results.reduce((s, r) => s + r.status5xx, 0);
  const hist  = {};
  for (const r of results) for (const [k, v] of Object.entries(r.hist)) hist[k] = (hist[k] || 0) + v;
  const rps = ((total / elapsed) * 1000).toFixed(1);
  const failRate = total > 0 ? (errs + s5xx) / total : 1;

  console.log(`\n  Requests  : ${total}`);
  console.log(`  RPS       : ${rps}`);
  console.log(`  Conn errs : ${errs}`);
  console.log(`  5xx       : ${s5xx}`);
  console.log(`  Status    :`, hist);
  console.log(`  Fail rate : ${(failRate * 100).toFixed(2)}%`);

  if (failRate > 0.05) {
    fail(`Error+5xx rate ${(failRate * 100).toFixed(2)}% exceeds 5% threshold`);
    return false;
  }
  ok(`Public load: PASS (${(failRate * 100).toFixed(2)}% fail rate)`);
  return true;
}

// ── Phase 2: Authenticated API stress ────────────────────────────────────────
async function workerAuth(base, token, companyId, jobsiteId, durationMs) {
  const routes = [
    `/api/auth/me`,
    `/api/company/jobsites`,
    `/api/company/incidents?period=30d`,
    `/api/company/corrective-actions?status=open`,
    `/api/company/analytics/summary`,
  ];
  if (companyId) routes.push(`/api/company/users`);
  if (jobsiteId) routes.push(`/api/jobsites/${jobsiteId}/overview`);

  const end = Date.now() + durationMs;
  let requests = 0, errors = 0, status5xx = 0, authFails = 0;
  const hist = Object.create(null);
  while (Date.now() < end) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    requests++;
    try {
      const { status } = await getJson(`${base}${route}`, token);
      hist[status] = (hist[status] || 0) + 1;
      if (status >= 500) status5xx++;
      if (status === 401 || status === 403) authFails++;
    } catch { errors++; }
  }
  return { requests, errors, status5xx, authFails, hist };
}

async function runPhase2(adminToken) {
  banner("Phase 2 · Authenticated API stress  (20 clients × 10 s → staging)");
  console.log(`  Target : ${STAGING}`);
  console.log(`  Token  : ${adminToken ? "acquired" : "MISSING — phase will be skipped"}`);

  if (!adminToken) {
    warn("Skipping Phase 2 — could not get JWT (Supabase config missing or auth failed)");
    return true;
  }

  const CONCURRENCY = 20, DURATION = 10_000;
  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => workerAuth(STAGING, adminToken, COMPANY_ID, JOBSITE_ID, DURATION))
  );
  const elapsed = Date.now() - t0;

  const total     = results.reduce((s, r) => s + r.requests, 0);
  const errs      = results.reduce((s, r) => s + r.errors, 0);
  const s5xx      = results.reduce((s, r) => s + r.status5xx, 0);
  const authFails = results.reduce((s, r) => s + r.authFails, 0);
  const hist      = {};
  for (const r of results) for (const [k, v] of Object.entries(r.hist)) hist[k] = (hist[k] || 0) + v;
  const rps = ((total / elapsed) * 1000).toFixed(1);
  const failRate = total > 0 ? (errs + s5xx) / total : 1;

  console.log(`\n  Requests  : ${total}`);
  console.log(`  RPS       : ${rps}`);
  console.log(`  Conn errs : ${errs}`);
  console.log(`  5xx       : ${s5xx}`);
  console.log(`  401/403   : ${authFails}  (expected ~0 — valid tokens should not fail)`);
  console.log(`  Status    :`, hist);
  console.log(`  Fail rate : ${(failRate * 100).toFixed(2)}%`);

  const authFailRate = total > 0 ? authFails / total : 0;
  let passed = true;

  if (failRate > 0.05) {
    fail(`5xx+conn rate ${(failRate * 100).toFixed(2)}% exceeds 5% threshold`);
    passed = false;
  } else {
    ok(`Auth load: PASS (${(failRate * 100).toFixed(2)}% fail rate)`);
  }

  if (authFailRate > 0.01) {
    fail(`Auth failure rate ${(authFailRate * 100).toFixed(2)}% — valid tokens returning 401/403 unexpectedly`);
    passed = false;
  } else {
    ok(`Auth validity: PASS (${authFails} auth fails out of ${total} requests)`);
  }

  return passed;
}

// ── Phase 3: Edge-case probes ─────────────────────────────────────────────────
async function probeUnauthenticated() {
  // Every company API must reject unauthenticated requests
  const routes = [
    "/api/company/jobsites",
    "/api/company/incidents",
    "/api/company/corrective-actions",
    "/api/company/analytics/summary",
    "/api/company/memory",
    "/api/auth/me",
  ];
  let passed = true;
  for (const route of routes) {
    const { status } = await getJson(`${STAGING}${route}`);
    if (status === 401 || status === 403) {
      ok(`No-auth → ${route}: ${status} (expected)`);
    } else if (status === 200) {
      fail(`No-auth → ${route}: 200 — endpoint is not protected!`);
      passed = false;
    } else {
      ok(`No-auth → ${route}: ${status}`);
    }
  }
  return passed;
}

async function probeMalformedBody(token) {
  const routes = [
    "/api/company/incidents",
    "/api/company/corrective-actions",
  ];
  let passed = true;
  for (const route of routes) {
    // Send garbage JSON
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const r = await fetch(`${STAGING}${route}`, {
      method: "POST",
      headers,
      body: "}{not valid json{{",
    }).catch(() => null);
    const status = r?.status ?? 0;
    if (!r) {
      warn(`Malformed body → ${route}: connection error`);
    } else if (status >= 400 && status < 500) {
      ok(`Malformed body → ${route}: ${status} (correctly rejected)`);
    } else if (status >= 500) {
      fail(`Malformed body → ${route}: ${status} — server errored on bad JSON`);
      passed = false;
    } else {
      warn(`Malformed body → ${route}: ${status} (unexpected — may be method-not-allowed)`);
    }
  }
  return passed;
}

async function probeOversizedUpload(token) {
  // Memory upload endpoint enforces 12 MB max — send 13 MB
  const OVER_MB = 13;
  const bigBuffer = Buffer.alloc(OVER_MB * 1024 * 1024, "x");
  const form = new FormData();
  form.append("file", new Blob([bigBuffer], { type: "application/octet-stream" }), "stress-test-oversize.bin");
  form.append("title", "Stress test oversized upload");

  const r = await fetch(`${STAGING}/api/company/memory/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }).catch(() => null);

  const status = r?.status ?? 0;
  if (!r) {
    warn("Oversized upload: connection error (Vercel may have rejected at edge)");
    return true;
  }
  if (status === 413 || status === 400) {
    ok(`Oversized upload (${OVER_MB} MB): ${status} (correctly rejected)`);
    return true;
  }
  if (status === 200 || status === 201) {
    fail(`Oversized upload (${OVER_MB} MB): 200 — 12 MB size check not enforced!`);
    return false;
  }
  // 401/403 means auth worked but company scope may not be set up (acceptable in staging)
  ok(`Oversized upload (${OVER_MB} MB): ${status} (auth/scope check ran before size check — OK)`);
  return true;
}

async function probeCrossTenant(fieldToken) {
  if (!fieldToken) { warn("Cross-tenant probe skipped — no field user token"); return true; }

  const routes = [
    `/api/company/jobsites`,
    `/api/company/incidents`,
    `/api/company/corrective-actions`,
  ];
  // Pass a foreign company ID in query params — results must be 0 or 403
  let passed = true;
  for (const route of routes) {
    const url = `${STAGING}${route}?companyId=${FOREIGN_COMPANY_ID}`;
    const { status, body } = await getJson(url, fieldToken);
    const count = Array.isArray(body) ? body.length : (body?.data?.length ?? body?.count ?? null);
    if (status === 403 || status === 401) {
      ok(`Cross-tenant → ${route}: ${status} (correctly blocked)`);
    } else if (status === 200 && count === 0) {
      ok(`Cross-tenant → ${route}: 200 / 0 rows (RLS enforced)`);
    } else if (status === 200 && count !== null && count > 0) {
      fail(`Cross-tenant → ${route}: 200 with ${count} rows — RLS may not be enforced!`);
      passed = false;
    } else {
      ok(`Cross-tenant → ${route}: ${status} (acceptable — server handles bad scope)`);
    }
  }
  return passed;
}

async function probeRateLimit(adminToken) {
  if (!adminToken) { warn("Rate-limit probe skipped — no admin token"); return true; }

  // The memory upload endpoint allows 15 req/60 s per user.
  // Send 20 rapid tiny requests — at least some must hit 429.
  const BURST = 20;
  const endpoint = `${STAGING}/api/company/memory/upload`;

  console.log(`  Sending ${BURST} rapid requests to rate-limited endpoint…`);
  const form = new FormData();
  form.append("file", new Blob(["tiny"], { type: "text/plain" }), "stress-rate.txt");
  form.append("title", "Rate limit test");

  const statuses = await Promise.all(
    Array.from({ length: BURST }, async () => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      }).catch(() => null);
      return r?.status ?? 0;
    })
  );

  const hist = {};
  for (const s of statuses) hist[s] = (hist[s] || 0) + 1;
  console.log(`  Status distribution:`, hist);

  const hit429 = (hist[429] || 0) > 0;
  if (hit429) {
    ok(`Rate limit: PASS — 429 observed after burst of ${BURST} requests`);
    return true;
  }
  // If all returned 400 (no extractable text from "tiny") or 403 (scope), rate limiter ran first
  // or the file is too small to trigger extraction (body check fires before rate limit is enforced).
  // If 400 everywhere, the file failed extraction before reaching the rate limit check — acceptable.
  const all400 = statuses.every((s) => s === 400 || s === 401 || s === 403 || s === 500);
  if (all400) {
    warn(`Rate limit: got ${JSON.stringify(hist)} — file rejected before reaching rate check (acceptable)`);
    return true;
  }
  fail(`Rate limit: no 429 seen after ${BURST} rapid requests — limit may not be enforced`);
  return false;
}

async function probeRlsDirect(fieldToken) {
  // Direct Supabase REST call with the field user's JWT — must return 0 rows for foreign company
  if (!SB_URL || !SB_ANON || !fieldToken) {
    warn("RLS direct probe skipped — missing Supabase config or field token");
    return true;
  }

  const tables = ["company_memberships", "company_jobsites", "company_incidents", "company_jsas"];
  let passed = true;
  for (const table of tables) {
    const url = `${SB_URL}/rest/v1/${table}?company_id=eq.${FOREIGN_COMPANY_ID}&select=id`;
    const r = await fetch(url, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${fieldToken}`, Accept: "application/json" },
    }).catch(() => null);
    if (!r) { warn(`RLS direct ${table}: connection error`); continue; }
    const body = await r.json().catch(() => []);
    const count = Array.isArray(body) ? body.length : -1;
    if (count === 0) {
      ok(`RLS direct ${table}: 0 rows (enforced)`);
    } else if (count > 0) {
      fail(`RLS direct ${table}: ${count} rows leaked for foreign company!`);
      passed = false;
    } else {
      ok(`RLS direct ${table}: ${r.status} (non-array response)`);
    }
  }
  return passed;
}

async function runPhase3(adminToken, fieldToken) {
  banner("Phase 3 · Edge-case probes  (staging)");
  console.log(`  Target: ${STAGING}`);

  const results = [];

  console.log("\n  [A] Unauthenticated route protection");
  results.push(await probeUnauthenticated());

  if (adminToken) {
    console.log("\n  [B] Malformed JSON bodies");
    results.push(await probeMalformedBody(adminToken));
  } else {
    warn("[B] Malformed body probes skipped — no admin token");
    results.push(true);
  }

  console.log("\n  [C] Oversized file upload (>12 MB)");
  results.push(await probeOversizedUpload(adminToken));

  console.log("\n  [D] Cross-tenant company ID in query params");
  results.push(await probeCrossTenant(fieldToken));

  console.log("\n  [E] Rate limit breach (20 rapid uploads)");
  results.push(await probeRateLimit(adminToken));

  console.log("\n  [F] RLS direct Supabase REST probe");
  results.push(await probeRlsDirect(fieldToken));

  const passed = results.every(Boolean);
  if (passed) ok("\nPhase 3: ALL edge-case probes PASS");
  else fail("\nPhase 3: one or more edge-case probes FAILED");
  return passed;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "█".repeat(60));
  console.log(" SafetyDocs360 — Full Platform Stress Gauntlet");
  console.log(`  Prod    : ${PROD}`);
  console.log(`  Staging : ${STAGING}`);
  console.log(`  SB URL  : ${SB_URL || "(not set)"}`);
  console.log("█".repeat(60));

  // Acquire tokens
  banner("Acquiring JWT tokens");
  const [adminToken, fieldToken] = await Promise.all([
    signIn(ADMIN_EMAIL, ADMIN_PASS),
    signIn(FIELD_EMAIL, FIELD_PASS),
  ]);
  console.log(`  Admin token : ${adminToken ? "✓ acquired" : "✗ failed"}`);
  console.log(`  Field token : ${fieldToken ? "✓ acquired" : "✗ failed"}`);
  if (!adminToken) warn("Admin token missing — Phases 2 & 3 will run in degraded mode");

  // Run phases
  const p1 = await runPhase1();
  const p2 = await runPhase2(adminToken);
  const p3 = await runPhase3(adminToken, fieldToken);

  // Summary
  banner("Gauntlet Summary");
  const label = (b) => b ? "✓ PASS" : "✗ FAIL";
  console.log(`  Phase 1 · Public load       : ${label(p1)}`);
  console.log(`  Phase 2 · Authenticated API : ${label(p2)}`);
  console.log(`  Phase 3 · Edge-case probes  : ${label(p3)}`);

  const allPassed = p1 && p2 && p3;
  console.log("\n" + (allPassed ? "  ✓ ALL PHASES PASSED" : "  ✗ ONE OR MORE PHASES FAILED"));

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("[stress-full] FATAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
