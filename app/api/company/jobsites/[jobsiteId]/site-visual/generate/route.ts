import { after, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { runStructuredAiJsonTask } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  cleanBlueprintTransform,
  defaultBlueprintTransform,
  type SiteVisualBlueprintInput,
} from "@/lib/jobsiteSiteBlueprint";
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
  BLUEPRINT_SELECT,
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

async function updateGenerationJob(jobId: string | null | undefined, row: Record<string, unknown>) {
  if (!jobId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("ai_visual_generation_jobs")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", jobId);
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
    metadata: { blueprintBounds: zone.blueprintBounds ?? null },
    created_by: params.userId,
    updated_by: params.userId,
  }));
}

async function loadReadyBlueprint(params: {
  supabase: SupabaseClient;
  companyId: string;
  jobsiteId: string;
  blueprintId?: string | null;
}): Promise<{ blueprint: SiteVisualBlueprintInput | null; signedPreviewUrl: string | null; error?: string }> {
  let query = params.supabase
    .from("company_jobsite_site_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("company_id", params.companyId)
    .eq("jobsite_id", params.jobsiteId)
    .eq("processing_status", "ready")
    .is("archived_at", null);
  if (params.blueprintId) query = query.eq("id", params.blueprintId);
  const result = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) return { blueprint: null, signedPreviewUrl: null, error: result.error.message };
  if (!result.data) return { blueprint: null, signedPreviewUrl: null };

  const width = Number(result.data.image_width ?? 1600);
  const height = Number(result.data.image_height ?? 1000);
  const blueprint: SiteVisualBlueprintInput = {
    id: String(result.data.id),
    fileName: String(result.data.file_name ?? "Blueprint"),
    mimeType: String(result.data.mime_type ?? ""),
    width: Number.isFinite(width) ? width : 1600,
    height: Number.isFinite(height) ? height : 1000,
    pageNumber: Number(result.data.page_number ?? 1),
    transform: cleanBlueprintTransform(result.data.transform_json, defaultBlueprintTransform(width, height)),
  };
  const previewPath = result.data.preview_image_path == null ? null : String(result.data.preview_image_path);
  let signedPreviewUrl: string | null = null;
  if (previewPath) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const signed = await admin.storage.from("documents").createSignedUrl(previewPath, 10 * 60);
      signedPreviewUrl = signed.data?.signedUrl ?? null;
    }
  }
  return { blueprint, signedPreviewUrl };
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

  const { searchParams } = new URL(request.url);
  const runSynchronously = searchParams.get("sync") === "1";
  const { jobsiteId } = await params;
  const body = (await request.json().catch(() => null)) as { blueprintId?: string | null; jobId?: string | null } | null;
  const jobId = typeof body?.jobId === "string" && body.jobId.trim() ? body.jobId.trim() : null;
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

  const requestedBlueprintId = typeof body?.blueprintId === "string" && body.blueprintId.trim() ? body.blueprintId.trim() : null;
  const blueprintResult = await loadReadyBlueprint({
    supabase: auth.supabase,
    companyId: companyScope.companyId,
    jobsiteId,
    blueprintId: requestedBlueprintId,
  });
  if (blueprintResult.error && !isMissingVisualSchema(blueprintResult.error)) {
    return NextResponse.json({ error: blueprintResult.error || "Failed to load blueprint." }, { status: 500 });
  }
  if (requestedBlueprintId && !blueprintResult.blueprint) {
    return NextResponse.json({ error: "Ready blueprint not found. Process the blueprint before generating the map." }, { status: 404 });
  }

  const input: SiteVisualGenerationInput = {
    jobsite: {
      id: String(jobsiteResult.data.id),
      name: String(jobsiteResult.data.name ?? "Jobsite"),
      location: jobsiteResult.data.location ?? null,
      projectNumber: jobsiteResult.data.project_number ?? null,
      jobsiteNumber: jobsiteResult.data.jobsite_number ?? null,
    },
    items,
    blueprint: blueprintResult.blueprint,
  };

  const fallback = buildFallbackSiteVisualScene(input);
  const userPrompt = buildSiteVisualAiPrompt(input);
  const promptHash = siteVisualPromptHash(input);
  const contextHash = promptHash;

  if (!runSynchronously) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
    }
    const insertJob = await admin
      .from("ai_visual_generation_jobs")
      .insert({
        company_id: companyScope.companyId,
        jobsite_id: jobsiteId,
        blueprint_id: blueprintResult.blueprint?.id ?? null,
        surface: "jobsite.site-visual.generate",
        status: "queued",
        progress: 5,
        stage: "queued",
        prompt_hash: promptHash,
        context_hash: contextHash,
        token_budget: 8000,
        input_snapshot: {
          blueprintId: blueprintResult.blueprint?.id ?? null,
          workItemCount: items.length,
          hasCompressedBlueprintPreview: Boolean(blueprintResult.signedPreviewUrl),
          stagedWorkflow: ["classify_scene", "identify_risks", "generate_recommendation", "render_final_response"],
        },
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id,created_at,status,progress,stage")
      .single();
    if (insertJob.error) {
      return NextResponse.json({ error: insertJob.error.message || "Failed to queue site visual generation." }, { status: 500 });
    }

    const syncUrl = new URL(request.url);
    syncUrl.searchParams.set("sync", "1");
    const authorization = request.headers.get("authorization") ?? "";
    const cookie = request.headers.get("cookie") ?? "";
    const queuedJobId = String(insertJob.data.id);
    after(async () => {
      try {
        const response = await fetch(syncUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify({
            blueprintId: blueprintResult.blueprint?.id ?? null,
            jobId: queuedJobId,
          }),
          cache: "no-store",
        });
        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as { error?: string } | null;
          await updateGenerationJob(queuedJobId, {
            status: "failed",
            progress: 100,
            stage: "failed",
            completed_at: new Date().toISOString(),
            error_message: failure?.error ?? `Site visual worker returned HTTP ${response.status}.`,
          });
        }
      } catch (error) {
        await updateGenerationJob(queuedJobId, {
          status: "failed",
          progress: 100,
          stage: "failed",
          completed_at: new Date().toISOString(),
          error_type: "worker_exception",
          error_message: error instanceof Error ? error.message : "Site visual worker failed.",
        });
      }
    });

    return NextResponse.json(
      {
        job: {
          id: queuedJobId,
          status: "queued",
          progress: 5,
          stage: "queued",
          statusUrl: `/api/company/jobsites/${jobsiteId}/site-visual/jobs/${queuedJobId}`,
        },
      },
      { status: 202 }
    );
  }

  await updateGenerationJob(jobId, {
    status: "running",
    progress: 20,
    stage: "classify_scene",
    started_at: new Date().toISOString(),
  });

  const inputOverride = blueprintResult.signedPreviewUrl
    ? [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You create structured schematic 3D site maps for construction safety planning. Return strict JSON only and do not claim engineering or BIM accuracy.",
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            { type: "input_image", image_url: blueprintResult.signedPreviewUrl },
          ],
        },
      ]
    : undefined;
  const ai = await runStructuredAiJsonTask<Partial<SiteVisualScene>>({
    modelEnv: process.env.JOBSITE_VISUAL_AI_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: resolveCompanyAiDefaultModel("gpt-4o-mini"),
    system:
      "You create structured schematic 3D site maps for construction safety planning. Return strict JSON only and do not claim engineering or BIM accuracy.",
    user: userPrompt,
    inputOverride,
    fallback,
    surface: "jobsite.site-visual.generate",
    promptVersion: "jobsite-site-visual-generate-v1",
    outputSchemaVersion: "site-visual-scene-v1",
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
    sourceUsage: blueprintResult.blueprint ? "reference_only" : "structured_data_only",
    sourceWarnings: [schedule.warning, activities.warning, permits.warning, observations.warning].filter(Boolean),
  };

  const insertMap = await auth.supabase
    .from("company_jobsite_site_maps")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      generation_status: ai.meta.fallbackUsed ? "fallback" : "ready",
      prompt_hash: promptHash,
      ai_meta: aiMeta,
      scene_json: scene,
      blueprint_id: blueprintResult.blueprint?.id ?? null,
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

  await updateGenerationJob(jobId, {
    status: ai.meta.fallbackUsed ? "fallback_ready" : "ready",
    progress: 100,
    stage: ai.meta.fallbackUsed ? "fallback_ready" : "ready",
    completed_at: new Date().toISOString(),
    site_map_id: insertMap.data.id,
    prompt_hash: promptHash,
    context_hash: contextHash,
    ai_meta: aiMeta,
    result_snapshot: {
      siteMapId: insertMap.data.id,
      blueprintId: insertMap.data.blueprint_id ?? null,
      zoneCount: zones.length,
      fallbackUsed: ai.meta.fallbackUsed,
    },
    error_type: ai.meta.errorType ?? null,
    error_message: ai.meta.fallbackReason ?? null,
  });

  return NextResponse.json({
    jobsite: jobsiteResult.data,
    siteMap: {
      id: insertMap.data.id,
      blueprintId: insertMap.data.blueprint_id ?? null,
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
