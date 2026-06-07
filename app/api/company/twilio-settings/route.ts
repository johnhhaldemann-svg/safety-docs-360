import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

// GET /api/company/twilio-settings — returns current settings (auth_token masked)
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const { data } = await auth.supabase
    .from("company_twilio_settings")
    .select("id, phone_number, account_sid, enabled, created_at, updated_at")
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  return NextResponse.json({ settings: data ?? null });
}

// POST /api/company/twilio-settings — upsert settings
// Body: { phoneNumber, accountSid, authToken, enabled? }
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    phoneNumber?: string;
    accountSid?: string;
    authToken?: string;
    enabled?: boolean;
  } | null;

  const phoneNumber = body?.phoneNumber?.trim();
  const accountSid = body?.accountSid?.trim();
  const authToken = body?.authToken?.trim();

  if (!phoneNumber || !accountSid || !authToken) {
    return NextResponse.json(
      { error: "phoneNumber, accountSid, and authToken are required." },
      { status: 400 },
    );
  }

  // Validate E.164 format
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    return NextResponse.json(
      { error: "phoneNumber must be in E.164 format (e.g. +15551234567)." },
      { status: 400 },
    );
  }

  const payload = {
    company_id: companyScope.companyId,
    phone_number: phoneNumber,
    account_sid: accountSid,
    auth_token: authToken,
    enabled: body?.enabled !== false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("company_twilio_settings")
    .upsert(payload, { onConflict: "company_id" })
    .select("id, phone_number, account_sid, enabled, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save Twilio settings." }, { status: 500 });
  }

  return NextResponse.json({ settings: data, ok: true });
}

// DELETE /api/company/twilio-settings — remove configuration
export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  await auth.supabase
    .from("company_twilio_settings")
    .delete()
    .eq("company_id", companyScope.companyId);

  return NextResponse.json({ ok: true });
}
