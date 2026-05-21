import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { detectSiteVisualOverlaps, sceneWithZones, type SiteVisualScene } from "@/lib/jobsiteSiteVisual";
import { ZONE_SELECT, canEditVisualZones, dbZoneToSceneZone } from "../route";

export const runtime = "nodejs";

type ZonePatchBody = {
  zoneId?: string;
  label?: string;
  position?: { x?: number; y?: number; z?: number };
  size?: { x?: number; y?: number; z?: number };
  color?: string;
  riskLevel?: string;
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanColor(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : null;
}

function cleanRisk(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["low", "medium", "high", "critical"].includes(text) ? text : null;
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

export async function PATCH(
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
  if (!canEditVisualZones(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to edit site visual zones." }, { status: 403 });
  }

  const { jobsiteId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as ZonePatchBody | null;
  const zoneId = String(body?.zoneId ?? "").trim();
  if (!zoneId) return NextResponse.json({ error: "zoneId is required." }, { status: 400 });

  const existing = await auth.supabase
    .from("company_jobsite_visual_zones")
    .select(ZONE_SELECT)
    .eq("id", zoneId)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: existing.error.message || "Failed to load visual zone." }, { status: 500 });
  }
  if (!existing.data) return NextResponse.json({ error: "Visual zone not found." }, { status: 404 });

  const updateValues = {
    ...(typeof body?.label === "string" ? { label: body.label.trim() } : {}),
    ...(body?.position
      ? {
          position_x: clamp(body.position.x, -80, 80, Number(existing.data.position_x ?? 0)),
          position_y: clamp(body.position.y, 0, 30, Number(existing.data.position_y ?? 0.5)),
          position_z: clamp(body.position.z, -80, 80, Number(existing.data.position_z ?? 0)),
        }
      : {}),
    ...(body?.size
      ? {
          size_x: clamp(body.size.x, 0.5, 30, Number(existing.data.size_x ?? 4)),
          size_y: clamp(body.size.y, 0.25, 12, Number(existing.data.size_y ?? 1)),
          size_z: clamp(body.size.z, 0.5, 30, Number(existing.data.size_z ?? 4)),
        }
      : {}),
    ...(cleanColor(body?.color) ? { color: cleanColor(body?.color) } : {}),
    ...(cleanRisk(body?.riskLevel) ? { risk_level: cleanRisk(body?.riskLevel) } : {}),
    updated_by: auth.user.id,
  };

  if ("label" in updateValues && !String(updateValues.label ?? "").trim()) {
    return NextResponse.json({ error: "Zone label cannot be empty." }, { status: 400 });
  }

  const update = await auth.supabase
    .from("company_jobsite_visual_zones")
    .update(updateValues)
    .eq("id", zoneId)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .select(ZONE_SELECT)
    .single();

  if (update.error) {
    return NextResponse.json({ error: update.error.message || "Failed to update visual zone." }, { status: 500 });
  }

  const allZones = await auth.supabase
    .from("company_jobsite_visual_zones")
    .select(ZONE_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("site_map_id", update.data.site_map_id)
    .order("created_at", { ascending: true });

  if (allZones.error) {
    return NextResponse.json({ error: allZones.error.message || "Failed to reload visual zones." }, { status: 500 });
  }

  const zones = ((allZones.data ?? []) as Record<string, unknown>[]).map(dbZoneToSceneZone);
  const map = await auth.supabase
    .from("company_jobsite_site_maps")
    .select("id, scene_json")
    .eq("id", update.data.site_map_id)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .maybeSingle();

  const scene = map.data?.scene_json
    ? sceneWithZones(map.data.scene_json as SiteVisualScene, zones)
    : null;
  if (scene) {
    await auth.supabase
      .from("company_jobsite_site_maps")
      .update({ scene_json: scene, updated_by: auth.user.id })
      .eq("id", update.data.site_map_id)
      .eq("company_id", companyScope.companyId)
      .eq("jobsite_id", jobsiteId);
  }

  return NextResponse.json({
    success: true,
    zone: dbZoneToSceneZone(update.data as Record<string, unknown>),
    zones,
    overlaps: detectSiteVisualOverlaps(zones),
    scene,
  });
}
