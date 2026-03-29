import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type AttachmentPayload = {
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

function canManageReportFiles(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager"
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_reports", "can_view_dashboards", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ attachments: [] });
  const { id } = await params;

  const result = await auth.supabase
    .from("company_report_attachments")
    .select("id, report_id, company_id, jobsite_id, file_path, file_name, mime_type, file_size, created_at, created_by")
    .eq("company_id", companyScope.companyId)
    .eq("report_id", id)
    .order("created_at", { ascending: false });
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load report attachments." }, { status: 500 });
  }
  return NextResponse.json({ attachments: result.data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageReportFiles(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to attach report files." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }
  const { id } = await params;

  const reportResult = await auth.supabase
    .from("company_reports")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (reportResult.error) {
    return NextResponse.json({ error: reportResult.error.message || "Failed to load report." }, { status: 500 });
  }
  if (!reportResult.data) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as AttachmentPayload | null;
  const filePath = String(body?.filePath ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim();
  if (!filePath || !fileName) {
    return NextResponse.json({ error: "filePath and fileName are required." }, { status: 400 });
  }

  const insertResult = await auth.supabase
    .from("company_report_attachments")
    .insert({
      company_id: companyScope.companyId,
      report_id: id,
      jobsite_id: reportResult.data.jobsite_id ?? null,
      file_path: filePath,
      file_name: fileName,
      mime_type: String(body?.mimeType ?? "").trim() || null,
      file_size: typeof body?.fileSize === "number" ? body.fileSize : null,
      created_by: auth.user.id,
    })
    .select("id, report_id, file_path, file_name, mime_type, file_size, created_at")
    .single();
  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message || "Failed to attach report file." }, { status: 500 });
  }

  return NextResponse.json({ success: true, attachment: insertResult.data });
}
