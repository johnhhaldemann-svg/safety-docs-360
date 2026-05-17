/**
 * Deterministic beta-exit workspace seed.
 *
 * This intentionally routes through the pilot seed path so the beta QA lane
 * stays aligned with the production onboarding shape while adding broad
 * workflow fixtures.
 */

function setDefaultEnv(name, value) {
  if (!process.env[name]?.trim()) {
    process.env[name] = value;
  }
}

setDefaultEnv("PILOT_SEED_CONFIRM", "YES");
setDefaultEnv("PILOT_COMPANY_NAME", "Beta Exit QA Constructors");
setDefaultEnv("PILOT_TEAM_KEY", "beta-exit-qa");
setDefaultEnv("PILOT_ADMIN_EMAIL", process.env.BETA_EXIT_ADMIN_EMAIL || process.env.E2E_BETA_ADMIN_EMAIL || "beta-exit-admin@example.com");
setDefaultEnv("PILOT_ADMIN_PASSWORD", process.env.BETA_EXIT_ADMIN_PASSWORD || process.env.E2E_BETA_ADMIN_PASSWORD || "BetaExitAdmin2026!");
setDefaultEnv("PILOT_ADMIN_NAME", "Beta Exit Admin");
setDefaultEnv("PILOT_FIELD_EMAIL", process.env.BETA_EXIT_FIELD_EMAIL || process.env.E2E_BETA_FIELD_EMAIL || "beta-exit-field@example.com");
setDefaultEnv("PILOT_FIELD_PASSWORD", process.env.BETA_EXIT_FIELD_PASSWORD || process.env.E2E_BETA_FIELD_PASSWORD || "BetaExitField2026!");
setDefaultEnv("PILOT_FIELD_NAME", "Beta Exit Field User");
setDefaultEnv("PILOT_JOBSITE_NAME", "Beta Exit QA Jobsite");
setDefaultEnv("PILOT_JOBSITE_LOCATION", "Chicago, IL");
setDefaultEnv("PILOT_PROJECT_NUMBER", "BETA-EXIT-001");
setDefaultEnv("PILOT_CUSTOMER_COMPANY_NAME", "Beta Exit Customer");
setDefaultEnv("PILOT_PLAN_NAME", "Beta Exit QA");
setDefaultEnv("PILOT_CREDIT_BALANCE", "50");
setDefaultEnv("PILOT_SEED_BETA_EXIT_FIXTURES", "YES");
setDefaultEnv("PILOT_BETA_FIXTURE_PREFIX", "Beta Exit QA");
setDefaultEnv("PILOT_BETA_INVITE_EMAIL", process.env.BETA_EXIT_INVITE_EMAIL || "beta-exit-invitee@example.com");

await import("./seed-pilot-company.mjs");
