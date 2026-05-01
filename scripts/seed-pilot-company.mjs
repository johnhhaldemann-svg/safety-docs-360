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
  };

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
