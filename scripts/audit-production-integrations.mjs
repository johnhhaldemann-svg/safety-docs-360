import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "outputs");

function loadEnvFile(name) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function maskSensitiveValue(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.password) url.password = "***";
      if (url.username) url.username = `${url.username.split(".")[0]}...`;
      return url.toString();
    } catch {
      return "postgresql://***";
    }
  }
  if (trimmed.length <= 10) return "***";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function inferSupabaseRef() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  try {
    const host = new URL(value).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function listLocalMigrations() {
  const migrationsDir = path.join(root, "supabase", "migrations");
  try {
    return fs
      .readdirSync(migrationsDir)
      .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
      .map((name) => {
        const [version] = name.split("_", 1);
        return { version, name };
      })
      .sort((a, b) => a.version.localeCompare(b.version));
  } catch {
    return [];
  }
}

function detectDuplicateCronPaths(crons) {
  const byPath = new Map();
  for (const cron of Array.isArray(crons) ? crons : []) {
    if (!cron || typeof cron.path !== "string") continue;
    const schedules = byPath.get(cron.path) ?? [];
    schedules.push(typeof cron.schedule === "string" ? cron.schedule : "(missing schedule)");
    byPath.set(cron.path, schedules);
  }
  return [...byPath.entries()]
    .filter(([, schedules]) => schedules.length > 1)
    .map(([cronPath, schedules]) => ({ path: cronPath, schedules }));
}

function supabaseCliPath() {
  const win = process.platform === "win32";
  const exe = path.join(root, "node_modules", "supabase", "bin", win ? "supabase.exe" : "supabase");
  if (fs.existsSync(exe)) return exe;
  return win ? "npx.cmd" : "npx";
}

function runSupabaseMigrationList(dbUrl) {
  if (!dbUrl) {
    return { versions: [], error: "DATABASE_URL is missing." };
  }

  const cli = supabaseCliPath();
  const cliArgs = cli.endsWith("supabase") || cli.endsWith("supabase.exe")
    ? ["migration", "list", "--output", "json", "--db-url", dbUrl]
    : ["supabase", "migration", "list", "--output", "json", "--db-url", dbUrl];
  const result = spawnSync(cli, cliArgs, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: 60_000,
  });

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    const fallback = runSupabaseMigrationQuery(dbUrl);
    if (fallback.versions.length > 0) return fallback;
    return {
      versions: [],
      error: output.replaceAll(dbUrl, maskSensitiveValue(dbUrl) ?? "postgresql://***"),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const versions = new Set();
    const visit = (value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, val] of Object.entries(value)) {
          if (/version|id/i.test(key) && /^\d{14}$/.test(String(val ?? ""))) {
            versions.add(String(val));
          }
          visit(val);
        }
      }
    };
    visit(parsed);
    if (versions.size > 0) return { versions: [...versions].sort(), error: null };
    return runSupabaseMigrationQuery(dbUrl);
  } catch {
    const versions = [...new Set((output.match(/\d{14}/g) ?? []))].sort();
    return versions.length > 0 ? { versions, error: null } : runSupabaseMigrationQuery(dbUrl);
  }
}

function runSupabaseMigrationQuery(dbUrl) {
  if (!dbUrl) {
    return { versions: [], error: "DATABASE_URL is missing." };
  }

  const cli = supabaseCliPath();
  const query = "select version from supabase_migrations.schema_migrations order by version desc limit 20";
  const cliArgs = cli.endsWith("supabase") || cli.endsWith("supabase.exe")
    ? ["db", "query", query, "--db-url", dbUrl, "--output", "json"]
    : ["supabase", "db", "query", query, "--db-url", dbUrl, "--output", "json"];
  const result = spawnSync(cli, cliArgs, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: 60_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    return {
      versions: [],
      error: output.replaceAll(dbUrl, maskSensitiveValue(dbUrl) ?? "postgresql://***"),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const versions = rows
      .map((row) => String(row?.version ?? ""))
      .filter((version) => /^\d{14}$/.test(version))
      .sort();
    return { versions, error: null };
  } catch {
    const versions = [...new Set((output.match(/\d{14}/g) ?? []))].sort();
    return versions.length > 0
      ? { versions, error: null }
      : { versions: [], error: `Could not parse db query output: ${output}` };
  }
}

function statusLine(status, text) {
  return `- **${status}:** ${text}`;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const generatedAt = new Date().toISOString();
const packageJson = readJson("package.json");
const vercelProject = readJson(".vercel/project.json");
const vercelJson = readJson("vercel.json");
const migrations = listLocalMigrations();
const latestLocal = migrations.at(-1) ?? null;
const dbUrl = process.env.SUPABASE_MIGRATION_CHECK_DB_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;
const remote = runSupabaseMigrationList(dbUrl);
const latestRemote = remote.versions.at(-1) ?? null;
const duplicateCrons = detectDuplicateCronPaths(vercelJson?.crons);

const report = [];
report.push("# Production Integration Audit Map");
report.push("");
report.push(`Generated: ${generatedAt}`);
report.push("");
report.push("## Project");
report.push("");
report.push(`- Supabase ref: ${inferSupabaseRef() ?? "unknown"}`);
report.push(`- Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "present" : "missing"}`);
report.push(`- Database URL: ${maskSensitiveValue(dbUrl) ?? "missing"}`);
report.push(`- Vercel project: ${vercelProject?.projectName ?? "unknown"}`);
report.push(`- Vercel project id: ${vercelProject?.projectId ?? "missing"}`);
report.push(`- Vercel org id: ${vercelProject?.orgId ?? "missing"}`);
report.push("");
report.push("## Findings");
report.push("");
report.push(statusLine(
  packageJson?.engines?.node === "20.x" ? "healthy" : "warning",
  `package.json engines.node is ${packageJson?.engines?.node ?? "missing"}.`
));
report.push(statusLine(
  !vercelProject?.settings?.nodeVersion || vercelProject.settings.nodeVersion === "20.x" ? "healthy" : "warning",
  `.vercel project nodeVersion is ${vercelProject?.settings?.nodeVersion ?? "missing"}.`
));
report.push(statusLine(
  latestLocal && latestRemote && latestLocal.version === latestRemote ? "healthy" : latestRemote ? "critical" : "unknown",
  `latest local migration is ${latestLocal?.version ?? "missing"}; latest remote migration is ${latestRemote ?? "unknown"}.`
));
if (remote.error) {
  report.push(statusLine("unknown", `Supabase CLI migration probe: ${remote.error}`));
}
report.push(statusLine(
  duplicateCrons.length > 0 ? "warning" : "healthy",
  duplicateCrons.length > 0
    ? `duplicate cron path(s): ${duplicateCrons.map((item) => `${item.path} (${item.schedules.join(", ")})`).join("; ")}`
    : `${Array.isArray(vercelJson?.crons) ? vercelJson.crons.length : 0} cron job(s) declared with no duplicate paths.`
));
report.push(statusLine(
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "healthy" : "critical",
  `SUPABASE_SERVICE_ROLE_KEY is ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing"}.`
));
report.push(statusLine(
  process.env.OPENAI_API_KEY ? "healthy" : "warning",
  `OPENAI_API_KEY is ${process.env.OPENAI_API_KEY ? "present" : "missing"}.`
));
report.push(statusLine(
  "warning",
  "Known Supabase advisor findings need triage: SECURITY DEFINER exposure, vector in public, missing FK indexes, and duplicate permissive policies."
));
report.push(statusLine(
  "warning",
  "Live Vercel connector access was previously observed as 403 Forbidden; repair connector/CLI access before relying on live deployment evidence."
));
report.push("");
report.push("## Next Actions");
report.push("");
report.push("- Align Vercel project Node.js runtime with package.json Node 20.x.");
report.push("- Confirm whether duplicate cron paths are intentional.");
report.push("- Re-run Supabase security and performance advisors and prioritize SECURITY DEFINER/RLS findings.");
report.push("- Repair Vercel connector/CLI access and capture latest deployment/log/env parity evidence.");
report.push("- Use the in-app Superadmin System Health Integration Map for route/table/storage/Auth checks.");
report.push("");

fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `production-integration-audit-${generatedAt.replace(/[:.]/g, "-")}.md`);
fs.writeFileSync(outputPath, report.join("\n"), "utf8");

console.log(`Production integration audit written to ${outputPath}`);
