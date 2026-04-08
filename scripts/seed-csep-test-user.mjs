/**
 * Creates (or updates) a CSEP test company workspace user in YOUR Supabase project.
 * Uses the same credentials as the app: load .env.local (or .env) for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Copy those from Supabase Dashboard → Project Settings → API (must match Vercel if you use production).
 *
 * Optional: CSEP_TEST_EMAIL, CSEP_TEST_PASSWORD, CSEP_TEST_ROLE (default company_user = CSEP-only, no admin APIs)
 *
 * Usage: npm run seed:csep-test
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const email =
  process.env.CSEP_TEST_EMAIL?.trim() || "csep-test@example.com";
const password = process.env.CSEP_TEST_PASSWORD?.trim() || "CsepLocalTest2026!";
const companyName =
  process.env.CSEP_TEST_COMPANY_NAME?.trim() || "CSEP Local Test Company";
const teamKey =
  process.env.CSEP_TEST_TEAM_KEY?.trim() ||
  companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ||
  "csep-local-test";
const companyPlan = process.env.CSEP_TEST_PLAN_NAME?.trim() || "CSEP";
const testRole = process.env.CSEP_TEST_ROLE?.trim() || "company_user";

function looksLikePlaceholder(u, key) {
  if (!u || !key) return true;
  const lower = u.toLowerCase();
  if (
    lower.includes("your_project_ref") ||
    lower.includes("placeholder") ||
    !lower.startsWith("http")
  ) {
    return true;
  }
  const k = key.toLowerCase();
  if (k.includes("your_service_role") || k.includes("your_anon_key")) {
    return true;
  }
  return false;
}

if (!url || !serviceKey || looksLikePlaceholder(url, serviceKey)) {
  console.error(
    "Set your real Supabase project in .env.local (copy from Dashboard → Project Settings → API):"
  );
  console.error("  NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=<service_role secret>");
  process.exit(1);
}

try {
  const host = new URL(url).host;
  console.log(`Using Supabase project: ${host}`);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureCompany() {
  const { data: existing, error: findErr } = await supabase
    .from("companies")
    .select("id")
    .eq("team_key", teamKey)
    .maybeSingle();

  if (findErr) {
    throw new Error(findErr.message);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("companies")
    .insert({ name: companyName, team_key: teamKey })
    .select("id")
    .single();

  if (insErr || !created?.id) {
    throw new Error(insErr?.message || "Failed to create company.");
  }

  return created.id;
}

async function ensureCsepSubscription(companyId) {
  const { error } = await supabase.from("company_subscriptions").upsert(
    {
      company_id: companyId,
      status: "active",
      plan_name: companyPlan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function ensureAuthUser() {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createErr && created?.user?.id) {
    return created.user.id;
  }

  const msg = createErr?.message ?? "";
  if (
    !msg.toLowerCase().includes("already") &&
    !msg.toLowerCase().includes("registered")
  ) {
    throw new Error(createErr?.message || "Failed to create auth user.");
  }

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });

  if (listErr) {
    throw new Error(listErr.message);
  }

  const found = list?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
  );

  if (!found?.id) {
    throw new Error("User exists but could not be loaded by email.");
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
  });

  if (updErr) {
    throw new Error(updErr.message);
  }

  return found.id;
}

async function upsertRoleAndMembership(userId, companyId) {
  const { error: roleErr } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: testRole,
      team: companyName,
      company_id: companyId,
      account_status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (roleErr) {
    throw new Error(roleErr.message);
  }

  const { error: memErr } = await supabase.from("company_memberships").upsert(
    {
      user_id: userId,
      company_id: companyId,
      role:
        testRole === "company_admin"
          ? "company_admin"
          : testRole === "manager" || testRole === "safety_manager"
            ? testRole
            : "company_user",
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" }
  );

  if (memErr) {
    throw new Error(memErr.message);
  }

  const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: testRole,
      team: companyName,
      company_id: companyId,
      account_status: "active",
      company_name: companyName,
    },
    app_metadata: {
      role: testRole,
      team: companyName,
      company_id: companyId,
      account_status: "active",
      company_name: companyName,
    },
  });

  if (metaErr) {
    throw new Error(metaErr.message);
  }

  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      full_name: "Submit Smoke",
      preferred_name: "Submit Smoke",
      job_title: "Superintendent",
      trade_specialty: "General Contractor",
      years_experience: 10,
      phone: "555-555-0100",
      city: "Chicago",
      state_region: "IL",
      readiness_status: "ready",
      certifications: [],
      certification_expirations: {},
      specialties: ["Documentation", "Company onboarding"],
      equipment: [],
      bio: "Construction profile seeded for live smoke testing.",
      photo_url: null,
      photo_path: null,
      profile_complete: true,
    },
    { onConflict: "user_id" }
  );

  if (profileErr) {
    throw new Error(profileErr.message);
  }
}

async function main() {
  const companyId = await ensureCompany();
  await ensureCsepSubscription(companyId);
  const userId = await ensureAuthUser();
  await upsertRoleAndMembership(userId, companyId);

  console.log("CSEP test workspace ready.");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Company:  ${companyName} (${companyId})`);
  console.log(`  Plan:     ${companyPlan}`);
  console.log(`  Role:     ${testRole}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
