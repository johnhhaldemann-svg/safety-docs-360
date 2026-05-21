import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isMultipartPhotoRequest, uploadMobilePhotoFromRequest } from "@/lib/mobilePhotoUpload";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  const { id } = await params;
  const jsa = await auth.supabase
    .from("company_jsas")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (jsa.error) return NextResponse.json({ error: jsa.error.message || "Failed to load JSA." }, { status: 500 });
  if (!jsa.data) return NextResponse.json({ error: "JSA not found." }, { status: 404 });

  if (isMultipartPhotoRequest(request)) {
    try {
      const photo = await uploadMobilePhotoFromRequest(request, `companies/${companyScope.companyId}/jsas/${id}`);
      const insert = await auth.supabase
        .from("company_jsa_evidence")
        .insert({
          company_id: companyScope.companyId,
          jsa_id: id,
          jobsite_id: jsa.data.jobsite_id ?? null,
          file_path: photo.filePath,
          file_name: photo.fileName,
          mime_type: photo.mimeType,
          created_by: auth.user.id,
        })
        .select("*")
        .single();
      if (insert.error) {
        return NextResponse.json({ error: insert.error.message || "Failed to attach JSA photo." }, { status: 500 });
      }
      return NextResponse.json({ success: true, photo: insert.data });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
    }
  }

  const body = (await request.json().catch(() => null)) as {
    fileName?: string;
    mimeType?: string;
    filePath?: string;
  } | null;
  const filePath = String(body?.filePath ?? "").trim();
  if (filePath) {
    const insert = await auth.supabase
      .from("company_jsa_evidence")
      .insert({
        company_id: companyScope.companyId,
        jsa_id: id,
        jobsite_id: jsa.data.jobsite_id ?? null,
        file_path: filePath,
        file_name: String(body?.fileName ?? "").trim() || filePath.split("/").pop() || "photo",
        mime_type: String(body?.mimeType ?? "").trim() || null,
        created_by: auth.user.id,
      })
      .select("*")
      .single();
    if (insert.error) {
      return NextResponse.json({ error: insert.error.message || "Failed to attach JSA photo." }, { status: 500 });
    }
    return NextResponse.json({ success: true, photo: insert.data });
  }

  const fileName = sanitizeFileName(String(body?.fileName ?? "").trim());
  if (!fileName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Missing storage configuration." }, { status: 500 });
  const path = `companies/${companyScope.companyId}/jsas/${id}/${Date.now()}-${fileName}`;
  const signed = await adminClient.storage.from("documents").createSignedUploadUrl(path);
  if (signed.error || !signed.data?.token) {
    return NextResponse.json({ error: signed.error?.message || "Failed to create upload URL." }, { status: 500 });
  }
  return NextResponse.json({ bucket: "documents", path, token: signed.data.token, mimeType: body?.mimeType ?? null });
}
