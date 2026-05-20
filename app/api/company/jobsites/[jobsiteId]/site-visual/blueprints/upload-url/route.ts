import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  SITE_VISUAL_BLUEPRINT_BUCKET,
  blueprintSourcePath,
  validateBlueprintUpload,
} from "@/lib/jobsiteSiteBlueprint";
import { BLUEPRINT_SELECT, canUploadBlueprints, dbBlueprintToPayload } from "../../route";

export const runtime = "nodejs";

async function resolveCompanyScope(auth: {
  supabase: Parameters<typeof getCompanyScope>[0]["supabase"];
  user: { id: string };
  team?: string | null;
}) {
  return getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_access_field_work",
    ],
  });
  if ("error" in auth) return auth.error;
  if (!canUploadBlueprints(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to upload jobsite blueprints." }, { status: 403 });
  }

  const { jobsiteId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { fileName?: unknown; mimeType?: unknown; fileSize?: unknown; pageNumber?: unknown }
    | null;
  const upload = validateBlueprintUpload(body ?? {});
  if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select("id")
    .eq("id", jobsiteId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (jobsiteResult.error) {
    return NextResponse.json({ error: jobsiteResult.error.message || "Failed to load jobsite." }, { status: 500 });
  }
  if (!jobsiteResult.data) return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });

  const insert = await auth.supabase
    .from("company_jobsite_site_blueprints")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      source_file_path: "pending",
      file_name: upload.fileName,
      mime_type: upload.mimeType,
      file_size: upload.fileSize,
      page_number: upload.pageNumber,
      processing_status: "pending",
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(BLUEPRINT_SELECT)
    .single();
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message || "Failed to create blueprint record." }, { status: 500 });
  }

  const sourcePath = blueprintSourcePath({
    companyId: companyScope.companyId,
    jobsiteId,
    blueprintId: String(insert.data.id),
    fileName: upload.fileName,
    mimeType: upload.mimeType,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }

  const signed = await admin.storage.from(SITE_VISUAL_BLUEPRINT_BUCKET).createSignedUploadUrl(sourcePath, { upsert: true });
  if (signed.error || !signed.data?.token) {
    await auth.supabase
      .from("company_jobsite_site_blueprints")
      .update({ processing_status: "failed", processing_error: signed.error?.message || "Failed to create upload URL." })
      .eq("id", insert.data.id)
      .eq("company_id", companyScope.companyId);
    return NextResponse.json({ error: signed.error?.message || "Failed to create signed upload URL." }, { status: 500 });
  }

  const update = await auth.supabase
    .from("company_jobsite_site_blueprints")
    .update({
      source_file_path: sourcePath,
      processing_status: "uploaded",
      updated_by: auth.user.id,
    })
    .eq("id", insert.data.id)
    .eq("company_id", companyScope.companyId)
    .select(BLUEPRINT_SELECT)
    .single();
  if (update.error) {
    return NextResponse.json({ error: update.error.message || "Failed to prepare blueprint upload." }, { status: 500 });
  }

  return NextResponse.json({
    bucket: SITE_VISUAL_BLUEPRINT_BUCKET,
    path: sourcePath,
    token: signed.data.token,
    blueprint: await dbBlueprintToPayload(update.data as Record<string, unknown>),
  });
}
