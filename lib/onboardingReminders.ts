import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendOnboardingReminderEmail } from "@/lib/inviteEmail";
import { serverLog } from "@/lib/serverLog";

/**
 * Daily nudge for company owners who started but haven't finished workspace setup.
 *
 * Safe by design:
 *  - Disabled unless ONBOARDING_REMINDERS_ENABLED === "true" (ships dormant).
 *  - Only emails on day 3 and day 7 after signup, so a daily cron sends at most twice
 *    per company (each company crosses a given "N days old" boundary on one run).
 *  - Only emails companies that are clearly still incomplete (missing profile, team, or docs).
 */

const REMINDER_AGE_DAYS = new Set([3, 7]);

type CompanyRow = {
  id: string;
  name: string | null;
  primary_contact_email: string | null;
  status: string | null;
  industry: string | null;
  phone: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  country: string | null;
  created_at: string | null;
};

type MembershipRow = { company_id: string | null; status: string | null };
type DocumentRow = { company_id: string | null; status: string | null; final_file_path: string | null };

function ageInDays(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return Math.floor((Date.now() - created) / 86_400_000);
}

function profileComplete(company: CompanyRow): boolean {
  return [
    company.industry,
    company.phone,
    company.address_line_1,
    company.city,
    company.state_region,
    company.country,
  ].every((value) => Boolean((value ?? "").trim()));
}

export async function runOnboardingReminders() {
  if (process.env.ONBOARDING_REMINDERS_ENABLED !== "true") {
    return { ok: true as const, enabled: false, candidates: 0, sent: 0, failed: 0 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false as const, error: "Supabase admin client is unavailable." };
  }

  const [companiesRes, membershipsRes, documentsRes] = await Promise.all([
    admin
      .from("companies")
      .select(
        "id, name, primary_contact_email, status, industry, phone, address_line_1, city, state_region, country, created_at"
      ),
    admin.from("company_memberships").select("company_id, status"),
    admin.from("documents").select("company_id, status, final_file_path"),
  ]);

  if (companiesRes.error) {
    return { ok: false as const, error: companiesRes.error.message || "Failed to load companies." };
  }

  const companies = (companiesRes.data as CompanyRow[] | null) ?? [];
  const memberships = (membershipsRes.data as MembershipRow[] | null) ?? [];
  const documents = (documentsRes.data as DocumentRow[] | null) ?? [];

  let candidates = 0;
  let sent = 0;
  let failed = 0;

  for (const company of companies) {
    const status = (company.status ?? "").trim().toLowerCase();
    if (status === "archived" || status === "suspended") continue;

    const age = ageInDays(company.created_at);
    if (age == null || !REMINDER_AGE_DAYS.has(age)) continue;

    const email = (company.primary_contact_email ?? "").trim();
    if (!email) continue;

    const hasTeam =
      memberships.filter((row) => row.company_id === company.id && (row.status ?? "") !== "suspended")
        .length > 1;
    const hasDocs = documents.some(
      (row) =>
        row.company_id === company.id &&
        ((row.status ?? "").trim().toLowerCase() === "approved" || Boolean(row.final_file_path))
    );

    // Fully set up on the three server-checkable steps → no nudge needed.
    if (profileComplete(company) && hasTeam && hasDocs) continue;

    candidates += 1;
    const result = await sendOnboardingReminderEmail({
      toEmail: email,
      companyName: company.name?.trim() || "your workspace",
    }).catch(() => ({ sent: false }));
    if (result.sent) sent += 1;
    else failed += 1;
  }

  serverLog("info", "onboarding_reminders_completed", { candidates, sent, failed });
  return { ok: true as const, enabled: true, candidates, sent, failed };
}
