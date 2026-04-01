import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole, normalizeAppRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { verifySorRecordHash } from "@/lib/sor/verify";
import type { SorRecordRow } from "@/lib/sor/types";

export const runtime = "nodejs";

const SOR_SELECT =
  "id, company_id, date, project, location, trade, category, subcategory, description, severity, created_at, created_by, updated_at, updated_by, status, version_number, previous_version_id, record_hash, previous_hash, change_reason, is_deleted";

function canOpenAdminAudit(role: string) {
  if (isAdminRole(role)) return true;
  const normalized = normalizeAppRole(role);
  return normalized === "company_admin" || normalized === "manager";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_view_analytics", "can_view_reports"],
  });
  if ("error" in auth) return auth.error;
  if (!canOpenAdminAudit(auth.role)) {
    return NextResponse.json({ error: "Admin audit access is restricted." }, { status: 403 });
  }

  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ records: [] });

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "").trim().toLowerCase();
  const project = (searchParams.get("project") ?? "").trim();
  const trade = (searchParams.get("trade") ?? "").trim();
  const userId = (searchParams.get("userId") ?? "").trim();
  const includeDeleted = searchParams.get("includeDeleted") !== "false";

  let recordsQuery = auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("company_id", scope.companyId)
    .order("created_at", { ascending: false });
  if (!includeDeleted) recordsQuery = recordsQuery.eq("is_deleted", false);
  if (status) recordsQuery = recordsQuery.eq("status", status);
  if (project) recordsQuery = recordsQuery.ilike("project", `%${project}%`);
  if (trade) recordsQuery = recordsQuery.ilike("trade", `%${trade}%`);
  if (userId) recordsQuery = recordsQuery.eq("created_by", userId);
  const recordsResult = await recordsQuery;
  if (recordsResult.error) {
    return NextResponse.json({ error: recordsResult.error.message || "Failed to load SOR audit records." }, { status: 500 });
  }

  const logsResult = await auth.supabase
    .from("sor_audit_log")
    .select("*")
    .eq("company_id", scope.companyId)
    .order("timestamp", { ascending: false })
    .limit(500);
  if (logsResult.error) {
    return NextResponse.json({ error: logsResult.error.message || "Failed to load SOR audit log." }, { status: 500 });
  }

  const records = (recordsResult.data ?? []) as SorRecordRow[];
  const decorated = records.map((r) => ({
    ...r,
    verification: verifySorRecordHash(r) ? "valid" : "invalid",
  }));
  return NextResponse.json({
    records: decorated,
    logs: logsResult.data ?? [],
  });
}
