import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { getAiApiBaseUrl, resolveAiModelId, resolveAiProvider } from "@/lib/ai/platform";
import { extractResponsesApiUsage } from "@/lib/ai/callLog";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  cleanBlueprintTransform,
  defaultBlueprintTransform,
  type SiteVisualBlueprintInput,
} from "@/lib/jobsiteSiteBlueprint";
import {
  buildSiteVisualFallbackRenderSvg,
  buildSiteVisualRenderOverlay,
  buildSiteVisualRenderPrompt,
  extractResponsesImageBase64,
  siteVisualRenderImagePath,
  siteVisualRenderPromptHash,
  siteVisualRenderThumbnailPath,
  SITE_VISUAL_RENDER_BUCKET,
  type SiteVisualRenderOverlay,
  type SiteVisualRenderPromptInput,
} from "@/lib/jobsiteSiteRender";
import { sceneWithZones, type SiteVisualScene } from "@/lib/jobsiteSiteVisual";
import {
  BLUEPRINT_SELECT,
  MAP_SELECT,
  RENDER_SELECT,
  ZONE_SELECT,
  canGenerateSiteMap,
  dbRenderToPayload,
  dbZoneToSceneZone,
  isMissingVisualSchema,
} from "../../route";

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

async function createSignedPreviewUrl(previewPath: string | null) {
  if (!previewPath) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const signed = await admin.storage.from("documents").createSignedUrl(previewPath, 10 * 60);
  return signed.data?.signedUrl ?? null;
}

function blueprintInputFromRow(row: Record<string, unknown>): SiteVisualBlueprintInput {
  const width = Number(row.image_width ?? 1600);
  const height = Number(row.image_height ?? 1000);
  return {
    id: String(row.id),
    fileName: String(row.file_name ?? "Blueprint"),
    mimeType: String(row.mime_type ?? ""),
    width: Number.isFinite(width) ? width : 1600,
    height: Number.isFinite(height) ? height : 1000,
    pageNumber: Number(row.page_number ?? 1),
    transform: cleanBlueprintTransform(row.transform_json, defaultBlueprintTransform(width, height)),
  };
}

function normalizeImageBase64(value: string) {
  const marker = ";base64,";
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

function parseAiJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { message: text.slice(0, 500) } };
  }
}

function aiErrorMessageFromJson(status: number, json: unknown) {
  const apiError =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>).error
      : null;
  const apiMessage =
    apiError && typeof apiError === "object" && !Array.isArray(apiError)
      ? String((apiError as Record<string, unknown>).message ?? "")
      : "";
  return `OpenAI image generation failed with HTTP ${status}${apiMessage ? `: ${apiMessage}` : ""}.`;
}

async function buildDeterministicRenderImage(
  signedPreviewUrl: string,
  promptInput: SiteVisualRenderPromptInput,
  overlay: SiteVisualRenderOverlay
) {
  let blueprintDataUrl: string | null = null;
  const previewResponse = await fetch(signedPreviewUrl).catch(() => null);
  if (previewResponse?.ok) {
    const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
    const normalizedPreview = await sharp(previewBytes)
      .resize({ width: 1000, height: 620, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer()
      .catch(() => null);
    if (normalizedPreview) {
      blueprintDataUrl = `data:image/png;base64,${normalizedPreview.toString("base64")}`;
    }
  }
  const svg = buildSiteVisualFallbackRenderSvg(promptInput, overlay, blueprintDataUrl);
  return sharp(Buffer.from(svg)).png().toBuffer();
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
    return NextResponse.json({ error: "You do not have permission to generate detailed jobsite visuals." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`site-visual-render-generate:${auth.user.id}`, {
    windowMs: 5 * 60_000,
    max: 4,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many detailed visual generations. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { jobsiteId } = await params;
  const body = (await request.json().catch(() => null)) as { blueprintId?: string | null; siteMapId?: string | null } | null;
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

  let mapQuery = auth.supabase
    .from("company_jobsite_site_maps")
    .select(MAP_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .is("archived_at", null);
  if (body?.siteMapId) mapQuery = mapQuery.eq("id", body.siteMapId);
  const mapResult = await mapQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (mapResult.error) {
    if (isMissingVisualSchema(mapResult.error.message)) {
      return NextResponse.json({ error: "Jobsite site visual tables are not available yet. Run the latest Supabase migration." }, { status: 500 });
    }
    return NextResponse.json({ error: mapResult.error.message || "Failed to load site map." }, { status: 500 });
  }
  if (!mapResult.data) {
    return NextResponse.json({ error: "Generate the editable site map before creating a detailed visual." }, { status: 400 });
  }

  let blueprintQuery = auth.supabase
    .from("company_jobsite_site_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("processing_status", "ready")
    .is("archived_at", null);
  const requestedBlueprintId = typeof body?.blueprintId === "string" && body.blueprintId.trim() ? body.blueprintId.trim() : null;
  const linkedBlueprintId = mapResult.data.blueprint_id == null ? null : String(mapResult.data.blueprint_id);
  if (requestedBlueprintId || linkedBlueprintId) blueprintQuery = blueprintQuery.eq("id", requestedBlueprintId ?? linkedBlueprintId);
  const blueprintResult = await blueprintQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (blueprintResult.error) {
    if (isMissingVisualSchema(blueprintResult.error.message)) {
      return NextResponse.json({ error: "Blueprint tables are not available yet. Run the latest Supabase migration." }, { status: 500 });
    }
    return NextResponse.json({ error: blueprintResult.error.message || "Failed to load blueprint." }, { status: 500 });
  }
  if (!blueprintResult.data) {
    return NextResponse.json({ error: "Ready blueprint not found. Upload and process a blueprint before generating the detailed visual." }, { status: 404 });
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
  if (!scene || scene.zones.length === 0) {
    return NextResponse.json({ error: "No work zones are available for the detailed visual." }, { status: 400 });
  }

  const blueprint = blueprintInputFromRow(blueprintResult.data as Record<string, unknown>);
  const previewPath = blueprintResult.data.preview_image_path == null ? null : String(blueprintResult.data.preview_image_path);
  const signedPreviewUrl = await createSignedPreviewUrl(previewPath);
  if (!signedPreviewUrl) {
    return NextResponse.json({ error: "Blueprint preview URL could not be created." }, { status: 500 });
  }

  const overlay = buildSiteVisualRenderOverlay(scene);
  const promptInput: SiteVisualRenderPromptInput = {
    jobsite: {
      name: String(jobsiteResult.data.name ?? "Jobsite"),
      location: jobsiteResult.data.location ?? null,
      projectNumber: jobsiteResult.data.project_number ?? null,
      jobsiteNumber: jobsiteResult.data.jobsite_number ?? null,
    },
    blueprint,
    scene,
  };
  const prompt = buildSiteVisualRenderPrompt(promptInput, overlay);
  const promptHash = siteVisualRenderPromptHash(promptInput, overlay);
  const model = resolveAiModelId(process.env.JOBSITE_VISUAL_RENDER_MODEL?.trim() || "gpt-5");
  const provider = resolveAiProvider(model);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const renderId = randomUUID();
  const startedAt = Date.now();
  let usage: ReturnType<typeof extractResponsesApiUsage> = null;
  let revisedPrompt: string | null = null;
  let imageBytes: Buffer | null = null;
  let upstreamError: string | null = null;

  if (apiKey) {
    try {
      const aiResponse = await fetch(`${getAiApiBaseUrl()}/responses`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                { type: "input_image", image_url: signedPreviewUrl },
              ],
            },
          ],
          tools: [{ type: "image_generation", input_fidelity: "high", action: "auto" }],
        }),
      });
      const aiText = await aiResponse.text().catch(() => "");
      const aiJson = parseAiJson(aiText);
      usage = extractResponsesApiUsage(aiJson);
      const extracted = extractResponsesImageBase64(aiJson);
      revisedPrompt = extracted.revisedPrompt;
      if (aiResponse.ok && extracted.imageBase64) {
        imageBytes = Buffer.from(normalizeImageBase64(extracted.imageBase64), "base64");
      } else {
        upstreamError = aiResponse.ok ? "OpenAI did not return an image." : aiErrorMessageFromJson(aiResponse.status, aiJson);
      }
    } catch (error) {
      upstreamError = error instanceof Error ? error.message : "OpenAI image generation request failed.";
    }
  } else {
    upstreamError = "OPENAI_API_KEY is not configured.";
  }
  const latencyMs = Date.now() - startedAt;

  let fallbackUsed = false;
  let warning: string | null = null;
  if (!imageBytes) {
    fallbackUsed = true;
    imageBytes = await buildDeterministicRenderImage(signedPreviewUrl, promptInput, overlay);
    warning = `${upstreamError ?? "OpenAI image generation is unavailable."} A deterministic detailed visual was generated from the blueprint and work zones instead.`;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }

  const imageMetadata = await sharp(imageBytes).metadata();
  const thumbnailBytes = await sharp(imageBytes).resize({ width: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const imagePath = siteVisualRenderImagePath(companyScope.companyId, jobsiteId, renderId);
  const thumbnailPath = siteVisualRenderThumbnailPath(companyScope.companyId, jobsiteId, renderId);
  const imageUpload = await admin.storage.from(SITE_VISUAL_RENDER_BUCKET).upload(imagePath, imageBytes, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "3600",
  });
  if (imageUpload.error) {
    return NextResponse.json({ error: imageUpload.error.message || "Failed to save detailed visual." }, { status: 500 });
  }
  const thumbnailUpload = await admin.storage.from(SITE_VISUAL_RENDER_BUCKET).upload(thumbnailPath, thumbnailBytes, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });
  if (thumbnailUpload.error) {
    return NextResponse.json({ error: thumbnailUpload.error.message || "Failed to save detailed visual thumbnail." }, { status: 500 });
  }

  const insert = await auth.supabase
    .from("company_jobsite_site_renders")
    .insert({
      id: renderId,
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      site_map_id: mapResult.data.id,
      blueprint_id: blueprint.id,
      render_status: "ready",
      prompt_hash: promptHash,
      image_path: imagePath,
      thumbnail_path: thumbnailPath,
      image_width: imageMetadata.width ?? null,
      image_height: imageMetadata.height ?? null,
      overlay_json: overlay,
      ai_meta: {
        model,
        provider,
        promptHash,
        latencyMs,
        usage,
        revisedPrompt,
        fallbackUsed,
        upstreamError,
        surface: "jobsite.site-visual.render.generate",
      },
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(RENDER_SELECT)
    .single();
  if (insert.error) {
    if (isMissingVisualSchema(insert.error.message)) {
      return NextResponse.json({ error: "Detailed visual render table is not available yet. Run the latest Supabase migration." }, { status: 500 });
    }
    return NextResponse.json({ error: insert.error.message || "Failed to save detailed visual record." }, { status: 500 });
  }

  return NextResponse.json({
    render: await dbRenderToPayload(insert.data as Record<string, unknown>),
    scene,
    zones,
    warning,
  });
}
