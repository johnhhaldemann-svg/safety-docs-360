import { NextResponse } from "next/server";
import {
  runCompanyOnboardingImport,
  type CompanyOnboardingImportPayload,
} from "@/lib/companyOnboardingImportService";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, { requireAdmin: true });
  if ("error" in auth) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only a Super Admin can import onboarding templates into any company profile." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const companyId = id.trim();
  if (!companyId) {
    return NextResponse.json({ error: "Company id is required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json(
      { error: "Server database configuration is required for cross-company imports." },
      { status: 503 }
    );
  }

  const companyLookup = await db
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (companyLookup.error) {
    return NextResponse.json(
      { error: companyLookup.error.message || "Failed to validate company workspace." },
      { status: 500 }
    );
  }
  if (!companyLookup.data) {
    return NextResponse.json({ error: "Company workspace not found." }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as
    | CompanyOnboardingImportPayload
    | null;
  if (!payload) {
    return NextResponse.json({ error: "Import payload is required." }, { status: 400 });
  }

  const result = await runCompanyOnboardingImport({
    db,
    companyId,
    actorUserId: auth.user.id,
    payload: {
      ...payload,
      source:
        typeof payload.source === "string" && payload.source.trim()
          ? payload.source.trim()
          : "superadmin_company_profile_upload",
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
