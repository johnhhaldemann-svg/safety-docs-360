import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isManualForecasterIncidentDescription } from "@/lib/injuryWeather/manualForecasterIncident";

export const runtime = "nodejs";

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isSuperAdminRole(auth.role)) {
    return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = String(searchParams.get("companyId") ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 500 });
  }

  const { data: co, error: coErr } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (coErr || !co) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const { data, error } = await admin
    .from("company_incidents")
    .select("id, title, created_at, jobsite_id, description")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to list incidents." }, { status: 500 });
  }

  const incidents = (data ?? [])
    .filter((row) => isManualForecasterIncidentDescription(row.description))
    .map(({ id, title, created_at, jobsite_id }) => ({
      id,
      title,
      created_at,
      jobsite_id,
    }));

  return NextResponse.json({ incidents });
}
