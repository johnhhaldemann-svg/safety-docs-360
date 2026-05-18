import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import {
  runCompanyOnboardingImport,
  type CompanyOnboardingImportPayload,
} from "@/lib/companyOnboardingImportService";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can import onboarding data." },
      { status: 403 }
    );
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot import onboarding data." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as
    | CompanyOnboardingImportPayload
    | null;
  if (!payload) {
    return NextResponse.json({ error: "Import payload is required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const result = await runCompanyOnboardingImport({
    db,
    companyId: companyScope.companyId,
    actorUserId: auth.user.id,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
