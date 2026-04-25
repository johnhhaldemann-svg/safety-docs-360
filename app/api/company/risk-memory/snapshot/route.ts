import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { buildSalesDemoRiskSnapshotResponse } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function isMissingSnapshotTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_risk_memory_snapshots");
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const snapshotDate = String(body?.snapshotDate ?? "").trim() || new Date().toISOString().slice(0, 10);
  const jobsiteId = body?.jobsiteId != null ? String(body.jobsiteId).trim() || null : null;
  if (auth.role === "sales_demo") {
    return NextResponse.json(buildSalesDemoRiskSnapshotResponse(snapshotDate, jobsiteId));
  }
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only managers and admins can save risk memory snapshots." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const days = Math.min(365, Math.max(1, Number(body?.days ?? 90)));

  const ctx = await buildRiskMemoryStructuredContext(auth.supabase, companyScope.companyId, {
    days,
    jobsiteId,
  });
  const metrics = ctx ?? { engine: "Safety360 Risk Memory Engine", note: "no_facet_context" };

  const upsert = await auth.supabase
    .from("company_risk_memory_snapshots")
    .upsert(
      {
        company_id: companyScope.companyId,
        jobsite_id: jobsiteId,
        snapshot_date: snapshotDate,
        metrics,
        created_by: auth.user.id,
      },
      { onConflict: "company_id,jobsite_id,snapshot_date" }
    )
    .select("id, snapshot_date, jobsite_id")
    .single();

  if (upsert.error) {
    if (isMissingSnapshotTable(upsert.error.message)) {
      return NextResponse.json({ error: "Risk memory snapshots table not available. Run migrations." }, { status: 503 });
    }
    return NextResponse.json({ error: upsert.error.message || "Failed to save snapshot." }, { status: 500 });
  }

  return NextResponse.json({ success: true, snapshot: upsert.data });
}
