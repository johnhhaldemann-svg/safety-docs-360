/**
 * Production health-warning remediation utility.
 *
 * Default mode is dry-run. Apply mode requires both:
 *   PRODUCTION_HEALTH_REMEDIATION_APPROVED=YES
 *   node scripts/remediate-production-health-warnings.mjs --apply --confirm PRODUCTION_HEALTH_REMEDIATION
 *
 * The script never reads, prints, or writes OPENAI_API_KEY. It only reports that
 * the owner must set it through Vercel Production environment variables.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_SIZE = 1000;
const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const APPLY_CONFIRMATION = "PRODUCTION_HEALTH_REMEDIATION";
const APPROVAL_ENV = "PRODUCTION_HEALTH_REMEDIATION_APPROVED";

const ALLOWED_USER_ROLES = new Set([
  "platform_admin",
  "sales_demo",
  "marketing",
  "internal_reviewer",
  "employee",
  "super_admin",
  "admin",
  "manager",
  "company_admin",
  "safety_manager",
  "project_manager",
  "field_supervisor",
  "foreman",
  "field_user",
  "read_only",
  "company_user",
  "editor",
  "viewer",
]);

const ROLE_PRIORITY = new Map([
  ["platform_admin", 120],
  ["super_admin", 110],
  ["admin", 100],
  ["company_admin", 90],
  ["safety_manager", 80],
  ["manager", 75],
  ["project_manager", 70],
  ["field_supervisor", 60],
  ["foreman", 55],
  ["field_user", 40],
  ["company_user", 35],
  ["read_only", 20],
  ["viewer", 10],
]);

export const BASELINE_TRAINING_REQUIREMENTS = [
  { code: "baseline_orientation", title: "Site Safety Orientation", matchKeywords: ["orientation", "site orientation", "new hire orientation", "safety orientation"], matchText: ["orientation", "site orientation", "safety orientation"] },
  { code: "baseline_hazard_communication", title: "Hazard Communication / SDS", matchKeywords: ["hazard communication", "hazcom", "sds", "chemical safety"], matchText: ["hazard communication", "hazcom", "sds"] },
  { code: "baseline_fall_protection", title: "Fall Protection", matchKeywords: ["fall protection", "working at heights", "fall arrest"], matchText: ["fall protection", "working at heights", "fall arrest"] },
  { code: "baseline_hot_work", title: "Hot Work", matchKeywords: ["hot work", "welding", "cutting", "grinding", "fire watch"], matchText: ["hot work", "welding", "fire watch"] },
  { code: "baseline_confined_space", title: "Confined Space", matchKeywords: ["confined space", "permit-required confined space", "prcs"], matchText: ["confined space", "permit-required confined space", "prcs"] },
  { code: "baseline_lockout_tagout", title: "Lockout / Tagout", matchKeywords: ["lockout", "tagout", "loto", "energy isolation"], matchText: ["lockout", "tagout", "loto", "energy isolation"] },
  { code: "baseline_equipment_operator_qualification", title: "Equipment Operator Qualification", matchKeywords: ["equipment operator", "operator qualification", "forklift", "aerial lift", "heavy equipment"], matchText: ["equipment operator", "operator qualification", "forklift", "aerial lift"] },
  { code: "baseline_first_aid_cpr", title: "First Aid / CPR", matchKeywords: ["first aid", "cpr", "aed", "medical response"], matchText: ["first aid", "cpr", "aed"] },
  { code: "baseline_emergency_action_plan", title: "Emergency Action Plan", matchKeywords: ["emergency action plan", "evacuation", "emergency response"], matchText: ["emergency action plan", "evacuation", "emergency response"] },
  { code: "baseline_osha_general_safety", title: "OSHA / General Construction Safety Awareness", matchKeywords: ["osha 10", "osha 30", "general safety", "construction safety"], matchText: ["osha 10", "osha 30", "general safety", "construction safety"] },
];

function loadEnvFile(name) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { dryRun: true, companyIds: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
      continue;
    }
    if (arg === "--confirm") {
      args.confirm = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--company-id") {
      args.companyIds.push(argv[i + 1] ?? "");
      i += 1;
    }
  }
  args.companyIds = args.companyIds.filter(Boolean);
  return args;
}

export function slugify(value, fallback = "requirement") {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 56);
  return slug || fallback;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function compactObject(value) {
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item == null) continue;
    if (Array.isArray(item) && item.length === 0) continue;
    if (typeof item === "string" && !item.trim()) continue;
    out[key] = item;
  }
  return out;
}

export function codeForCompanyTrainingRequirement(row) {
  const idPart = String(row?.id ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase();
  const titlePart = slugify(row?.title, "training");
  return `company_req_${idPart || titlePart}_${titlePart}`.slice(0, 96);
}

function rowMatchesBaseline(row, baseline) {
  const searchable = normalizeSearchText([
    row?.requirement_code,
    row?.title,
    ...cleanArray(row?.match_keywords),
    ...cleanArray(row?.matchKeywords),
  ].join(" "));
  return baseline.matchText.some((phrase) => searchable.includes(normalizeSearchText(phrase)));
}

function buildCompanyRequirementRow(row) {
  return {
    company_id: row.company_id,
    title: String(row.title ?? "Training Requirement").trim() || "Training Requirement",
    requirement_code: codeForCompanyTrainingRequirement(row),
    trade_codes: cleanArray(row.apply_trades),
    task_codes: cleanArray(row.apply_task_codes),
    position_codes: cleanArray(row.apply_positions),
    match_keywords: cleanArray(row.match_keywords),
    active: true,
    metadata: compactObject({
      source: "company_training_requirements",
      source_id: row.id ?? null,
      category: row.category ?? null,
      description: row.description ?? null,
      renewal_months: row.renewal_months ?? null,
      renewal_period_days: row.renewal_period_days ?? null,
      required_because: cleanArray(row.required_because),
      remediation: "production_health_warning_remediation_v1",
    }),
  };
}

function buildBaselineRequirementRow(companyId, baseline) {
  return {
    company_id: companyId,
    title: baseline.title,
    requirement_code: baseline.code,
    trade_codes: [],
    task_codes: [],
    position_codes: [],
    match_keywords: baseline.matchKeywords,
    active: true,
    metadata: {
      source: "baseline_safety_training_set",
      remediation: "production_health_warning_remediation_v1",
      owner_review_required: true,
      note: "Baseline row added only when no company-specific or existing matrix row appeared to cover this topic.",
    },
  };
}

export function planTrainingMatrixRows({ companies, companyTrainingRequirements, existingMatrixRows }) {
  const existingByCompany = new Map();
  for (const row of existingMatrixRows ?? []) {
    if (!row?.company_id) continue;
    const rows = existingByCompany.get(row.company_id) ?? [];
    rows.push(row);
    existingByCompany.set(row.company_id, rows);
  }

  const requirementsByCompany = new Map();
  for (const row of companyTrainingRequirements ?? []) {
    if (!row?.company_id || row.active === false) continue;
    const rows = requirementsByCompany.get(row.company_id) ?? [];
    rows.push(row);
    requirementsByCompany.set(row.company_id, rows);
  }

  const planned = [];
  for (const company of companies ?? []) {
    if (!company?.id) continue;
    const existing = existingByCompany.get(company.id) ?? [];
    const existingCodes = new Set(existing.map((row) => row.requirement_code).filter(Boolean));
    const companySpecificPlanned = [];

    for (const requirement of requirementsByCompany.get(company.id) ?? []) {
      const row = buildCompanyRequirementRow(requirement);
      if (!existingCodes.has(row.requirement_code)) {
        companySpecificPlanned.push(row);
        existingCodes.add(row.requirement_code);
      }
    }

    planned.push(...companySpecificPlanned);
    const coverageRows = [...existing, ...companySpecificPlanned];
    for (const baseline of BASELINE_TRAINING_REQUIREMENTS) {
      if (existingCodes.has(baseline.code)) continue;
      if (coverageRows.some((row) => rowMatchesBaseline(row, baseline))) continue;
      planned.push(buildBaselineRequirementRow(company.id, baseline));
      existingCodes.add(baseline.code);
    }
  }

  return planned;
}

function normalizeRole(role) {
  return ALLOWED_USER_ROLES.has(role) ? role : "company_user";
}

function rolePriority(role) {
  return ROLE_PRIORITY.get(role) ?? 0;
}

export function planRoleBackfillRows({ memberships, existingRoles, companies }) {
  const existingUserIds = new Set((existingRoles ?? []).map((row) => row?.user_id).filter(Boolean));
  const companyName = new Map((companies ?? []).map((row) => [row.id, row.name || row.team_key || "General"]));
  const candidates = new Map();

  for (const membership of memberships ?? []) {
    if (!membership?.user_id || !membership.company_id || membership.status !== "active") continue;
    if (existingUserIds.has(membership.user_id)) continue;

    const role = normalizeRole(membership.role);
    const row = {
      user_id: membership.user_id,
      role,
      team: companyName.get(membership.company_id) ?? "General",
      company_id: membership.company_id,
      account_status: "active",
      created_by: membership.created_by ?? null,
      updated_by: membership.updated_by ?? null,
    };
    const current = candidates.get(membership.user_id);
    if (!current || rolePriority(role) > rolePriority(current.role)) candidates.set(membership.user_id, row);
  }

  return Array.from(candidates.values());
}

function nameFromAuthUser(user) {
  const metadata = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const name = metadata.full_name || metadata.name || metadata.display_name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 160) : null;
}

export function planProfileBackfillRows({ authUsers, existingProfiles, targetUserIds }) {
  const existingUserIds = new Set((existingProfiles ?? []).map((row) => row?.user_id).filter(Boolean));
  const targets = new Set(targetUserIds ?? []);
  const rows = [];

  for (const user of authUsers ?? []) {
    if (!user?.id || existingUserIds.has(user.id) || !targets.has(user.id)) continue;
    const fullName = nameFromAuthUser(user);
    rows.push({
      user_id: user.id,
      full_name: fullName,
      preferred_name: fullName ? fullName.split(/\s+/)[0] : null,
      job_title: null,
      trade_specialty: null,
      readiness_status: "ready",
      certifications: [],
      certification_expirations: {},
      specialties: [],
      equipment: [],
      profile_complete: false,
    });
  }

  return rows;
}

async function loadAll(client, table, select, configure) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (configure) query = configure(query);
    const result = await query;
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    rows.push(...(result.data ?? []));
    if ((result.data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadAuthUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (result.error) throw new Error(`auth.users: ${result.error.message}`);
    users.push(...(result.data?.users ?? []));
    if ((result.data?.users ?? []).length < PAGE_SIZE) break;
  }
  return users;
}

function chunk(rows, size = 250) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function insertRows(client, table, rows) {
  let inserted = 0;
  for (const batch of chunk(rows)) {
    if (batch.length === 0) continue;
    const result = await client.from(table).insert(batch);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    inserted += batch.length;
  }
  return inserted;
}

function auditEvent(action, summary) {
  return {
    tenant_id: PLATFORM_TENANT_ID,
    company_id: null,
    jobsite_id: null,
    actor_user_id: null,
    module: "superadmin",
    object_type: "production_health_remediation",
    object_id: "production_health_warning_remediation_v1",
    action,
    severity: action.includes("failed") ? "high" : "medium",
    event_status: action.includes("failed") ? "failed" : "recorded",
    metadata: summary,
  };
}

async function tryRecordAudit(client, action, summary) {
  const result = await client.from("event_log").insert(auditEvent(action, summary));
  if (result.error) console.warn(`Audit event not recorded: ${result.error.message}`);
}

function summarizePlan({ companies, memberships, roleRows, profileRows, matrixRows, openAiPresent }) {
  const companiesWithActiveMembership = new Set(
    memberships.filter((row) => row.status === "active" && row.company_id).map((row) => row.company_id)
  );
  const companiesNeedingOwnerReview = companies
    .filter((company) => !companiesWithActiveMembership.has(company.id))
    .map((company) => ({ id: company.id, name: company.name ?? null }));

  return {
    mode: "production_health_warning_remediation_v1",
    openai: {
      localEnvPresent: openAiPresent,
      requiredOwnerAction: "Set OPENAI_API_KEY through Vercel Production environment variables and redeploy after Super Admin approval.",
    },
    records: {
      companiesChecked: companies.length,
      activeMembershipsChecked: memberships.filter((row) => row.status === "active").length,
      plannedUserRoleRows: roleRows.length,
      plannedUserProfileRows: profileRows.length,
      plannedTrainingMatrixRows: matrixRows.length,
      companiesNeedingOwnerReview: companiesNeedingOwnerReview.length,
    },
    companiesNeedingOwnerReview,
  };
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));
  if (args.apply && (args.confirm !== APPLY_CONFIRMATION || process.env[APPROVAL_ENV] !== "YES")) {
    console.error(`Apply blocked. Required: ${APPROVAL_ENV}=YES and --confirm ${APPLY_CONFIRMATION}.`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase URL or service role key. No data was changed.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const companyFilter = (query) => (args.companyIds.length > 0 ? query.in("id", args.companyIds) : query);
  const companies = await loadAll(admin, "companies", "id, name, team_key, status", companyFilter);
  const companyIds = new Set(companies.map((row) => row.id));
  const companyScoped = (query) => (args.companyIds.length > 0 ? query.in("company_id", Array.from(companyIds)) : query);

  const [memberships, existingRoles, existingProfiles, trainingRequirements, existingMatrix, authUsers] = await Promise.all([
    loadAll(admin, "company_memberships", "user_id, company_id, role, status, created_by, updated_by", companyScoped),
    loadAll(admin, "user_roles", "user_id, role, company_id, account_status"),
    loadAll(admin, "user_profiles", "user_id"),
    loadAll(admin, "company_training_requirements", "id, company_id, title, category, description, renewal_months, renewal_period_days, match_keywords, apply_trades, apply_positions, apply_task_codes, required_because, active", companyScoped),
    loadAll(admin, "company_training_matrix_requirements", "company_id, title, requirement_code, match_keywords, active", companyScoped),
    loadAuthUsers(admin),
  ]);

  const roleRows = planRoleBackfillRows({ memberships, existingRoles, companies });
  const targetUserIds = new Set([
    ...memberships.filter((row) => row.status === "active").map((row) => row.user_id),
    ...existingRoles.map((row) => row.user_id),
    ...roleRows.map((row) => row.user_id),
  ].filter(Boolean));
  const profileRows = planProfileBackfillRows({ authUsers, existingProfiles, targetUserIds });
  const matrixRows = planTrainingMatrixRows({ companies, companyTrainingRequirements: trainingRequirements, existingMatrixRows: existingMatrix });
  const summary = summarizePlan({ companies, memberships, roleRows, profileRows, matrixRows, openAiPresent: Boolean(process.env.OPENAI_API_KEY?.trim()) });

  if (args.dryRun) {
    console.log(JSON.stringify({ dryRun: true, wouldInsert: summary.records, auditPreview: auditEvent("dry_run", summary) }, null, 2));
    return;
  }

  await tryRecordAudit(admin, "apply_started", summary);
  try {
    const inserted = {
      user_roles: await insertRows(admin, "user_roles", roleRows),
      user_profiles: await insertRows(admin, "user_profiles", profileRows),
      company_training_matrix_requirements: await insertRows(admin, "company_training_matrix_requirements", matrixRows),
    };
    const appliedSummary = { ...summary, inserted };
    await tryRecordAudit(admin, "apply_completed", appliedSummary);
    console.log(JSON.stringify({ dryRun: false, inserted, summary: appliedSummary.records }, null, 2));
  } catch (error) {
    await tryRecordAudit(admin, "apply_failed", { ...summary, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
