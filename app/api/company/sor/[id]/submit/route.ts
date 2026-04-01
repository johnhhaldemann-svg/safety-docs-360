import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { computeSorHash } from "@/lib/sor/hash";

export const runtime = "nodejs";

const SOR_SELECT =
  "id, company_id, date, project, location, trade, category, subcategory, description, severity, created_at, created_by, updated_at, updated_by, status, version_number, previous_version_id, record_hash, previous_hash, change_reason, is_deleted";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_view_all_company_data"],
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
  if (current.data.status !== "draft") {
    return NextResponse.json({ error: "Only draft SOR records can be submitted." }, { status: 409 });
  }
  if (current.data.created_by !== auth.user.id) {
    return NextResponse.json({ error: "You can only submit your own draft SOR." }, { status: 403 });
  }

  const previous = await auth.supabase
    .from("company_sor_records")
    .select("record_hash")
    .eq("company_id", scope.companyId)
    .in("status", ["submitted", "locked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previous.error) {
    return NextResponse.json({ error: previous.error.message || "Failed to resolve previous hash." }, { status: 500 });
  }
  const previousHash = previous.data?.record_hash ?? null;

  const nextHash = computeSorHash({
    date: current.data.date,
    project: current.data.project,
    location: current.data.location,
    trade: current.data.trade,
    category: current.data.category,
    subcategory: current.data.subcategory,
    description: current.data.description,
    severity: current.data.severity,
    created_by: current.data.created_by,
    created_at: current.data.created_at,
    previous_hash: previousHash,
    version_number: current.data.version_number,
  });

  const submitResult = await auth.supabase
    .from("company_sor_records")
    .update({
      status: "submitted",
      previous_hash: previousHash,
      record_hash: nextHash,
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .select(SOR_SELECT)
    .single();
  if (submitResult.error) {
    return NextResponse.json({ error: submitResult.error.message || "Failed to submit SOR." }, { status: 500 });
  }

  return NextResponse.json({ success: true, record: submitResult.data });
}
