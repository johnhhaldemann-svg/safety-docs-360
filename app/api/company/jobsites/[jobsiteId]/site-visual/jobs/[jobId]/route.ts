import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { detectSiteVisualOverlaps, sceneWithZones, type SiteVisualScene } from "@/lib/jobsiteSiteVisual";
import {
  BLUEPRINT_SELECT,
  MAP_SELECT,
  RENDER_SELECT,
  ZONE_SELECT,
  canEditVisualZones,
  canGenerateSiteMap,
  canUploadBlueprints,
  dbBlueprintToPayload,
  dbRenderToPayload,
  dbZoneToSceneZone,
} from "../../route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string; jobId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return auth.error;

  const { jobsiteId, jobId } = await params;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }

  const jobResult = await admin
    .from("ai_visual_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("surface", "jobsite.site-visual.generate")
    .maybeSingle();

  if (jobResult.error) {
    return NextResponse.json({ error: jobResult.error.message || "Failed to load visual generation job." }, { status: 500 });
  }
  if (!jobResult.data) return NextResponse.json({ error: "Visual generation job not found." }, { status: 404 });

  let payload = null;
  if (jobResult.data.site_map_id) {
    const [jobsiteResult, mapResult, zonesResult, blueprintsResult, renderResult] = await Promise.all([
      auth.supabase
        .from("company_jobsites")
        .select("id, company_id, name, jobsite_number, project_number, location, status")
        .eq("id", jobsiteId)
        .eq("company_id", companyScope.companyId)
        .maybeSingle(),
      auth.supabase
        .from("company_jobsite_site_maps")
        .select(MAP_SELECT)
        .eq("id", jobResult.data.site_map_id)
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .maybeSingle(),
      auth.supabase
        .from("company_jobsite_visual_zones")
        .select(ZONE_SELECT)
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .eq("site_map_id", jobResult.data.site_map_id)
        .order("created_at", { ascending: true }),
      auth.supabase
        .from("company_jobsite_site_blueprints")
        .select(BLUEPRINT_SELECT)
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      auth.supabase
        .from("company_jobsite_site_renders")
        .select(RENDER_SELECT)
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .eq("site_map_id", jobResult.data.site_map_id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (mapResult.data) {
      const zones = ((zonesResult.data ?? []) as Record<string, unknown>[]).map(dbZoneToSceneZone);
      const baseScene = (mapResult.data.scene_json ?? null) as SiteVisualScene | null;
      const scene = baseScene ? sceneWithZones(baseScene, zones) : null;
      const blueprints = blueprintsResult.error
        ? []
        : await Promise.all(((blueprintsResult.data ?? []) as Record<string, unknown>[]).map(dbBlueprintToPayload));
      const linkedBlueprintId = mapResult.data.blueprint_id == null ? null : String(mapResult.data.blueprint_id);
      const activeBlueprint =
        blueprints.find((item) => item.id === linkedBlueprintId) ??
        blueprints.find((item) => item.processingStatus === "ready") ??
        blueprints[0] ??
        null;
      const render = renderResult.error || !renderResult.data
        ? null
        : await dbRenderToPayload(renderResult.data as Record<string, unknown>);
      payload = {
        jobsite: jobsiteResult.data ?? null,
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
      };
    }
  }

  return NextResponse.json({
    job: {
      id: jobResult.data.id,
      status: jobResult.data.status,
      progress: jobResult.data.progress,
      stage: jobResult.data.stage,
      errorType: jobResult.data.error_type,
      errorMessage: jobResult.data.error_message,
      siteMapId: jobResult.data.site_map_id,
      createdAt: jobResult.data.created_at,
      updatedAt: jobResult.data.updated_at,
      startedAt: jobResult.data.started_at,
      completedAt: jobResult.data.completed_at,
      aiMeta: jobResult.data.ai_meta,
    },
    payload,
  });
}
