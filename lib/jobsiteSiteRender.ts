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

function zoneLevelIndex(zone: SiteVisualZone, scene: SiteVisualScene) {
  if (!scene.levels.length) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  scene.levels.forEach((level, index) => {
    const distance = Math.abs(zone.position.y - level.elevation);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function cutawayPointForZone(zone: SiteVisualZone, scene: SiteVisualScene) {
  const center = zoneCenter(zone, scene);
  const levelCount = Math.min(5, Math.max(3, scene.levels.length || 1));
  const levelIndex = Math.min(levelCount - 1, zoneLevelIndex(zone, scene));
  const topToBottomIndex = levelCount - 1 - levelIndex;
  const plateLeft = 0.24 - topToBottomIndex * 0.012;
  const plateTop = 0.16 + topToBottomIndex * 0.13;
  const plateWidth = 0.48;
  const plateHeight = 0.18;
  const perspectiveShift = (center.y - 0.5) * 0.13;
  return {
    x: clamp(plateLeft + center.x * plateWidth + perspectiveShift, 0.16, 0.82, 0.5),
    y: clamp(plateTop + center.y * plateHeight, 0.14, 0.82, 0.5),
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
    const center = cutawayPointForZone(zone, scene);
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

function escapeSvgText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSiteVisualFallbackRenderSvg(
  input: SiteVisualRenderPromptInput,
  overlay = buildSiteVisualRenderOverlay(input.scene),
  blueprintDataUrl?: string | null
) {
  const width = 1600;
  const height = 900;
  const levels = [...input.scene.levels].sort((left, right) => right.elevation - left.elevation);
  const floorCount = Math.min(5, Math.max(3, levels.length || 1));
  const deckColors = ["#f8fafc", "#eff6ff", "#e0f2fe", "#f1f5f9", "#eef2ff"];
  const floorDecks = Array.from({ length: floorCount })
    .map((_, floor) => {
      const left = 390 - floor * 18;
      const top = 126 + floor * 118;
      const right = left + 700;
      const depth = 154;
      const skew = 170;
      const color = deckColors[floor % deckColors.length];
      const clipId = `blueprint-plate-${floor}`;
      const platePoints = `${left},${top + 78} ${right},${top + 8} ${right + skew},${top + 76} ${left + skew},${top + depth}`;
      const bluePrintTexture = blueprintDataUrl
        ? `<image href="${escapeSvgText(blueprintDataUrl)}" x="${left + 64}" y="${top + 28}" width="720" height="126" preserveAspectRatio="xMidYMid meet" opacity="0.48" clip-path="url(#${clipId})"/>`
        : "";
      return `
        <g>
          <clipPath id="${clipId}">
            <polygon points="${platePoints}"/>
          </clipPath>
          <polygon points="${platePoints}" fill="${color}" stroke="#64748b" stroke-width="4"/>
          ${bluePrintTexture}
          <polygon points="${left + skew},${top + depth} ${right + skew},${top + 76} ${right + skew},${top + 104} ${left + skew},${top + depth + 30}" fill="#94a3b8" opacity="0.42"/>
          <line x1="${left + 52}" y1="${top + 84}" x2="${right + 46}" y2="${top + 24}" stroke="#94a3b8" stroke-width="2" opacity="0.68"/>
          <line x1="${left + 110}" y1="${top + 129}" x2="${right + 118}" y2="${top + 63}" stroke="#94a3b8" stroke-width="2" opacity="0.56"/>
          <line x1="${left + 246}" y1="${top + 60}" x2="${left + 416}" y2="${top + 128}" stroke="#bfdbfe" stroke-width="5" opacity="0.7"/>
        </g>
      `;
    })
    .join("");
  const columns = [438, 612, 794, 986, 1154]
    .map(
      (x, index) => `
        <rect x="${x}" y="${142 + index * 6}" width="18" height="562" rx="2" fill="#64748b" opacity="0.86"/>
        <rect x="${x - 5}" y="${136 + index * 6}" width="28" height="12" fill="#475569" opacity="0.9"/>
      `
    )
    .join("");
  const zoneHighlights = overlay.activities
    .map((activity, index) => {
      const x = 300 + activity.x * 840;
      const y = 118 + activity.y * 620;
      const color = escapeSvgText(activity.color);
      const w = 96 + (index % 2) * 34;
      const h = 42 + (index % 3) * 9;
      return `
        <g>
          <polygon points="${x - w},${y + 14} ${x + w},${y - 6} ${x + w + 48},${y + h} ${x - w + 48},${y + h + 24}" fill="${color}" opacity="0.28" stroke="${color}" stroke-width="5"/>
          <circle cx="${x}" cy="${y + 20}" r="12" fill="#ffffff" stroke="${color}" stroke-width="6"/>
        </g>
      `;
    })
    .join("");
  const verticalOverlapMarkers = overlay.overlaps
    .slice(0, 8)
    .map((overlap, index) => {
      const x = 300 + overlap.x * 840;
      const y = 118 + overlap.y * 620;
      const color = ["#22d3ee", "#facc15", "#c084fc", "#fb923c", "#ef4444"][index % 5];
      return `
        <g>
          <line x1="${x}" y1="${Math.max(110, y - 150)}" x2="${x}" y2="${Math.min(780, y + 126)}" stroke="${color}" stroke-width="4" stroke-dasharray="8 12" opacity="0.88"/>
          <circle cx="${x}" cy="${y}" r="11" fill="${color}" stroke="#ffffff" stroke-width="4"/>
        </g>
      `;
    })
    .join("");
  const equipment = `
    <g opacity="0.92">
      <rect x="104" y="685" width="246" height="62" rx="7" fill="#f97316"/>
      <circle cx="148" cy="758" r="22" fill="#1f2937"/>
      <circle cx="292" cy="758" r="22" fill="#1f2937"/>
      <rect x="210" y="620" width="120" height="18" rx="6" fill="#facc15"/>
      <path d="M214 620 L308 560 L327 569 L235 624 Z" fill="#eab308"/>
      <rect x="1234" y="642" width="190" height="46" rx="6" fill="#38bdf8"/>
      <path d="M1282 642 L1344 520 L1360 526 L1306 642 Z" fill="#0891b2"/>
      <circle cx="1270" cy="700" r="19" fill="#1f2937"/>
      <circle cx="1392" cy="700" r="19" fill="#1f2937"/>
      <rect x="1210" y="356" width="182" height="14" fill="#f97316"/>
      <rect x="1218" y="390" width="182" height="14" fill="#f97316"/>
      <path d="M1222 356 L1368 632 M1368 356 L1222 632" stroke="#9a3412" stroke-width="7"/>
    </g>
  `;
  const workerMarkers = overlay.activities
    .slice(0, 6)
    .map((activity, index) => {
      const x = 322 + activity.x * 820 + (index % 2) * 28;
      const y = 150 + activity.y * 590;
      return `
        <g transform="translate(${x} ${y})">
          <circle cx="0" cy="-15" r="7" fill="#fef3c7" stroke="#111827" stroke-width="2"/>
          <path d="M-10 -23 H10 L6 -31 H-6 Z" fill="#facc15" stroke="#111827" stroke-width="2"/>
          <rect x="-6" y="-8" width="12" height="25" rx="4" fill="${escapeSvgText(activity.color)}" stroke="#111827" stroke-width="2"/>
          <path d="M-6 16 L-17 34 M6 16 L17 34 M-6 0 L-20 9 M6 0 L19 7" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
        </g>
      `;
    })
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#eef6ff"/>
      <stop offset="1" stop-color="#dbeafe"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
    <radialGradient id="siteGlow" cx="50%" cy="42%" r="58%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#93c5fd" stop-opacity="0.08"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  <rect width="${width}" height="${height}" fill="url(#siteGlow)"/>
  <path d="M124 790 C420 720, 802 710, 1456 774" fill="none" stroke="#64748b" stroke-width="28" opacity="0.16"/>
  ${equipment}
  <g filter="url(#shadow)">
    <g>
      ${floorDecks}
      ${columns}
      <path d="M380 126 L1092 56 L1264 126 L554 200 Z" fill="none" stroke="#0ea5e9" stroke-width="9" opacity="0.78"/>
      ${zoneHighlights}
      ${verticalOverlapMarkers}
      ${workerMarkers}
    </g>
  </g>
</svg>`;
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
