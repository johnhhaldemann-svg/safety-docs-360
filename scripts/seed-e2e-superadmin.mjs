/**
 * Creates or updates a QA-only superadmin account for credentialed E2E route checks.
 *
 * Required:
 *   E2E_SUPERADMIN_SEED_CONFIRM=YES
 *
 * Optional:
 *   E2E_SUPERADMIN_EMAIL, E2E_SUPERADMIN_PASSWORD, E2E_SUPERADMIN_NAME
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
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      args[key] = value;
      i += 1;
    }
  }
  return args;
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

async function ensureAuthUser(supabase, config) {
  const metadata = {
    role: "super_admin",
    team: "E2E QA",
    account_status: "active",
    full_name: config.fullName,
  };

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: metadata,
  });

  if (!createErr && created?.user?.id) return created.user.id;

  const msg = createErr?.message ?? "";
  if (
    !msg.toLowerCase().includes("already") &&
    !msg.toLowerCase().includes("registered") &&
    !msg.toLowerCase().includes("exists")
  ) {
    throw new Error(createErr?.message || `Failed to create ${config.email}.`);
  }

  const existing = await findAuthUserByEmail(supabase, config.email);
  if (!existing?.id) {
    throw new Error(`User ${config.email} exists but could not be loaded by email.`);
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
    password: config.password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: metadata,
  });
  if (updateErr) throw new Error(updateErr.message);

  return existing.id;
}

async function ensureSuperadminRole(supabase, config, userId) {
  const now = new Date().toISOString();

  const { error: roleErr } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: "super_admin",
      team: "E2E QA",
      company_id: null,
      account_status: "active",
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (roleErr) throw new Error(roleErr.message);

  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      full_name: config.fullName,
      preferred_name: config.fullName.split(" ")[0] || config.fullName,
      job_title: "E2E Superadmin",
      trade_specialty: "Platform QA",
      years_experience: 10,
      phone: "555-555-0101",
      city: "Chicago",
      state_region: "IL",
      readiness_status: "ready",
      certifications: [],
      certification_expirations: {},
      specialties: ["Platform administration", "Route verification"],
      equipment: [],
      bio: "QA-only superadmin account seeded for credentialed E2E route checks.",
      photo_url: null,
      photo_path: null,
      profile_complete: true,
    },
    { onConflict: "user_id" }
  );
  if (profileErr) throw new Error(profileErr.message);
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));
  const confirmed = args.yes === "YES" || process.env.E2E_SUPERADMIN_SEED_CONFIRM === "YES";
  if (!confirmed) {
    throw new Error(
      "Refusing to write to Supabase. Re-run with --yes or E2E_SUPERADMIN_SEED_CONFIRM=YES."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (looksLikePlaceholder(url, serviceKey)) {
    throw new Error(
      "Set real NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first."
    );
  }

  const config = {
    email: envOrArg(args, "E2E_SUPERADMIN_EMAIL", "email", "e2e-superadmin@example.com").toLowerCase(),
    password: envOrArg(args, "E2E_SUPERADMIN_PASSWORD", "password", "E2eSuperAdmin2026!"),
    fullName: envOrArg(args, "E2E_SUPERADMIN_NAME", "name", "E2E Superadmin"),
  };

  requireEmail("E2E_SUPERADMIN_EMAIL", config.email);
  requirePassword("E2E_SUPERADMIN_PASSWORD", config.password);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const host = new URL(url).host;
  console.log(`Using Supabase project: ${host}`);

  const userId = await ensureAuthUser(supabase, config);
  await ensureSuperadminRole(supabase, config, userId);

  console.log("E2E superadmin account ready.");
  console.log(`  Email: ${config.email}`);
  console.log(`  Role:  super_admin`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
