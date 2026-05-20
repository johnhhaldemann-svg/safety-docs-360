import sharp from "sharp";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  SITE_VISUAL_BLUEPRINT_BUCKET,
  blueprintPreviewPath,
  cleanBlueprintTransform,
  defaultBlueprintTransform,
} from "@/lib/jobsiteSiteBlueprint";
import { BLUEPRINT_SELECT, canGenerateSiteMap, canUploadBlueprints, dbBlueprintToPayload } from "../../route";

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

async function loadBlueprint(params: {
  supabase: SupabaseClient;
  companyId: string;
  jobsiteId: string;
  blueprintId: string;
}) {
  return params.supabase
    .from("company_jobsite_site_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("id", params.blueprintId)
    .eq("company_id", params.companyId)
    .eq("jobsite_id", params.jobsiteId)
    .maybeSingle();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string; blueprintId: string }> }
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
    return NextResponse.json({ error: "You do not have permission to process jobsite blueprints." }, { status: 403 });
  }

  const { jobsiteId, blueprintId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const existing = await loadBlueprint({ supabase: auth.supabase, companyId: companyScope.companyId, jobsiteId, blueprintId });
  if (existing.error) return NextResponse.json({ error: existing.error.message || "Failed to load blueprint." }, { status: 500 });
  if (!existing.data) return NextResponse.json({ error: "Blueprint not found." }, { status: 404 });

  await auth.supabase
    .from("company_jobsite_site_blueprints")
    .update({ processing_status: "processing", processing_error: null, updated_by: auth.user.id })
    .eq("id", blueprintId)
    .eq("company_id", companyScope.companyId);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }

  const sourcePath = String(existing.data.source_file_path ?? "");
  const downloaded = await admin.storage.from(SITE_VISUAL_BLUEPRINT_BUCKET).download(sourcePath);
  if (downloaded.error || !downloaded.data) {
    await auth.supabase
      .from("company_jobsite_site_blueprints")
      .update({ processing_status: "failed", processing_error: downloaded.error?.message || "Blueprint source file could not be downloaded." })
      .eq("id", blueprintId)
      .eq("company_id", companyScope.companyId);
    return NextResponse.json({ error: downloaded.error?.message || "Blueprint source file could not be downloaded." }, { status: 500 });
  }

  const sourceBytes = Buffer.from(await downloaded.data.arrayBuffer());
  const mimeType = String(existing.data.mime_type ?? "");
  const pageNumber = Math.max(1, Number(existing.data.page_number ?? 1));
  try {
    const inputOptions = mimeType === "application/pdf"
      ? { page: pageNumber - 1, density: 144, limitInputPixels: false }
      : { limitInputPixels: false };
    const rendered = await sharp(sourceBytes, inputOptions)
      .rotate()
      .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });

    const previewPath = blueprintPreviewPath(companyScope.companyId, jobsiteId, blueprintId);
    const upload = await admin.storage.from(SITE_VISUAL_BLUEPRINT_BUCKET).upload(previewPath, rendered.data, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "3600",
    });
    if (upload.error) throw new Error(upload.error.message);

    const width = rendered.info.width || 1600;
    const height = rendered.info.height || 1000;
    const currentTransform = cleanBlueprintTransform(existing.data.transform_json, defaultBlueprintTransform(width, height));
    const update = await auth.supabase
      .from("company_jobsite_site_blueprints")
      .update({
        preview_image_path: previewPath,
        processing_status: "ready",
        image_width: width,
        image_height: height,
        transform_json: currentTransform.width ? currentTransform : defaultBlueprintTransform(width, height),
        processing_error: null,
        updated_by: auth.user.id,
      })
      .eq("id", blueprintId)
      .eq("company_id", companyScope.companyId)
      .select(BLUEPRINT_SELECT)
      .single();
    if (update.error) {
      return NextResponse.json({ error: update.error.message || "Failed to save processed blueprint." }, { status: 500 });
    }
    return NextResponse.json({ blueprint: await dbBlueprintToPayload(update.data as Record<string, unknown>) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blueprint processing failed.";
    await auth.supabase
      .from("company_jobsite_site_blueprints")
      .update({ processing_status: "failed", processing_error: message.slice(0, 500), updated_by: auth.user.id })
      .eq("id", blueprintId)
      .eq("company_id", companyScope.companyId);
    return NextResponse.json({ error: `Blueprint processing failed: ${message}` }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string; blueprintId: string }> }
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
    return NextResponse.json({ error: "You do not have permission to update jobsite blueprints." }, { status: 403 });
  }

  const { jobsiteId, blueprintId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { transform?: unknown; pageNumber?: unknown; archive?: unknown }
    | null;
  const existing = await loadBlueprint({ supabase: auth.supabase, companyId: companyScope.companyId, jobsiteId, blueprintId });
  if (existing.error) return NextResponse.json({ error: existing.error.message || "Failed to load blueprint." }, { status: 500 });
  if (!existing.data) return NextResponse.json({ error: "Blueprint not found." }, { status: 404 });

  const shouldArchive = body?.archive === true;
  if (shouldArchive && !canGenerateSiteMap(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to archive jobsite blueprints." }, { status: 403 });
  }

  const width = Number(existing.data.image_width ?? 1600);
  const height = Number(existing.data.image_height ?? 1000);
  const updateValues = {
    ...(body?.transform ? { transform_json: cleanBlueprintTransform(body.transform, defaultBlueprintTransform(width, height)) } : {}),
    ...(body?.pageNumber ? { page_number: Math.max(1, Math.min(200, Math.trunc(Number(body.pageNumber) || 1))) } : {}),
    ...(shouldArchive ? { archived_at: new Date().toISOString(), processing_status: "archived" } : {}),
    updated_by: auth.user.id,
  };

  const update = await auth.supabase
    .from("company_jobsite_site_blueprints")
    .update(updateValues)
    .eq("id", blueprintId)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .select(BLUEPRINT_SELECT)
    .single();
  if (update.error) {
    return NextResponse.json({ error: update.error.message || "Failed to update blueprint." }, { status: 500 });
  }
  return NextResponse.json({ blueprint: await dbBlueprintToPayload(update.data as Record<string, unknown>) });
}
