import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isManualForecasterIncidentDescription } from "@/lib/injuryWeather/manualForecasterIncident";

export const runtime = "nodejs";

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isSuperAdminRole(auth.role)) {
    return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const incidentId = String(id ?? "").trim();
  if (!incidentId) {
    return NextResponse.json({ error: "Incident id is required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 500 });
  }

  const { data: row, error: selErr } = await admin
    .from("company_incidents")
    .select("id, description")
    .eq("id", incidentId)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ error: selErr.message || "Lookup failed." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }
  if (!isManualForecasterIncidentDescription(row.description)) {
    return NextResponse.json(
      { error: "Only Injury Weather manual test rows (tagged description) can be deleted here." },
      { status: 400 }
    );
  }

  const { error: delErr } = await admin.from("company_incidents").delete().eq("id", incidentId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message || "Delete failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
