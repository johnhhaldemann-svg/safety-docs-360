import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import {
  DEFAULT_PREDICTABILITY_SETTINGS,
  PREDICTABILITY_MODE_DESCRIPTIONS,
  PREDICTABILITY_MODE_LABELS,
  normalizePredictabilitySettings,
} from "@/lib/predictability/settings";
import {
  loadCompanyPredictabilitySettings,
  updateCompanyPredictabilitySettings,
} from "@/lib/predictability/dataProviders";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function canManagePredictabilitySettings(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function settingsPayload(settings: unknown) {
  return {
    settings: normalizePredictabilitySettings(settings),
    defaults: DEFAULT_PREDICTABILITY_SETTINGS,
    modeLabels: PREDICTABILITY_MODE_LABELS,
    modeDescriptions: PREDICTABILITY_MODE_DESCRIPTIONS,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data", "can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(settingsPayload(DEFAULT_PREDICTABILITY_SETTINGS));
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const settings = await loadCompanyPredictabilitySettings(auth.supabase, companyScope.companyId);
  return NextResponse.json(settingsPayload(settings));
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;
  if (!canManagePredictabilitySettings(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and safety leads can update Predictability Engine settings." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid Predictability Engine settings payload." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing Supabase service role; cannot update Predictability Engine settings." },
      { status: 500 }
    );
  }

  const result = await updateCompanyPredictabilitySettings(admin, companyScope.companyId, body, auth.user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...settingsPayload(result.settings) });
}
