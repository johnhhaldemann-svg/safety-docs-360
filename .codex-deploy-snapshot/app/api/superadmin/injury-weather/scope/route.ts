import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

/**
 * GET — list companies (no query) or jobsites for a company (?companyId=uuid).
 */
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isSuperAdminRole(auth.role)) {
    return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId")?.trim() || "";

  if (!companyId) {
    const { data, error } = await admin
      .from("companies")
      .select("id, name")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(500);
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load companies." }, { status: 500 });
    }
    return NextResponse.json({ companies: data ?? [] });
  }

  const { data, error } = await admin
    .from("company_jobsites")
    .select("id, name, status")
    .eq("company_id", companyId)
    .order("name", { ascending: true })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load jobsites." }, { status: 500 });
  }
  return NextResponse.json({ jobsites: data ?? [] });
}
