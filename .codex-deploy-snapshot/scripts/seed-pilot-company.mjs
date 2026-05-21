/**
 * Creates or updates a full pilot company workspace in the configured Supabase project.
 *
 * Required:
 *   PILOT_SEED_CONFIRM=YES
 *   PILOT_COMPANY_NAME="Summit Ridge Constructors"
 *   PILOT_ADMIN_EMAIL="admin+summit@example.com"
 *   PILOT_ADMIN_PASSWORD="ChangeMe123!"
 *
 * Optional:
 *   PILOT_FIELD_EMAIL, PILOT_FIELD_PASSWORD, PILOT_JOBSITE_NAME, PILOT_PLAN_NAME
 *
 * CLI flags override env vars:
 *   npm run seed:pilot-company -- --yes --name "Summit Ridge" --email admin@example.com --password "ChangeMe123!"
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
  "field_supervisor",
  "foreman",
  "field_user",
  "read_only",
  "company_user",
]);

function loadEnvFile(name) {
  const full = path.join(__dirname, "..", name);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--yes") {
      args.yes = "YES";
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function envOrArg(args, envName, argName, fallback = "") {
  const argValue = args[argName];
  if (typeof argValue === "string" && argValue.trim()) return argValue.trim();
  return process.env[envName]?.trim() || fallback;
}

function looksLikePlaceholder(url, key) {
  const lowerUrl = (url ?? "").toLowerCase();
  const lowerKey = (key ?? "").toLowerCase();
  return (
    !url ||
    !key ||
    lowerUrl.includes("your_project_ref") ||
    lowerUrl.includes("placeholder") ||
    !lowerUrl.startsWith("http") ||
    lowerKey.includes("your_service_role") ||
    lowerKey.includes("your_anon_key")
  );
}

function requireEmail(label, email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${label} must be a valid email address.`);
  }
}

function requirePassword(label, password) {
  if (password.length < 8) {
    throw new Error(`${label} must be at least 8 characters.`);
  }
}

function normalizeRole(role, fallback) {
  const normalized = (role || fallback).trim().toLowerCase().replace(/\s+/g, "_");
  if (!ALLOWED_ROLES.has(normalized)) {
    throw new Error(
      `Unsupported role "${role}". Use one of: ${Array.from(ALLOWED_ROLES).join(", ")}.`
    );
  }
  return normalized;
}

function toMembershipRole(role) {
  if (role === "company_admin") return "company_admin";
  if (role === "manager" || role === "safety_manager") return role;
  return "company_user";
}

async function findAuthUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const found = data?.users?.find(
      (user) => (user.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (found) return found;
    if (!data?.users || data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(supabase, user) {
  const metadata = {
    role: user.role,
    team: user.companyName,
    company_id: user.companyId,
    account_status: "active",
    company_name: user.companyName,
    full_name: user.fullName,
  };

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: metadata,
  });

  if (!createErr && created?.user?.id) {
    return created.user.id;
  }

  const msg = createErr?.message ?? "";
  if (
    !msg.toLowerCase().includes("already") &&
    !msg.toLowerCase().includes("registered") &&
    !msg.toLowerCase().includes("exists")
  ) {
    throw new Error(createErr?.message || `Failed to create ${user.email}.`);
  }

  const existing = await findAuthUserByEmail(supabase, user.email);
  if (!existing?.id) {
    throw new Error(`User ${user.email} exists but could not be loaded by email.`);
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
    password: user.password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: metadata,
  });
  if (updateErr) throw new Error(updateErr.message);

  return existing.id;
}

async function ensureCompany(supabase, config) {
  const base = {
    name: config.companyName,
    team_key: config.teamKey,
    status: "approved",
    industry: config.industry || null,
    phone: config.phone || null,
    website: config.website || null,
    address_line_1: config.addressLine1 || null,
    city: config.city || null,
    state_region: config.stateRegion || null,
    postal_code: config.postalCode || null,
    country: config.country || null,
    primary_contact_name: config.adminName,
    primary_contact_email: config.adminEmail,
    pilot_trial_ends_at: config.pilotTrialEndsAt,
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from("companies")
    .upsert(base, { onConflict: "team_key" })
    .select("id, name, team_key")
    .single();

  if (!result.error && result.data?.id) {
    return result.data;
  }

  const message = result.error?.message ?? "";
  if (
    message.includes("companies_status_check") ||
    message.toLowerCase().includes("pilot_trial_ends_at") ||
    message.toLowerCase().includes("primary_contact")
  ) {
    const fallback = await supabase
      .from("companies")
      .upsert(
        {
          name: config.companyName,
          team_key: config.teamKey,
          status: message.includes("companies_status_check") ? "active" : "approved",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_key" }
      )
      .select("id, name, team_key")
      .single();

    if (!fallback.error && fallback.data?.id) {
      console.warn(
        "Company was created with minimal columns. Apply the latest migrations before pilot sign-off."
      );
      return fallback.data;
    }
  }

  throw new Error(result.error?.message || "Failed to create pilot company.");
}

async function ensureSubscription(supabase, companyId, config) {
  const { error } = await supabase.from("company_subscriptions").upsert(
    {
      company_id: companyId,
      status: "active",
      plan_name: config.planName,
      credit_balance: config.creditBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );

  if (error) throw new Error(error.message);
}

async function ensureMemberships(supabase, user, userId) {
  const { error: roleErr } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: user.role,
      team: user.companyName,
      company_id: user.companyId,
      account_status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (roleErr) throw new Error(roleErr.message);

  const { error: membershipErr } = await supabase.from("company_memberships").upsert(
    {
      user_id: userId,
      company_id: user.companyId,
      role: toMembershipRole(user.role),
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" }
  );
  if (membershipErr) throw new Error(membershipErr.message);

  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      full_name: user.fullName,
      preferred_name: user.fullName.split(" ")[0] || user.fullName,
      job_title: user.title,
      trade_specialty: user.trade,
      years_experience: user.yearsExperience,
      phone: user.phone,
      city: user.city,
      state_region: user.stateRegion,
      readiness_status: "ready",
      certifications: user.certifications,
      certification_expirations: {},
      specialties: user.specialties,
      equipment: [],
      bio: user.bio,
      photo_url: null,
      photo_path: null,
      profile_complete: true,
    },
    { onConflict: "user_id" }
  );
  if (profileErr) throw new Error(profileErr.message);
}

async function ensureJobsite(supabase, config, companyId, userId) {
  if (!config.jobsiteName) return null;

  const { data: existing, error: findErr } = await supabase
    .from("company_jobsites")
    .select("id, name")
    .eq("company_id", companyId)
    .ilike("name", config.jobsiteName.replace(/[%_]/g, "\\$&"))
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from("company_jobsites")
    .insert({
      company_id: companyId,
      name: config.jobsiteName,
      project_number: config.projectNumber || null,
      location: config.jobsiteLocation || null,
      status: "active",
      project_manager: config.adminName,
      safety_lead: config.adminName,
      customer_company_name: config.customerCompanyName || null,
      notes: "Seeded for pilot smoke testing.",
      created_by: userId,
      updated_by: userId,
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

const BETA_FIXTURE_IDS = {
  jsa: "00000000-0000-4000-8000-000000000101",
  activity: "00000000-0000-4000-8000-000000000102",
  correctiveAction: "00000000-0000-4000-8000-000000000103",
  permit: "00000000-0000-4000-8000-000000000104",
  incident: "00000000-0000-4000-8000-000000000105",
  trainingRequirement: "00000000-0000-4000-8000-000000000106",
  document: "00000000-0000-4000-8000-000000000107",
  report: "00000000-0000-4000-8000-000000000108",
  billingCustomer: "00000000-0000-4000-8000-000000000109",
  memoryItem: "00000000-0000-4000-8000-00000000010a",
  invite: "00000000-0000-4000-8000-00000000010b",
};

async function safeUpsert(supabase, table, values, label) {
  const { error } = await supabase.from(table).upsert(values, { onConflict: "id" });
  if (error) {
    console.warn(`  Skipped ${label}: ${error.message}`);
    return false;
  }

  console.log(`  ${label} ready.`);
  return true;
}

function addDaysIso(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function ensureBetaExitFixtures(supabase, config, company, adminUserId, fieldUserId, jobsite) {
  if (!config.betaExitFixtures) return;

  const prefix = config.betaFixturePrefix;
  const now = new Date().toISOString();
  const todayYmd = now.slice(0, 10);
  const jobsiteId = jobsite?.id ?? null;
  const fieldOrAdminUserId = fieldUserId ?? adminUserId;

  console.log("Seeding beta-exit QA fixtures...");

  await safeUpsert(
    supabase,
    "company_jsas",
    {
      id: BETA_FIXTURE_IDS.jsa,
      company_id: company.id,
      jobsite_id: jobsiteId,
      title: `${prefix} - Hot Work JSA`,
      description: "Deterministic beta-exit JSA covering hot work, fall protection, and stop-work escalation.",
      status: "active",
      severity: "high",
      category: "safety",
      owner_user_id: adminUserId,
      due_at: addDaysIso(7),
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "JSA"
  );

  await safeUpsert(
    supabase,
    "company_jsa_activities",
    {
      id: BETA_FIXTURE_IDS.activity,
      company_id: company.id,
      jsa_id: BETA_FIXTURE_IDS.jsa,
      jobsite_id: jobsiteId,
      work_date: todayYmd,
      trade: "Ironworker",
      activity_name: `${prefix} - Weld guardrail embeds`,
      area: "Level 4 deck",
      crew_size: 4,
      hazard_category: "Hot work",
      hazard_description: "Spark exposure near temporary decking and combustible packaging.",
      mitigation: "Fire watch, extinguisher staged, combustibles cleared, and permit posted.",
      permit_required: true,
      permit_type: "hot_work",
      planned_risk_level: "high",
      status: "planned",
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "JSA activity"
  );

  await safeUpsert(
    supabase,
    "company_corrective_actions",
    {
      id: BETA_FIXTURE_IDS.correctiveAction,
      company_id: company.id,
      jobsite_id: jobsiteId,
      title: `${prefix} - Stage fire watch kit`,
      description: "Beta-exit corrective action used to validate dashboard, safety intelligence, and linked workflow access.",
      severity: "medium",
      category: "fire_hot_work_concern",
      observation_type: "negative",
      sif_potential: false,
      priority: "medium",
      immediate_action_required: false,
      status: "open",
      assigned_user_id: fieldOrAdminUserId,
      due_at: addDaysIso(3),
      dap_id: BETA_FIXTURE_IDS.jsa,
      dap_activity_id: BETA_FIXTURE_IDS.activity,
      workflow_status: "needs_review",
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "corrective action"
  );

  await safeUpsert(
    supabase,
    "company_permits",
    {
      id: BETA_FIXTURE_IDS.permit,
      company_id: company.id,
      jobsite_id: jobsiteId,
      permit_type: "hot_work",
      title: `${prefix} - Hot Work Permit`,
      status: "active",
      severity: "high",
      category: "safety",
      owner_user_id: adminUserId,
      due_at: addDaysIso(1),
      sif_flag: true,
      escalation_level: "monitor",
      escalation_reason: "Beta-exit fixture validates linked JSA permit escalation.",
      stop_work_status: "normal",
      dap_activity_id: BETA_FIXTURE_IDS.activity,
      observation_id: BETA_FIXTURE_IDS.correctiveAction,
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "permit"
  );

  await safeUpsert(
    supabase,
    "company_incidents",
    {
      id: BETA_FIXTURE_IDS.incident,
      company_id: company.id,
      jobsite_id: jobsiteId,
      title: `${prefix} - Near Miss Review`,
      description: "Beta-exit near miss fixture used for safety intelligence and restricted field access checks.",
      status: "open",
      severity: "medium",
      category: "incident",
      owner_user_id: adminUserId,
      occurred_at: addDaysIso(-1),
      due_at: addDaysIso(5),
      sif_flag: false,
      escalation_level: "monitor",
      escalation_reason: "Trend review for hot work controls.",
      stop_work_status: "normal",
      observation_id: BETA_FIXTURE_IDS.correctiveAction,
      dap_activity_id: BETA_FIXTURE_IDS.activity,
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "incident"
  );

  await safeUpsert(
    supabase,
    "company_training_requirements",
    {
      id: BETA_FIXTURE_IDS.trainingRequirement,
      company_id: company.id,
      title: `${prefix} - OSHA Hot Work Orientation`,
      sort_order: 10,
      match_keywords: ["OSHA 10", "OSHA 30", "hot work"],
      match_fields: ["certifications", "specialties"],
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "training requirement"
  );

  await safeUpsert(
    supabase,
    "documents",
    {
      id: BETA_FIXTURE_IDS.document,
      user_id: adminUserId,
      company_id: company.id,
      title: `${prefix} - Safety Plan Export Fixture`,
      document_title: `${prefix} - Safety Plan Export Fixture`,
      document_type: "Safety Plan",
      status: "active",
      project_name: config.jobsiteName || company.name,
      form_data: {
        fixture: "beta_exit",
        company_id: company.id,
        jobsite_id: jobsiteId,
      },
      category: "safety_plan",
      uploaded_by: config.adminEmail,
      updated_at: now,
    },
    "document"
  );

  await safeUpsert(
    supabase,
    "company_reports",
    {
      id: BETA_FIXTURE_IDS.report,
      company_id: company.id,
      jobsite_id: jobsiteId,
      title: `${prefix} - Daily Safety Report`,
      report_type: "daily_safety",
      status: "published",
      source_module: "beta_exit",
      file_path: null,
      generated_at: now,
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "report"
  );

  await safeUpsert(
    supabase,
    "billing_customers",
    {
      id: BETA_FIXTURE_IDS.billingCustomer,
      company_id: company.id,
      company_name: company.name,
      billing_contact_name: config.adminName,
      billing_email: config.adminEmail,
      billing_address_1: config.addressLine1,
      city: config.city,
      state: config.stateRegion,
      zip: config.postalCode,
      country: config.country,
      phone: config.phone,
      updated_at: now,
    },
    "billing customer"
  );

  await safeUpsert(
    supabase,
    "company_memory_items",
    {
      id: BETA_FIXTURE_IDS.memoryItem,
      company_id: company.id,
      source: "manual",
      title: `${prefix} - Safety Intelligence Fixture`,
      body: "Beta-exit fixture: hot work requires permit verification, posted fire watch, extinguisher readiness, and supervisor signoff.",
      metadata: {
        fixture: "beta_exit",
        workflow: "safety_intelligence",
      },
      created_by: adminUserId,
      updated_at: now,
    },
    "safety intelligence memory item"
  );

  await safeUpsert(
    supabase,
    "company_invites",
    {
      id: BETA_FIXTURE_IDS.invite,
      email: config.betaInviteEmail,
      role: "field_user",
      team: company.name,
      company_id: company.id,
      account_status: "pending",
      consumed_at: null,
      consumed_by: null,
      created_by: adminUserId,
      updated_by: adminUserId,
      updated_at: now,
    },
    "pending invite"
  );
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERIVCE_ROLE_KEY?.trim();

  if (looksLikePlaceholder(url, serviceKey)) {
    throw new Error(
      "Set real NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first."
    );
  }

  const confirmed = args.yes === "YES" || process.env.PILOT_SEED_CONFIRM === "YES";
  if (!confirmed) {
    throw new Error("Refusing to write to Supabase. Re-run with --yes or PILOT_SEED_CONFIRM=YES.");
  }

  const companyName = envOrArg(args, "PILOT_COMPANY_NAME", "name");
  const adminEmail = envOrArg(args, "PILOT_ADMIN_EMAIL", "email").toLowerCase();
  const adminPassword = envOrArg(args, "PILOT_ADMIN_PASSWORD", "password");
  const adminName = envOrArg(args, "PILOT_ADMIN_NAME", "admin-name", "Pilot Admin");
  const fieldEmail = envOrArg(args, "PILOT_FIELD_EMAIL", "field-email").toLowerCase();
  const fieldPassword = envOrArg(args, "PILOT_FIELD_PASSWORD", "field-password");
  const teamKey = envOrArg(args, "PILOT_TEAM_KEY", "team-key", slugify(companyName));

  if (!companyName) throw new Error("PILOT_COMPANY_NAME or --name is required.");
  if (!teamKey) throw new Error("A non-empty team key is required.");
  requireEmail("PILOT_ADMIN_EMAIL", adminEmail);
  requirePassword("PILOT_ADMIN_PASSWORD", adminPassword);
  if (fieldEmail) {
    requireEmail("PILOT_FIELD_EMAIL", fieldEmail);
    requirePassword("PILOT_FIELD_PASSWORD", fieldPassword);
  }

  const trialDays = Number(envOrArg(args, "PILOT_TRIAL_DAYS", "trial-days", "45"));
  const config = {
    companyName,
    adminEmail,
    adminName,
    teamKey,
    industry: envOrArg(args, "PILOT_INDUSTRY", "industry", "Construction"),
    phone: envOrArg(args, "PILOT_COMPANY_PHONE", "phone", "555-555-0199"),
    website: envOrArg(args, "PILOT_COMPANY_WEBSITE", "website"),
    addressLine1: envOrArg(args, "PILOT_ADDRESS_LINE_1", "address", "100 Pilot Way"),
    city: envOrArg(args, "PILOT_CITY", "city", "Chicago"),
    stateRegion: envOrArg(args, "PILOT_STATE_REGION", "state", "IL"),
    postalCode: envOrArg(args, "PILOT_POSTAL_CODE", "postal", "60601"),
    country: envOrArg(args, "PILOT_COUNTRY", "country", "US"),
    planName: envOrArg(args, "PILOT_PLAN_NAME", "plan", "Pilot"),
    creditBalance: Number(envOrArg(args, "PILOT_CREDIT_BALANCE", "credits", "25")),
    pilotTrialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
    jobsiteName: envOrArg(args, "PILOT_JOBSITE_NAME", "jobsite", "Pilot Jobsite"),
    jobsiteLocation: envOrArg(args, "PILOT_JOBSITE_LOCATION", "jobsite-location", "Chicago, IL"),
    projectNumber: envOrArg(args, "PILOT_PROJECT_NUMBER", "project-number", "PILOT-001"),
    customerCompanyName: envOrArg(args, "PILOT_CUSTOMER_COMPANY_NAME", "customer-company"),
    betaExitFixtures: envOrArg(args, "PILOT_SEED_BETA_EXIT_FIXTURES", "beta-exit-fixtures").toUpperCase() === "YES",
    betaFixturePrefix: envOrArg(args, "PILOT_BETA_FIXTURE_PREFIX", "beta-fixture-prefix", "Beta Exit QA"),
    betaInviteEmail: envOrArg(
      args,
      "PILOT_BETA_INVITE_EMAIL",
      "beta-invite-email",
      "beta-exit-invitee@example.com"
    ).toLowerCase(),
  };
  if (config.betaExitFixtures) {
    requireEmail("PILOT_BETA_INVITE_EMAIL", config.betaInviteEmail);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const host = new URL(url).host;
  console.log(`Using Supabase project: ${host}`);

  const company = await ensureCompany(supabase, config);
  await ensureSubscription(supabase, company.id, config);

  const adminRole = normalizeRole(
    envOrArg(args, "PILOT_ADMIN_ROLE", "role", "company_admin"),
    "company_admin"
  );
  const adminUser = {
    email: adminEmail,
    password: adminPassword,
    role: adminRole,
    fullName: adminName,
    title: "Pilot Company Admin",
    trade: "General Contractor",
    yearsExperience: 12,
    phone: config.phone,
    city: config.city,
    stateRegion: config.stateRegion,
    certifications: ["OSHA 30"],
    specialties: ["Pilot onboarding", "Company setup"],
    bio: "Seeded company admin for pilot acceptance testing.",
    companyName,
    companyId: company.id,
  };
  const adminUserId = await ensureAuthUser(supabase, adminUser);
  await ensureMemberships(supabase, adminUser, adminUserId);

  let fieldUserId = null;
  if (fieldEmail) {
    const fieldUser = {
      email: fieldEmail,
      password: fieldPassword,
      role: normalizeRole(
        envOrArg(args, "PILOT_FIELD_ROLE", "field-role", "field_user"),
        "field_user"
      ),
      fullName: envOrArg(args, "PILOT_FIELD_NAME", "field-name", "Pilot Field User"),
      title: "Field User",
      trade: "General Construction",
      yearsExperience: 5,
      phone: config.phone,
      city: config.city,
      stateRegion: config.stateRegion,
      certifications: ["OSHA 10"],
      specialties: ["Field reporting", "JSA signoff"],
      bio: "Seeded field user for pilot acceptance testing.",
      companyName,
      companyId: company.id,
    };
    fieldUserId = await ensureAuthUser(supabase, fieldUser);
    await ensureMemberships(supabase, fieldUser, fieldUserId);
  }

  const jobsite = await ensureJobsite(supabase, config, company.id, adminUserId);
  await ensureBetaExitFixtures(supabase, config, company, adminUserId, fieldUserId, jobsite);

  console.log("Pilot company workspace ready.");
  console.log(`  Company: ${company.name} (${company.id})`);
  console.log(`  Team key: ${company.team_key}`);
  console.log(`  Plan: ${config.planName}`);
  console.log(`  Admin: ${adminEmail}`);
  if (fieldEmail) console.log(`  Field: ${fieldEmail} (${fieldUserId})`);
  if (jobsite?.id) console.log(`  Jobsite: ${jobsite.name} (${jobsite.id})`);
  console.log("Open /login and sign in with the seeded admin account.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
