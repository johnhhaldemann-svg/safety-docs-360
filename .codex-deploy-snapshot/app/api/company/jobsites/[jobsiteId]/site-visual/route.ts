import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import {
  buildFallbackSiteVisualScene,
  detectSiteVisualOverlaps,
  sceneWithZones,
  type SiteVisualScene,
  type SiteVisualZone,
} from "@/lib/jobsiteSiteVisual";
import { cleanBlueprintTransform, defaultBlueprintTransform } from "@/lib/jobsiteSiteBlueprint";
import { demoCompanyJobsiteRows } from "@/lib/demoWorkspace";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAP_SELECT =
  "id, company_id, jobsite_id, blueprint_id, generation_status, prompt_hash, ai_meta, scene_json, created_at, updated_at, created_by, updated_by";

const ZONE_SELECT =
  "id, company_id, jobsite_id, site_map_id, schedule_item_id, source_type, source_id, label, trade, work_area, starts_at, ends_at, risk_level, controls, color, position_x, position_y, position_z, size_x, size_y, size_z, metadata, created_at, updated_at";

const BLUEPRINT_SELECT =
  "id, company_id, jobsite_id, source_file_path, preview_image_path, file_name, mime_type, file_size, page_number, processing_status, image_width, image_height, transform_json, ai_meta, processing_error, created_at, updated_at, created_by, updated_by, archived_at";

const RENDER_SELECT =
  "id, company_id, jobsite_id, site_map_id, blueprint_id, render_status, prompt_hash, image_path, thumbnail_path, image_width, image_height, overlay_json, ai_meta, error_message, created_at, updated_at, created_by, updated_by, archived_at";

function isMissingVisualSchema(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_site_maps") ||
    normalized.includes("company_jobsite_visual_zones") ||
    normalized.includes("company_jobsite_site_blueprints") ||
    normalized.includes("company_jobsite_site_renders") ||
    normalized.includes("blueprint_id") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find")
  );
}

async function dbRenderToPayload(row: Record<string, unknown>) {
  const imagePath = row.image_path == null ? null : String(row.image_path);
  const thumbnailPath = row.thumbnail_path == null ? null : String(row.thumbnail_path);
  let signedImageUrl: string | null = null;
  let signedThumbnailUrl: string | null = null;
  const admin = createSupabaseAdminClient();
  if (admin) {
    if (imagePath) {
      const signed = await admin.storage.from("documents").createSignedUrl(imagePath, 10 * 60);
      signedImageUrl = signed.data?.signedUrl ?? null;
    }
    if (thumbnailPath) {
      const signed = await admin.storage.from("documents").createSignedUrl(thumbnailPath, 10 * 60);
      signedThumbnailUrl = signed.data?.signedUrl ?? null;
    }
  }
  return {
    id: String(row.id),
    siteMapId: row.site_map_id == null ? null : String(row.site_map_id),
    blueprintId: row.blueprint_id == null ? null : String(row.blueprint_id),
    renderStatus: String(row.render_status ?? "ready"),
    promptHash: row.prompt_hash == null ? null : String(row.prompt_hash),
    imagePath,
    thumbnailPath,
    signedImageUrl,
    signedThumbnailUrl,
    imageWidth: row.image_width == null ? null : Number(row.image_width),
    imageHeight: row.image_height == null ? null : Number(row.image_height),
    overlay: row.overlay_json ?? null,
    aiMeta: row.ai_meta ?? null,
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function dbBlueprintToPayload(row: Record<string, unknown>) {
  const width = Number(row.image_width ?? 1600);
  const height = Number(row.image_height ?? 1000);
  const previewPath = row.preview_image_path == null ? null : String(row.preview_image_path);
  let signedPreviewUrl: string | null = null;
  if (previewPath) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const signed = await admin.storage.from("documents").createSignedUrl(previewPath, 10 * 60);
      signedPreviewUrl = signed.data?.signedUrl ?? null;
    }
  }
  return {
    id: String(row.id),
    fileName: String(row.file_name ?? "Blueprint"),
    mimeType: String(row.mime_type ?? ""),
    fileSize: Number(row.file_size ?? 0),
    pageNumber: Number(row.page_number ?? 1),
    processingStatus: String(row.processing_status ?? "pending"),
    sourceFilePath: String(row.source_file_path ?? ""),
    previewImagePath: previewPath,
    signedPreviewUrl,
    imageWidth: Number.isFinite(width) ? width : null,
    imageHeight: Number.isFinite(height) ? height : null,
    transform: cleanBlueprintTransform(row.transform_json, defaultBlueprintTransform(width, height)),
    aiMeta: row.ai_meta ?? null,
    processingError: row.processing_error == null ? null : String(row.processing_error),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbZoneToSceneZone(row: Record<string, unknown>): SiteVisualZone {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {};
  return {
    id: String(row.id),
    label: String(row.label ?? "Work zone"),
    sourceType: String(row.source_type ?? "manual") as SiteVisualZone["sourceType"],
    sourceId: row.source_id == null ? null : String(row.source_id),
    scheduleItemId: row.schedule_item_id == null ? null : String(row.schedule_item_id),
    trade: row.trade == null ? null : String(row.trade),
    workArea: row.work_area == null ? null : String(row.work_area),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    endsAt: row.ends_at == null ? null : String(row.ends_at),
    riskLevel: String(row.risk_level ?? "medium") as SiteVisualZone["riskLevel"],
    controls: Array.isArray(row.controls) ? row.controls.map(String) : [],
    color: String(row.color ?? "#2563eb"),
    position: {
      x: Number(row.position_x ?? 0),
      y: Number(row.position_y ?? 0.5),
      z: Number(row.position_z ?? 0),
    },
    size: {
      x: Number(row.size_x ?? 4),
      y: Number(row.size_y ?? 1),
      z: Number(row.size_z ?? 4),
    },
    blueprintBounds:
      metadata.blueprintBounds && typeof metadata.blueprintBounds === "object" && !Array.isArray(metadata.blueprintBounds)
        ? {
            x: Number((metadata.blueprintBounds as Record<string, unknown>).x ?? 0),
            y: Number((metadata.blueprintBounds as Record<string, unknown>).y ?? 0),
            width: Number((metadata.blueprintBounds as Record<string, unknown>).width ?? 0.1),
            height: Number((metadata.blueprintBounds as Record<string, unknown>).height ?? 0.1),
          }
        : null,
  };
}

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_access_field_work",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const { jobsiteId } = await params;

  if (auth.role === "sales_demo") {
    const jobsite = demoCompanyJobsiteRows.find((row) => row.id === jobsiteId) ?? demoCompanyJobsiteRows[0];
    const scene = buildFallbackSiteVisualScene({
      jobsite: {
        id: jobsite.id,
        name: jobsite.name,
        location: jobsite.location ?? null,
        projectNumber: jobsite.project_number ?? null,
        jobsiteNumber: jobsite.jobsite_number ?? null,
      },
      items: [],
    });
    return NextResponse.json({
      jobsite,
      siteMap: {
        id: "demo-site-map",
        generationStatus: "fallback",
        promptHash: null,
        aiMeta: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      scene,
      blueprints: [],
      blueprint: null,
      render: null,
      canGenerate: true,
      canEditZones: true,
      canUploadBlueprints: true,
      warning: "Demo mode is showing a schematic fallback map.",
    });
  }

  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id, name, jobsite_number, project_number, location, status")
    .eq("id", jobsiteId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return NextResponse.json({ error: jobsiteResult.error.message || "Failed to load jobsite." }, { status: 500 });
  }
  if (!jobsiteResult.data) return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });

  const mapResult = await auth.supabase
    .from("company_jobsite_site_maps")
    .select(MAP_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mapResult.error) {
    if (isMissingVisualSchema(mapResult.error.message)) {
      return NextResponse.json({
        jobsite: jobsiteResult.data,
        siteMap: null,
        scene: null,
        zones: [],
        blueprints: [],
        blueprint: null,
        render: null,
        canGenerate: canGenerateSiteMap(auth.role),
        canEditZones: canEditVisualZones(auth.role),
        canUploadBlueprints: canUploadBlueprints(auth.role),
        warning: "Jobsite site visual tables are not available yet. Run the latest Supabase migration.",
      });
    }
    return NextResponse.json({ error: mapResult.error.message || "Failed to load site visual." }, { status: 500 });
  }

  if (!mapResult.data) {
    const blueprintsResult = await auth.supabase
      .from("company_jobsite_site_blueprints")
      .select(BLUEPRINT_SELECT)
      .eq("company_id", companyScope.companyId)
      .eq("jobsite_id", jobsiteId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    const blueprints = blueprintsResult.error ? [] : await Promise.all(((blueprintsResult.data ?? []) as Record<string, unknown>[]).map(dbBlueprintToPayload));
    return NextResponse.json({
      jobsite: jobsiteResult.data,
      siteMap: null,
      scene: null,
      zones: [],
      blueprints,
      blueprint: blueprints.find((item) => item.processingStatus === "ready") ?? blueprints[0] ?? null,
      render: null,
      canGenerate: canGenerateSiteMap(auth.role),
      canEditZones: canEditVisualZones(auth.role),
      canUploadBlueprints: canUploadBlueprints(auth.role),
    });
  }

  const zonesResult = await auth.supabase
    .from("company_jobsite_visual_zones")
    .select(ZONE_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("site_map_id", mapResult.data.id)
    .order("created_at", { ascending: true });

  if (zonesResult.error) {
    return NextResponse.json({ error: zonesResult.error.message || "Failed to load visual zones." }, { status: 500 });
  }

  const zones = ((zonesResult.data ?? []) as Record<string, unknown>[]).map(dbZoneToSceneZone);
  const baseScene = (mapResult.data.scene_json ?? null) as SiteVisualScene | null;
  const scene = baseScene ? sceneWithZones(baseScene, zones) : null;
  const blueprintsResult = await auth.supabase
    .from("company_jobsite_site_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const blueprints = blueprintsResult.error ? [] : await Promise.all(((blueprintsResult.data ?? []) as Record<string, unknown>[]).map(dbBlueprintToPayload));
  const linkedBlueprintId = mapResult.data.blueprint_id == null ? null : String(mapResult.data.blueprint_id);
  const activeBlueprint = blueprints.find((item) => item.id === linkedBlueprintId) ?? blueprints.find((item) => item.processingStatus === "ready") ?? blueprints[0] ?? null;
  const renderResult = await auth.supabase
    .from("company_jobsite_site_renders")
    .select(RENDER_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("site_map_id", mapResult.data.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const render = renderResult.error || !renderResult.data
    ? null
    : await dbRenderToPayload(renderResult.data as Record<string, unknown>);

  return NextResponse.json({
    jobsite: jobsiteResult.data,
    siteMap: {
      id: mapResult.data.id,
      blueprintId: linkedBlueprintId,
      generationStatus: mapResult.data.generation_status,
      promptHash: mapResult.data.prompt_hash,
      aiMeta: mapResult.data.ai_meta ?? null,
      createdAt: mapResult.data.created_at,
      updatedAt: mapResult.data.updated_at,
    },
    scene: scene ? { ...scene, overlaps: detectSiteVisualOverlaps(zones) } : null,
    zones,
    blueprints,
    blueprint: activeBlueprint,
    render,
    canGenerate: canGenerateSiteMap(auth.role),
    canEditZones: canEditVisualZones(auth.role),
    canUploadBlueprints: canUploadBlueprints(auth.role),
  });
}

export function canGenerateSiteMap(role: string) {
  return ["platform_admin", "super_admin", "admin", "company_admin", "manager", "safety_manager", "project_manager"].includes(role);
}

export function canEditVisualZones(role: string) {
  return canGenerateSiteMap(role) || ["field_supervisor", "foreman"].includes(role);
}

export function canUploadBlueprints(role: string) {
  return canGenerateSiteMap(role) || ["field_supervisor", "foreman"].includes(role);
}

export { BLUEPRINT_SELECT, MAP_SELECT, RENDER_SELECT, ZONE_SELECT, dbBlueprintToPayload, dbRenderToPayload, dbZoneToSceneZone, isMissingVisualSchema };
