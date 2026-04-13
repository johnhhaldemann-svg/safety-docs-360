import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Company admins / managers update company profile fields and can complete pilot trial
 * (companies table updates are admin-only in RLS; this route uses service role after auth checks).
 */
export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const rl = checkFixedWindowRateLimit(`company-profile:${auth.user.id}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace is linked to this account." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const completePilot = body.completePilot === true;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };

  const optionalFields: Array<[string, string | undefined]> = [
    ["name", str(body.name)],
    ["industry", str(body.industry)],
    ["phone", str(body.phone)],
    ["website", str(body.website)],
    ["address_line_1", str(body.addressLine1)],
    ["city", str(body.city)],
    ["state_region", str(body.stateRegion)],
    ["postal_code", str(body.postalCode)],
    ["country", str(body.country)],
    ["primary_contact_name", str(body.primaryContactName)],
    ["primary_contact_email", str(body.primaryContactEmail)],
  ];

  for (const [key, val] of optionalFields) {
    if (val !== undefined) {
      patch[key] = val.trim();
    }
  }

  if (completePilot) {
    const { data: pilotRow, error: pilotErr } = await admin
      .from("companies")
      .select("pilot_trial_ends_at, pilot_converted_at")
      .eq("id", companyScope.companyId)
      .maybeSingle();

    if (pilotErr) {
      return NextResponse.json(
        { error: pilotErr.message || "Could not verify pilot trial status." },
        { status: 500 }
      );
    }

    const row = pilotRow as {
      pilot_trial_ends_at?: string | null;
      pilot_converted_at?: string | null;
    } | null;

    if (!row?.pilot_trial_ends_at || row.pilot_converted_at) {
      return NextResponse.json(
        { error: "This workspace is not in an active pilot trial." },
        { status: 400 }
      );
    }

    patch.pilot_converted_at = new Date().toISOString();
  }

  if (Object.keys(patch).length <= 2 && !completePilot) {
    return NextResponse.json(
      { error: "Provide at least one field to update or set completePilot: true." },
      { status: 400 }
    );
  }

  if (typeof patch.name === "string" && !patch.name) {
    return NextResponse.json({ error: "Company name cannot be empty." }, { status: 400 });
  }

  const { error } = await admin.from("companies").update(patch).eq("id", companyScope.companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  serverLog("info", "company_profile_patch", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    completePilot,
  });

  return NextResponse.json({ ok: true });
}
