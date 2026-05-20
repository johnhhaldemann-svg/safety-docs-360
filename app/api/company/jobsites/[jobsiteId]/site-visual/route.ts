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
import { demoCompanyJobsiteRows } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

const MAP_SELECT =
  "id, company_id, jobsite_id, generation_status, prompt_hash, ai_meta, scene_json, created_at, updated_at, created_by, updated_by";

const ZONE_SELECT =
  "id, company_id, jobsite_id, site_map_id, schedule_item_id, source_type, source_id, label, trade, work_area, starts_at, ends_at, risk_level, controls, color, position_x, position_y, position_z, size_x, size_y, size_z, metadata, created_at, updated_at";

function isMissingVisualSchema(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_site_maps") ||
    normalized.includes("company_jobsite_visual_zones") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find")
  );
}

function dbZoneToSceneZone(row: Record<string, unknown>): SiteVisualZone {
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
      canGenerate: true,
      canEditZones: true,
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
        canGenerate: canGenerateSiteMap(auth.role),
        canEditZones: canEditVisualZones(auth.role),
        warning: "Jobsite site visual tables are not available yet. Run the latest Supabase migration.",
      });
    }
    return NextResponse.json({ error: mapResult.error.message || "Failed to load site visual." }, { status: 500 });
  }

  if (!mapResult.data) {
    return NextResponse.json({
      jobsite: jobsiteResult.data,
      siteMap: null,
      scene: null,
      zones: [],
      canGenerate: canGenerateSiteMap(auth.role),
      canEditZones: canEditVisualZones(auth.role),
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

  return NextResponse.json({
    jobsite: jobsiteResult.data,
    siteMap: {
      id: mapResult.data.id,
      generationStatus: mapResult.data.generation_status,
      promptHash: mapResult.data.prompt_hash,
      aiMeta: mapResult.data.ai_meta ?? null,
      createdAt: mapResult.data.created_at,
      updatedAt: mapResult.data.updated_at,
    },
    scene: scene ? { ...scene, overlaps: detectSiteVisualOverlaps(zones) } : null,
    zones,
    canGenerate: canGenerateSiteMap(auth.role),
    canEditZones: canEditVisualZones(auth.role),
  });
}

export function canGenerateSiteMap(role: string) {
  return ["platform_admin", "super_admin", "admin", "company_admin", "manager", "safety_manager", "project_manager"].includes(role);
}

export function canEditVisualZones(role: string) {
  return canGenerateSiteMap(role) || ["field_supervisor", "foreman"].includes(role);
}

export { MAP_SELECT, ZONE_SELECT, dbZoneToSceneZone, isMissingVisualSchema };
