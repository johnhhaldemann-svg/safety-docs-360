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

function escapeSvgText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateLabel(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}...` : value;
}

function svgTextLines(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : [value.slice(0, maxChars)];
}

function svgActivityIcon(activity: SiteVisualRenderOverlayActivity, x: number, y: number) {
  const color = escapeSvgText(activity.color);
  return `
    <g transform="translate(${x} ${y})">
      <circle cx="0" cy="-13" r="7" fill="#fde68a" stroke="#111827" stroke-width="2"/>
      <rect x="-5" y="-6" width="10" height="21" rx="4" fill="${color}" stroke="#111827" stroke-width="2"/>
      <path d="M-17 1 L-5 2 M5 2 L18 -1 M-5 15 L-15 29 M5 15 L16 29" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
      <path d="M-10 -21 H10 L7 -28 H-7 Z" fill="#facc15" stroke="#111827" stroke-width="2"/>
    </g>
  `;
}

export function buildSiteVisualFallbackRenderSvg(
  input: SiteVisualRenderPromptInput,
  overlay = buildSiteVisualRenderOverlay(input.scene),
  blueprintDataUrl?: string | null
) {
  const width = 1600;
  const height = 900;
  const sceneX = 320;
  const sceneY = 88;
  const sceneW = 910;
  const sceneH = 690;
  const activities = overlay.activities.slice(0, 7);
  const overlaps = overlay.overlaps.slice(0, 8);
  const deckColors = ["#f8fafc", "#e0f2fe", "#dbeafe", "#f1f5f9"];
  const floorDecks = [0, 1, 2, 3]
    .map((floor) => {
      const y = sceneY + 120 + floor * 130;
      const x = sceneX + 72 - floor * 12;
      const color = deckColors[floor % deckColors.length];
      return `
        <g>
          <polygon points="${x},${y + 38} ${x + 650},${y - 12} ${x + 810},${y + 58} ${x + 150},${y + 122}" fill="${color}" stroke="#94a3b8" stroke-width="3"/>
          <polygon points="${x + 150},${y + 122} ${x + 810},${y + 58} ${x + 810},${y + 88} ${x + 150},${y + 154}" fill="#cbd5e1" opacity="0.75"/>
          <line x1="${x + 35}" y1="${y + 56}" x2="${x + 690}" y2="${y + 6}" stroke="#cbd5e1" stroke-width="2"/>
          <line x1="${x + 95}" y1="${y + 103}" x2="${x + 752}" y2="${y + 42}" stroke="#cbd5e1" stroke-width="2"/>
        </g>
      `;
    })
    .join("");
  const structureColumns = [420, 610, 810, 1040]
    .map(
      (x) => `
        <rect x="${x}" y="175" width="16" height="480" fill="#94a3b8"/>
        <rect x="${x - 4}" y="170" width="24" height="12" fill="#64748b"/>
      `
    )
    .join("");
  const activityZones = activities
    .map((activity, index) => {
      const x = sceneX + 90 + activity.x * 655;
      const y = sceneY + 85 + activity.y * 540;
      const color = escapeSvgText(activity.color);
      const labelLines = svgTextLines(activity.label, 20, 2);
      return `
        <g>
          <polygon points="${x - 76},${y + 20} ${x + 118},${y + 2} ${x + 164},${y + 58} ${x - 32},${y + 82}" fill="${color}" opacity="0.22" stroke="${color}" stroke-width="5"/>
          <path d="M${x + 2} ${y + 38} C${x + 58} ${y - 22}, ${x + 118} ${y - 30}, ${x + 174} ${y - 64}" fill="none" stroke="${color}" stroke-width="3"/>
          <circle cx="${x + 2}" cy="${y + 38}" r="10" fill="#fff" stroke="${color}" stroke-width="5"/>
          <rect x="${x + 164}" y="${y - 101}" width="210" height="74" rx="10" fill="#0f172a" fill-opacity="0.9" stroke="${color}" stroke-width="3"/>
          <text x="${x + 181}" y="${y - 65}" fill="#fff" font-size="33" font-weight="900">${activity.number}</text>
          <text x="${x + 222}" y="${y - 74}" fill="#fff" font-size="18" font-weight="900">${escapeSvgText(labelLines[0])}</text>
          <text x="${x + 222}" y="${y - 48}" fill="#dbeafe" font-size="16" font-weight="700">${escapeSvgText(labelLines[1] ?? activity.subtitle)}</text>
          ${svgActivityIcon(activity, x + 42 + (index % 2) * 42, y + 2)}
        </g>
      `;
    })
    .join("");
  const legendRows = activities
    .map((activity, index) => {
      const y = 108 + index * 84;
      const lines = svgTextLines(activity.label, 20, 2);
      return `
        <g>
          <rect x="26" y="${y}" width="254" height="68" rx="10" fill="#1e293b" stroke="${escapeSvgText(activity.color)}" stroke-width="3"/>
          <text x="60" y="${y + 42}" fill="#fff" font-size="34" font-weight="900">${activity.number}</text>
          <text x="104" y="${y + 29}" fill="#fff" font-size="18" font-weight="900">${escapeSvgText(lines[0])}</text>
          <text x="104" y="${y + 53}" fill="#cbd5e1" font-size="15" font-weight="700">${escapeSvgText(lines[1] ?? activity.subtitle)}</text>
        </g>
      `;
    })
    .join("");
  const overlapRows = overlaps.length
    ? overlaps
        .map((overlap, index) => {
          const y = 220 + index * 54;
          return `
            <g>
              <circle cx="1304" cy="${y}" r="8" fill="#38bdf8"/>
              <text x="1324" y="${y + 6}" fill="#e5e7eb" font-size="16" font-weight="800">${escapeSvgText(truncateLabel(overlap.label, 28))}</text>
            </g>
          `;
        })
        .join("")
    : `<text x="1304" y="234" fill="#e5e7eb" font-size="18" font-weight="800">No deterministic overlaps flagged.</text>`;

  const blueprintImage = blueprintDataUrl
    ? `<image href="${escapeSvgText(blueprintDataUrl)}" x="${sceneX + 154}" y="${sceneY + 230}" width="560" height="300" preserveAspectRatio="xMidYMid meet" opacity="0.34"/>`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#eef6ff"/>
      <stop offset="1" stop-color="#dbeafe"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <text x="320" y="52" fill="#0f172a" font-size="28" font-weight="900">${escapeSvgText(input.jobsite.name)}</text>
  <text x="320" y="82" fill="#475569" font-size="18" font-weight="700">${escapeSvgText(input.blueprint.fileName)} / Page ${escapeSvgText(input.blueprint.pageNumber)} / ${escapeSvgText(SITE_VISUAL_RENDER_DISCLAIMER)}</text>
  <rect x="14" y="24" width="282" height="626" rx="10" fill="#111827" opacity="0.9"/>
  <text x="32" y="66" fill="#fff" font-size="23" font-weight="900">WORK ACTIVITIES</text>
  ${legendRows}
  <g filter="url(#shadow)">
    <rect x="${sceneX}" y="${sceneY}" width="${sceneW}" height="${sceneH}" rx="20" fill="#ffffff" opacity="0.36"/>
    <g transform="translate(0 0)">
      ${floorDecks}
      ${blueprintImage}
      ${structureColumns}
      <path d="M390 705 L1180 628" stroke="#334155" stroke-width="10" opacity="0.18"/>
      <rect x="534" y="142" width="520" height="22" fill="#38bdf8" opacity="0.7"/>
      <rect x="392" y="690" width="230" height="44" rx="8" fill="#f97316" opacity="0.72"/>
      <rect x="950" y="632" width="178" height="38" rx="8" fill="#eab308" opacity="0.72"/>
      ${activityZones}
    </g>
  </g>
  <g>
    <rect x="1262" y="24" width="310" height="328" rx="10" fill="#111827" opacity="0.9"/>
    <text x="1288" y="70" fill="#fff" font-size="24" font-weight="900">OVERLAPPING WORK</text>
    <text x="1288" y="99" fill="#e5e7eb" font-size="18" font-weight="800">AT MULTIPLE LEVELS</text>
    <text x="1288" y="145" fill="#e5e7eb" font-size="17">Deterministic zone and</text>
    <text x="1288" y="171" fill="#e5e7eb" font-size="17">schedule conflicts are</text>
    <text x="1288" y="197" fill="#e5e7eb" font-size="17">shown as clickable overlays.</text>
    ${overlapRows}
  </g>
  <g>
    <rect x="1262" y="610" width="310" height="228" rx="10" fill="#111827" opacity="0.9"/>
    <text x="1310" y="661" fill="#fff" font-size="22" font-weight="900">SAFETY INSIGHT</text>
    <text x="1288" y="710" fill="#e5e7eb" font-size="18">Use this as a planning aid.</text>
    <text x="1288" y="740" fill="#e5e7eb" font-size="18">Verify field conditions,</text>
    <text x="1288" y="770" fill="#e5e7eb" font-size="18">access, sequencing, permits,</text>
    <text x="1288" y="800" fill="#e5e7eb" font-size="18">and exclusion zones onsite.</text>
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
