/**
 * Tears down the TEST_ mock company workspace created by seed-test-company.mjs.
 *
 * Deletes (in safe order to respect FK constraints):
 *  - company_memberships, user_roles, company_jobsite_assignments
 *  - company_subscriptions, company_signup_requests
 *  - company_jobsites
 *  - companies (by team_key)
 *  - auth users (by email)
 *
 * Usage:
 *   E2E_SEED_CONFIRM=yes node scripts/teardown-test-company.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(name) {
  const full = path.join(__dirname, "..", name);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const ADMIN_EMAIL = process.env.E2E_COMPANY_ADMIN_EMAIL?.trim() ?? "test-admin-e2e@safety360.test";
const FIELD_EMAIL = process.env.E2E_FIELD_USER_EMAIL?.trim() ?? "test-field-e2e@safety360.test";
const TEAM_KEY = "test-e2e-mock-co";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[teardown] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (process.env.E2E_SEED_CONFIRM !== "yes") {
  console.error("[teardown] Safety guard: set E2E_SEED_CONFIRM=yes to confirm teardown.");
  console.error(`[teardown] Target: ${SUPABASE_URL}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(msg) {
  console.log(`[teardown] ${msg}`);
}

async function findAuthUser(email) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function deleteAuthUser(email) {
  const user = await findAuthUser(email);
  if (!user) {
    log(`  Auth user not found: ${email} (skipping)`);
    return;
  }
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    log(`  ! Failed to delete auth user ${email}: ${error.message}`);
  } else {
    log(`  ✓ Deleted auth user: ${email}`);
  }
}

async function main() {
  console.log("═".repeat(60));
  console.log(" SafetyDocs360 — TEST Company Teardown");
  console.log(`  TeamKey:  ${TEAM_KEY}`);
  console.log(`  Admin:    ${ADMIN_EMAIL}`);
  console.log(`  Field:    ${FIELD_EMAIL}`);
  console.log("═".repeat(60));

  // Find the company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("team_key", TEAM_KEY)
    .maybeSingle();

  if (!company?.id) {
    log(`Company with team_key=${TEAM_KEY} not found. Nothing to tear down.`);
    return;
  }

  log(`Found company: ${company.name} (${company.id})`);

  // Delete child records
  const tables = [
    "company_jobsite_assignments",
    "company_jobsite_audits",
    "company_jobsite_schedule_items",
    "company_jobsite_daily_todos",
    "company_jobsite_chemicals",
    "company_jsa_activities",
    "company_jsa_signoffs",
    "company_jsas",
    "company_incidents",
    "company_permits",
    "company_documents",
    "company_generated_documents",
    "company_observations",
    "company_corrective_actions",
    "company_hazards",
    "company_controls",
    "company_employee_profiles",
    "company_employee_jobsite_assignments",
    "company_employee_training_records",
    "company_training_requirements",
    "company_induction_programs",
    "company_contractors",
    "company_memberships",
    "user_roles",
    "company_subscriptions",
    "company_jobsites",
    "company_onboarding_imports",
  ];

  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("company_id", company.id);

    if (error) {
      log(`  ! ${table}: ${error.message}`);
    } else {
      log(`  ✓ Deleted from ${table} (${count ?? "?"} rows)`);
    }
  }

  // Delete signup requests
  const { error: signupErr } = await supabase
    .from("company_signup_requests")
    .delete()
    .in("primary_contact_email", [ADMIN_EMAIL.toLowerCase(), FIELD_EMAIL.toLowerCase()]);

  if (signupErr) {
    log(`  ! company_signup_requests: ${signupErr.message}`);
  } else {
    log("  ✓ Deleted company_signup_requests");
  }

  // Delete the company record
  const { error: companyErr } = await supabase
    .from("companies")
    .delete()
    .eq("id", company.id);

  if (companyErr) {
    log(`  ! companies: ${companyErr.message}`);
  } else {
    log("  ✓ Deleted company record");
  }

  // Delete auth users
  log("Deleting auth users…");
  await deleteAuthUser(ADMIN_EMAIL);
  await deleteAuthUser(FIELD_EMAIL);

  // Clean up user_profiles and user_agreements (keyed by user_id, not company_id)
  log("Cleaning up orphaned user records (user_profiles, user_agreements, user_roles)…");
  for (const email of [ADMIN_EMAIL, FIELD_EMAIL]) {
    const user = await findAuthUser(email).catch(() => null);
    if (!user) continue;
    await supabase.from("user_profiles").delete().eq("user_id", user.id).catch(() => undefined);
    await supabase.from("user_agreements").delete().eq("user_id", user.id).catch(() => undefined);
    await supabase.from("user_roles").delete().eq("user_id", user.id).catch(() => undefined);
  }

  console.log("");
  console.log("═".repeat(60));
  log("Teardown complete. All TEST_ data removed.");
  console.log("═".repeat(60));
}

main().catch((e) => {
  console.error("[teardown] FATAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
