import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { verifySorChain, verifySorRecordHash } from "@/lib/sor/verify";
import type { SorRecordRow } from "@/lib/sor/types";

export const runtime = "nodejs";

const SOR_SELECT =
  "id, company_id, date, project, location, trade, category, subcategory, description, severity, created_at, created_by, updated_at, updated_by, status, version_number, previous_version_id, record_hash, previous_hash, change_reason, is_deleted";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data", "can_view_reports"],
  });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const current = await auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .single();
  if (current.error) return NextResponse.json({ error: current.error.message || "SOR not found." }, { status: 404 });

  const chain = await auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("company_id", scope.companyId)
    .eq("project", current.data.project)
    .in("status", ["submitted", "locked", "superseded"])
    .order("created_at", { ascending: true });
  if (chain.error) {
    return NextResponse.json({ error: chain.error.message || "Failed to verify chain." }, { status: 500 });
  }

  const chainRows = (chain.data ?? []) as SorRecordRow[];
  const hashValid = verifySorRecordHash(current.data as SorRecordRow);
  const chainResult = verifySorChain(chainRows);
  const result = !hashValid ? "invalid" : chainResult;
  return NextResponse.json({ result, hashValid, chainResult, recordId: id });
}
