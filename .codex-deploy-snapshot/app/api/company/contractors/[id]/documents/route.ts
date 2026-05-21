import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

const DOC_TYPES = new Set(["coi", "wcb", "license", "emr", "safety_manual", "other"]);

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_manage_company_users",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ documents: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: contractorId } = await params;
  const c = await auth.supabase
    .from("company_contractors")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", contractorId)
    .maybeSingle();
  if (c.error || !c.data) {
    return NextResponse.json({ error: "Contractor not found." }, { status: 404 });
  }

  const res = await auth.supabase
    .from("company_contractor_documents")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("contractor_id", contractorId)
    .order("expires_on", { ascending: true });

  if (res.error) {
    return NextResponse.json({ documents: [], warning: res.error.message });
  }
  return NextResponse.json({ documents: res.data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: contractorId } = await params;
  const c = await auth.supabase
    .from("company_contractors")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", contractorId)
    .maybeSingle();
  if (c.error || !c.data) {
    return NextResponse.json({ error: "Contractor not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const docType = String(body?.docType ?? "").trim().toLowerCase();
  if (!DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: "Invalid docType." }, { status: 400 });
  }
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });
  const expiresOn = String(body?.expiresOn ?? "").trim() || null;
  const filePath = String(body?.filePath ?? "").trim() || null;

  const ins = await auth.supabase
    .from("company_contractor_documents")
    .insert({
      company_id: companyScope.companyId,
      contractor_id: contractorId,
      doc_type: docType,
      title,
      expires_on: expiresOn,
      file_path: filePath,
      verification_status: "pending",
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to add document." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "contractor_prequal",
    record_id: ins.data.id,
    event_type: "contractor_document_added",
    detail: "Contractor compliance document added.",
    event_payload: { contractorId, docType },
    created_by: auth.user.id,
  });

  return NextResponse.json({ document: ins.data });
}
