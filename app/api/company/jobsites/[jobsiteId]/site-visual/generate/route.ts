import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { runStructuredAiJsonTask } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import {
  SITE_VISUAL_SCENE_JSON_SCHEMA,
  buildFallbackSiteVisualScene,
  buildSiteVisualAiPrompt,
  sceneWithZones,
  siteVisualPromptHash,
  validateSiteVisualScene,
  type SiteVisualGenerationInput,
  type SiteVisualRiskLevel,
  type SiteVisualScene,
  type SiteVisualWorkItem,
  type SiteVisualZone,
} from "@/lib/jobsiteSiteVisual";
import {
  MAP_SELECT,
  ZONE_SELECT,
  canGenerateSiteMap,
  dbZoneToSceneZone,
  isMissingVisualSchema,
} from "../route";

export const runtime = "nodejs";

const SCHEDULE_SELECT =
  "id, title, work_start_date, work_end_date, shift_start_time, shift_end_time, trade, work_area, risk_level, required_controls, hazard_categories, permit_triggers, status";

function riskLevel(value: unknown): SiteVisualRiskLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["low", "medium", "high", "critical"].includes(normalized)
    ? (normalized as SiteVisualRiskLevel)
    : "medium";
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function scheduleRowToWorkItem(row: Record<string, unknown>): SiteVisualWorkItem {
  return {
    id: String(row.id),
    sourceType: "schedule",
    title: String(row.title ?? "Scheduled work"),
    trade: row.trade == null ? null : String(row.trade),
    workArea: row.work_area == null ? null : String(row.work_area),
    workStartDate: row.work_start_date == null ? null : String(row.work_start_date),
    workEndDate: row.work_end_date == null ? null : String(row.work_end_date),
    shiftStartTime: row.shift_start_time == null ? null : String(row.shift_start_time).slice(0, 5),
    shiftEndTime: row.shift_end_time == null ? null : String(row.shift_end_time).slice(0, 5),
    riskLevel: riskLevel(row.risk_level),
    controls: strings(row.required_controls),
    hazardCategories: strings(row.hazard_categories),
    permitTriggers: strings(row.permit_triggers),
  };
}

function jsaRowToWorkItem(row: Record<string, unknown>): SiteVisualWorkItem {
  return {
    id: String(row.id),
    sourceType: "jsa_activity",
    title: String(row.activity_name ?? "JSA activity"),
    trade: row.trade == null ? null : String(row.trade),
    workArea: row.area == null ? null : String(row.area),
    workStartDate: row.work_date == null ? null : String(row.work_date),
    workEndDate: row.work_date == null ? null : String(row.work_date),
    riskLevel: riskLevel(row.planned_risk_level),
    controls: [row.mitigation == null ? "" : String(row.mitigation)].filter(Boolean),
    hazardCategories: [row.hazard_category == null ? "" : String(row.hazard_category)].filter(Boolean),
    permitTriggers: [row.permit_type == null ? "" : String(row.permit_type)].filter(Boolean),
  };
}

function permitRowToWorkItem(row: Record<string, unknown>): SiteVisualWorkItem {
  return {
    id: String(row.id),
    sourceType: "permit",
    title: String(row.title ?? row.permit_type ?? "Permit work"),
    trade: null,
    workArea: null,
    workStartDate: row.due_at == null ? null : String(row.due_at).slice(0, 10),
    workEndDate: row.due_at == null ? null : String(row.due_at).slice(0, 10),
    riskLevel: riskLevel(row.severity),
    controls: [],
    hazardCategories: [row.category == null ? "" : String(row.category)].filter(Boolean),
    permitTriggers: [row.permit_type == null ? "" : String(row.permit_type)].filter(Boolean),
  };
}

function observationRowToWorkItem(row: Record<string, unknown>): SiteVisualWorkItem {
  const title = String(row.title ?? "Observation");
  const workArea = title.includes("-") ? title.split("-")[0]?.trim() : null;
  return {
    id: String(row.id),
    sourceType: "observation",
    title,
    trade: row.category == null ? null : String(row.category),
    workArea,
    workStartDate: row.due_at == null ? String(row.created_at ?? "").slice(0, 10) : String(row.due_at).slice(0, 10),
    workEndDate: row.due_at == null ? String(row.created_at ?? "").slice(0, 10) : String(row.due_at).slice(0, 10),
    riskLevel: riskLevel(row.severity),
    controls: [],
    hazardCategories: [row.category == null ? "" : String(row.category)].filter(Boolean),
    permitTriggers: [],
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

async function safeData<T>(
  query: PromiseLike<{ data: T | null; error: { message?: string | null } | null }>
) {
  const result = await query;
  if (result.error && !isMissingVisualSchema(result.error.message)) {
    return { data: null, warning: result.error.message || "A source table could not be loaded." };
  }
  return { data: result.data, warning: null };
}

function zoneInsertRows(params: {
  companyId: string;
  jobsiteId: string;
  siteMapId: string;
  userId: string;
  zones: SiteVisualZone[];
}) {
  return params.zones.map((zone) => ({
    company_id: params.companyId,
    jobsite_id: params.jobsiteId,
    site_map_id: params.siteMapId,
    schedule_item_id: zone.scheduleItemId,
    source_type: zone.sourceType,
    source_id: zone.sourceId,
    label: zone.label,
    trade: zone.trade,
    work_area: zone.workArea,
    starts_at: zone.startsAt,
    ends_at: zone.endsAt,
    risk_level: zone.riskLevel,
    controls: zone.controls,
    color: zone.color,
    position_x: zone.position.x,
    position_y: zone.position.y,
    position_z: zone.position.z,
    size_x: zone.size.x,
    size_y: zone.size.y,
    size_z: zone.size.z,
    metadata: {},
    created_by: params.userId,
    updated_by: params.userId,
  }));
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
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return auth.error;
  if (!canGenerateSiteMap(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to generate jobsite site visuals." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`site-visual-generate:${auth.user.id}`, {
    windowMs: 60_000,
    max: 10,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many site visual generations. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { jobsiteId } = await params;
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

  const [schedule, activities, permits, observations] = await Promise.all([
    safeData(
      auth.supabase
        .from("company_jobsite_schedule_items")
        .select(SCHEDULE_SELECT)
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .is("archived_at", null)
        .order("work_start_date", { ascending: true })
        .limit(100)
    ),
    safeData(
      auth.supabase
        .from("company_jsa_activities")
        .select("id, activity_name, area, trade, work_date, planned_risk_level, hazard_category, mitigation, permit_type, status")
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .limit(100)
    ),
    safeData(
      auth.supabase
        .from("company_permits")
        .select("id, title, permit_type, status, severity, category, due_at")
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .limit(100)
    ),
    safeData(
      auth.supabase
        .from("company_corrective_actions")
        .select("id, title, category, severity, status, due_at, created_at")
        .eq("company_id", companyScope.companyId)
        .eq("jobsite_id", jobsiteId)
        .limit(100)
    ),
  ]);

  const items: SiteVisualWorkItem[] = [
    ...(((schedule.data ?? []) as Record<string, unknown>[]).map(scheduleRowToWorkItem)),
    ...(((activities.data ?? []) as Record<string, unknown>[]).map(jsaRowToWorkItem)),
    ...(((permits.data ?? []) as Record<string, unknown>[]).map(permitRowToWorkItem)),
    ...(((observations.data ?? []) as Record<string, unknown>[]).map(observationRowToWorkItem)),
  ].slice(0, 160);

  const input: SiteVisualGenerationInput = {
    jobsite: {
      id: String(jobsiteResult.data.id),
      name: String(jobsiteResult.data.name ?? "Jobsite"),
      location: jobsiteResult.data.location ?? null,
      projectNumber: jobsiteResult.data.project_number ?? null,
      jobsiteNumber: jobsiteResult.data.jobsite_number ?? null,
    },
    items,
  };

  const fallback = buildFallbackSiteVisualScene(input);
  const ai = await runStructuredAiJsonTask<Partial<SiteVisualScene>>({
    modelEnv: process.env.JOBSITE_VISUAL_AI_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: resolveCompanyAiDefaultModel("gpt-4o-mini"),
    system:
      "You create structured schematic 3D site maps for construction safety planning. Return strict JSON only and do not claim engineering or BIM accuracy.",
    user: buildSiteVisualAiPrompt(input),
    fallback,
    surface: "jobsite.site-visual.generate",
    maxAttempts: 2,
    body: {
      text: {
        format: {
          type: "json_schema",
          name: "jobsite_site_visual_scene",
          schema: SITE_VISUAL_SCENE_JSON_SCHEMA,
          strict: true,
        },
      },
    },
  });

  const scene = validateSiteVisualScene(ai.parsed, input);
  const aiMeta = {
    model: ai.meta.model,
    provider: ai.meta.provider,
    promptHash: ai.meta.promptHash,
    fallbackUsed: ai.meta.fallbackUsed,
    fallbackReason: ai.meta.fallbackReason,
    attempts: ai.meta.attempts,
    latencyMs: ai.meta.latencyMs,
    usage: ai.meta.usage,
    surface: ai.meta.surface,
    sourceWarnings: [schedule.warning, activities.warning, permits.warning, observations.warning].filter(Boolean),
  };

  const insertMap = await auth.supabase
    .from("company_jobsite_site_maps")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      generation_status: ai.meta.fallbackUsed ? "fallback" : "ready",
      prompt_hash: siteVisualPromptHash(input),
      ai_meta: aiMeta,
      scene_json: scene,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(MAP_SELECT)
    .single();

  if (insertMap.error) {
    if (isMissingVisualSchema(insertMap.error.message)) {
      return NextResponse.json(
        { error: "Jobsite site visual tables are not available yet. Run the latest Supabase migration." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insertMap.error.message || "Failed to save generated site visual." }, { status: 500 });
  }

  const zoneRows = zoneInsertRows({
    companyId: companyScope.companyId,
    jobsiteId,
    siteMapId: String(insertMap.data.id),
    userId: auth.user.id,
    zones: scene.zones,
  });

  let zones = scene.zones;
  if (zoneRows.length > 0) {
    const insertZones = await auth.supabase
      .from("company_jobsite_visual_zones")
      .insert(zoneRows)
      .select(ZONE_SELECT);
    if (insertZones.error) {
      return NextResponse.json({ error: insertZones.error.message || "Failed to save generated work zones." }, { status: 500 });
    }
    zones = ((insertZones.data ?? []) as Record<string, unknown>[]).map(dbZoneToSceneZone);
  }

  const savedScene = sceneWithZones(scene, zones);
  await auth.supabase
    .from("company_jobsite_site_maps")
    .update({ scene_json: savedScene, updated_by: auth.user.id })
    .eq("id", insertMap.data.id)
    .eq("company_id", companyScope.companyId);

  return NextResponse.json({
    jobsite: jobsiteResult.data,
    siteMap: {
      id: insertMap.data.id,
      generationStatus: insertMap.data.generation_status,
      promptHash: insertMap.data.prompt_hash,
      aiMeta,
      createdAt: insertMap.data.created_at,
      updatedAt: insertMap.data.updated_at,
    },
    scene: savedScene,
    zones,
    canGenerate: true,
    canEditZones: true,
  });
}
