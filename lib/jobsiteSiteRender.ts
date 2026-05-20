import { createHash } from "node:crypto";
import type { SiteVisualBlueprintInput } from "@/lib/jobsiteSiteBlueprint";
import type { SiteVisualOverlap, SiteVisualScene, SiteVisualZone } from "@/lib/jobsiteSiteVisual";

export type SiteVisualRenderOverlayActivity = {
  id: string;
  zoneId: string;
  number: number;
  label: string;
  subtitle: string;
  riskLevel: SiteVisualZone["riskLevel"];
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SiteVisualRenderOverlay = {
  version: 1;
  imageAspect: "16:9";
  disclaimer: string;
  activities: SiteVisualRenderOverlayActivity[];
  overlaps: Array<{
    id: string;
    zoneIds: [string, string];
    severity: SiteVisualOverlap["severity"];
    label: string;
    reason: string;
    x: number;
    y: number;
  }>;
};

export type SiteVisualRenderPromptInput = {
  jobsite: {
    name: string;
    location?: string | null;
    projectNumber?: string | null;
    jobsiteNumber?: string | null;
  };
  blueprint: SiteVisualBlueprintInput;
  scene: SiteVisualScene;
};

export const SITE_VISUAL_RENDER_BUCKET = "documents";
export const SITE_VISUAL_RENDER_DISCLAIMER = "Operational visual aid, not engineering drawing.";

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function colorForRisk(riskLevel: SiteVisualZone["riskLevel"]) {
  if (riskLevel === "critical") return "#ef4444";
  if (riskLevel === "high") return "#f97316";
  if (riskLevel === "medium") return "#f59e0b";
  return "#10b981";
}

function zoneCenter(zone: SiteVisualZone, scene: SiteVisualScene) {
  if (zone.blueprintBounds) {
    return {
      x: clamp(zone.blueprintBounds.x + zone.blueprintBounds.width / 2, 0.08, 0.92, 0.5),
      y: clamp(zone.blueprintBounds.y + zone.blueprintBounds.height / 2, 0.12, 0.88, 0.5),
    };
  }
  const xs = scene.zones.map((item) => item.position.x);
  const zs = scene.zones.map((item) => item.position.z);
  const minX = Math.min(...xs, -24);
  const maxX = Math.max(...xs, 24);
  const minZ = Math.min(...zs, -18);
  const maxZ = Math.max(...zs, 18);
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  return {
    x: clamp((zone.position.x - minX) / spanX, 0.08, 0.92, 0.5),
    y: clamp((zone.position.z - minZ) / spanZ, 0.12, 0.88, 0.5),
  };
}

export function cleanSiteVisualRenderOverlay(value: unknown): SiteVisualRenderOverlay {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const activities = Array.isArray(record.activities) ? record.activities : [];
  const overlaps = Array.isArray(record.overlaps) ? record.overlaps : [];
  return {
    version: 1,
    imageAspect: "16:9",
    disclaimer: SITE_VISUAL_RENDER_DISCLAIMER,
    activities: activities.slice(0, 12).map((item, index) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const riskLevel = String(row.riskLevel ?? "medium") as SiteVisualZone["riskLevel"];
      return {
        id: String(row.id ?? `activity-${index + 1}`),
        zoneId: String(row.zoneId ?? row.id ?? `zone-${index + 1}`),
        number: Math.max(1, Math.min(99, Math.trunc(Number(row.number ?? index + 1) || index + 1))),
        label: String(row.label ?? `Work activity ${index + 1}`).slice(0, 80),
        subtitle: String(row.subtitle ?? "").slice(0, 90),
        riskLevel,
        color: typeof row.color === "string" && /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : colorForRisk(riskLevel),
        x: clamp(row.x, 0.02, 0.98, 0.5),
        y: clamp(row.y, 0.02, 0.98, 0.5),
        width: clamp(row.width, 0.05, 0.32, 0.16),
        height: clamp(row.height, 0.04, 0.2, 0.09),
      };
    }),
    overlaps: overlaps.slice(0, 12).map((item, index) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const zoneIds = Array.isArray(row.zoneIds) ? row.zoneIds.map(String).slice(0, 2) : [];
      return {
        id: String(row.id ?? `overlap-${index + 1}`),
        zoneIds: [zoneIds[0] ?? "", zoneIds[1] ?? ""] as [string, string],
        severity: String(row.severity ?? "medium") as SiteVisualOverlap["severity"],
        label: String(row.label ?? `Overlap ${index + 1}`).slice(0, 120),
        reason: String(row.reason ?? "").slice(0, 220),
        x: clamp(row.x, 0.02, 0.98, 0.5),
        y: clamp(row.y, 0.02, 0.98, 0.5),
      };
    }),
  };
}

export function buildSiteVisualRenderOverlay(scene: SiteVisualScene): SiteVisualRenderOverlay {
  const priorityZones = [...scene.zones].sort((left, right) => {
    const riskRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return riskRank[right.riskLevel] - riskRank[left.riskLevel];
  });
  const activities = priorityZones.slice(0, 7).map((zone, index) => {
    const center = zoneCenter(zone, scene);
    return {
      id: `activity-${index + 1}`,
      zoneId: zone.id,
      number: index + 1,
      label: zone.label,
      subtitle: zone.trade ?? zone.workArea ?? "Field work",
      riskLevel: zone.riskLevel,
      color: colorForRisk(zone.riskLevel),
      x: center.x,
      y: center.y,
      width: 0.16,
      height: 0.08,
    };
  });
  const overlaysByZone = new Map(activities.map((activity) => [activity.zoneId, activity]));
  const overlaps = scene.overlaps.slice(0, 10).map((overlap, index) => {
    const first = overlaysByZone.get(overlap.zoneIds[0]);
    const second = overlaysByZone.get(overlap.zoneIds[1]);
    return {
      id: overlap.id || `overlap-${index + 1}`,
      zoneIds: overlap.zoneIds,
      severity: overlap.severity,
      label: overlap.label,
      reason: overlap.reason,
      x: first && second ? (first.x + second.x) / 2 : first?.x ?? second?.x ?? 0.5,
      y: first && second ? (first.y + second.y) / 2 : first?.y ?? second?.y ?? 0.5,
    };
  });
  return cleanSiteVisualRenderOverlay({
    version: 1,
    imageAspect: "16:9",
    disclaimer: SITE_VISUAL_RENDER_DISCLAIMER,
    activities,
    overlaps,
  });
}

export function siteVisualRenderStoragePrefix(companyId: string, jobsiteId: string, renderId: string) {
  return `companies/${companyId}/jobsites/${jobsiteId}/site-visual/renders/${renderId}`;
}

export function siteVisualRenderImagePath(companyId: string, jobsiteId: string, renderId: string) {
  return `${siteVisualRenderStoragePrefix(companyId, jobsiteId, renderId)}/render.png`;
}

export function siteVisualRenderThumbnailPath(companyId: string, jobsiteId: string, renderId: string) {
  return `${siteVisualRenderStoragePrefix(companyId, jobsiteId, renderId)}/thumbnail.webp`;
}

export function buildSiteVisualRenderPrompt(input: SiteVisualRenderPromptInput, overlay = buildSiteVisualRenderOverlay(input.scene)) {
  const activities = overlay.activities.map((activity) => ({
    number: activity.number,
    label: activity.label,
    subtitle: activity.subtitle,
    riskLevel: activity.riskLevel,
    color: activity.color,
  }));
  const overlaps = overlay.overlaps.map((overlap) => ({
    severity: overlap.severity,
    label: overlap.label,
    reason: overlap.reason,
  }));
  return [
    `Create a detailed isometric construction safety visual for ${input.jobsite.name}.`,
    "Use the attached blueprint preview as the layout reference, but transform it into a polished multi-level construction cutaway scene.",
    "Match this style: realistic active jobsite, exposed floors and framing, roof/work deck, facade/scaffold/lifts, materials, equipment, visible workers in PPE, numbered colored work-activity callouts, left activity legend, right overlap/safety insight panels.",
    "Use a wide 16:9 composition. Make labels readable. Keep the result professional and visually understandable.",
    "Do not present this as BIM, engineering, or measurement-accurate. It is an operational safety planning visual.",
    `Blueprint: ${input.blueprint.fileName}, page ${input.blueprint.pageNumber}.`,
    `Work activities to depict: ${JSON.stringify(activities)}.`,
    `Overlapping work insights to depict subtly: ${JSON.stringify(overlaps)}.`,
  ].join("\n");
}

export function siteVisualRenderPromptHash(input: SiteVisualRenderPromptInput, overlay = buildSiteVisualRenderOverlay(input.scene)) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        jobsite: input.jobsite,
        blueprint: {
          id: input.blueprint.id,
          fileName: input.blueprint.fileName,
          pageNumber: input.blueprint.pageNumber,
          width: input.blueprint.width,
          height: input.blueprint.height,
        },
        zones: input.scene.zones.map((zone) => ({
          id: zone.id,
          label: zone.label,
          trade: zone.trade,
          workArea: zone.workArea,
          riskLevel: zone.riskLevel,
          startsAt: zone.startsAt,
          endsAt: zone.endsAt,
          blueprintBounds: zone.blueprintBounds ?? null,
        })),
        overlaps: input.scene.overlaps,
        overlay,
      })
    )
    .digest("hex");
}

export function extractResponsesImageBase64(json: unknown): { imageBase64: string | null; revisedPrompt: string | null } {
  if (!json || typeof json !== "object") return { imageBase64: null, revisedPrompt: null };
  const output = (json as Record<string, unknown>).output;
  if (!Array.isArray(output)) return { imageBase64: null, revisedPrompt: null };
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type === "image_generation_call" && typeof record.result === "string" && record.result.trim()) {
      return {
        imageBase64: record.result.trim(),
        revisedPrompt: typeof record.revised_prompt === "string" ? record.revised_prompt : null,
      };
    }
  }
  return { imageBase64: null, revisedPrompt: null };
}
