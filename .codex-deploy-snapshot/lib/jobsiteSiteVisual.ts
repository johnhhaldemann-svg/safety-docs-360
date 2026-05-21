import { createHash } from "node:crypto";
import {
  blueprintPromptSummary,
  cleanBlueprintTransform,
  defaultBlueprintTransform,
  type SiteVisualBlueprintInput,
  type SiteVisualBlueprintTransform,
} from "@/lib/jobsiteSiteBlueprint";

export type SiteVisualRiskLevel = "low" | "medium" | "high" | "critical";
export type SiteVisualSourceType = "schedule" | "jsa_activity" | "permit" | "observation" | "manual";

export type SiteVisualVector = { x: number; y: number; z: number };
export type SiteVisualBlueprintBounds = { x: number; y: number; width: number; height: number };

export type SiteVisualBlueprintPlacement = {
  id: string | null;
  imageWidth: number;
  imageHeight: number;
  transform: SiteVisualBlueprintTransform;
};

export type SiteVisualWorkItem = {
  id: string;
  sourceType: SiteVisualSourceType;
  title: string;
  trade?: string | null;
  workArea?: string | null;
  workStartDate?: string | null;
  workEndDate?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  riskLevel?: SiteVisualRiskLevel | string | null;
  controls?: string[];
  hazardCategories?: string[];
  permitTriggers?: string[];
};

export type SiteVisualScene = {
  version: 1;
  levels: Array<{ id: string; label: string; elevation: number; height: number }>;
  areas: Array<{
    id: string;
    label: string;
    levelId: string;
    position: SiteVisualVector;
    size: SiteVisualVector;
    color: string;
    blueprintBounds?: SiteVisualBlueprintBounds | null;
  }>;
  zones: SiteVisualZone[];
  overlaps: SiteVisualOverlap[];
  camera: { position: SiteVisualVector; target: SiteVisualVector };
  blueprint: SiteVisualBlueprintPlacement | null;
};

export type SiteVisualZone = {
  id: string;
  label: string;
  sourceType: SiteVisualSourceType;
  sourceId: string | null;
  scheduleItemId: string | null;
  trade: string | null;
  workArea: string | null;
  startsAt: string | null;
  endsAt: string | null;
  riskLevel: SiteVisualRiskLevel;
  controls: string[];
  position: SiteVisualVector;
  size: SiteVisualVector;
  color: string;
  blueprintBounds?: SiteVisualBlueprintBounds | null;
};

export type SiteVisualOverlap = {
  id: string;
  zoneIds: [string, string];
  severity: "medium" | "high" | "critical";
  label: string;
  reason: string;
};

export type SiteVisualGenerationInput = {
  jobsite: {
    id: string;
    name: string;
    location?: string | null;
    projectNumber?: string | null;
    jobsiteNumber?: string | null;
  };
  items: SiteVisualWorkItem[];
  blueprint?: SiteVisualBlueprintInput | null;
};

const RISK_COLORS: Record<SiteVisualRiskLevel, string> = {
  low: "#10b981",
  medium: "#2563eb",
  high: "#f97316",
  critical: "#ef4444",
};

const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const SOURCE_TYPES = new Set(["schedule", "jsa_activity", "permit", "observation", "manual"]);

export const SITE_VISUAL_SCENE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    levels: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          elevation: { type: "number" },
          height: { type: "number" },
        },
        required: ["id", "label", "elevation", "height"],
      },
    },
    areas: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          levelId: { type: "string" },
          position: vectorSchema(),
          size: vectorSchema(),
          color: { type: "string" },
          blueprintBounds: blueprintBoundsSchema(),
        },
        required: ["id", "label", "levelId", "position", "size", "color", "blueprintBounds"],
      },
    },
    zones: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          sourceType: { type: "string", enum: ["schedule", "jsa_activity", "permit", "observation", "manual"] },
          sourceId: { type: ["string", "null"] },
          scheduleItemId: { type: ["string", "null"] },
          trade: { type: ["string", "null"] },
          workArea: { type: ["string", "null"] },
          startsAt: { type: ["string", "null"] },
          endsAt: { type: ["string", "null"] },
          riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
          controls: { type: "array", maxItems: 10, items: { type: "string" } },
          position: vectorSchema(),
          size: vectorSchema(),
          color: { type: "string" },
          blueprintBounds: blueprintBoundsSchema(),
        },
        required: [
          "id",
          "label",
          "sourceType",
          "sourceId",
          "scheduleItemId",
          "trade",
          "workArea",
          "startsAt",
          "endsAt",
          "riskLevel",
          "controls",
          "position",
          "size",
          "color",
          "blueprintBounds",
        ],
      },
    },
    camera: {
      type: "object",
      additionalProperties: false,
      properties: {
        position: vectorSchema(),
        target: vectorSchema(),
      },
      required: ["position", "target"],
    },
    blueprint: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: ["string", "null"] },
            imageWidth: { type: "number" },
            imageHeight: { type: "number" },
            transform: blueprintTransformSchema(),
          },
          required: ["id", "imageWidth", "imageHeight", "transform"],
        },
      ],
    },
  },
  required: ["levels", "areas", "zones", "camera", "blueprint"],
} as const;

function vectorSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      x: { type: "number" },
      y: { type: "number" },
      z: { type: "number" },
    },
    required: ["x", "y", "z"],
  } as const;
}

function blueprintBoundsSchema() {
  return {
    anyOf: [
      { type: "null" },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["x", "y", "width", "height"],
      },
    ],
  } as const;
}

function blueprintTransformSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      x: { type: "number" },
      z: { type: "number" },
      scale: { type: "number" },
      rotationY: { type: "number" },
      opacity: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
    },
    required: ["x", "z", "scale", "rotationY", "opacity", "width", "height"],
  } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function slug(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return cleaned || fallback;
}

function cleanText(value: unknown, fallback: string, max = 120) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function cleanNullableText(value: unknown, max = 120) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

function cleanColor(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function riskLevel(value: unknown): SiteVisualRiskLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  return RISK_LEVELS.has(normalized) ? (normalized as SiteVisualRiskLevel) : "medium";
}

function sourceType(value: unknown): SiteVisualSourceType {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SOURCE_TYPES.has(normalized) ? (normalized as SiteVisualSourceType) : "manual";
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanVector(value: unknown, fallback: SiteVisualVector, bounds = 80): SiteVisualVector {
  const record = isRecord(value) ? value : {};
  return {
    x: clamp(record.x, -bounds, bounds, fallback.x),
    y: clamp(record.y, 0, 30, fallback.y),
    z: clamp(record.z, -bounds, bounds, fallback.z),
  };
}

function cleanSize(value: unknown, fallback: SiteVisualVector): SiteVisualVector {
  const record = isRecord(value) ? value : {};
  return {
    x: clamp(record.x, 0.5, 30, fallback.x),
    y: clamp(record.y, 0.25, 12, fallback.y),
    z: clamp(record.z, 0.5, 30, fallback.z),
  };
}

function cleanBlueprintBounds(value: unknown): SiteVisualBlueprintBounds | null {
  if (!isRecord(value)) return null;
  return {
    x: clamp(value.x, 0, 1, 0),
    y: clamp(value.y, 0, 1, 0),
    width: clamp(value.width, 0.01, 1, 0.1),
    height: clamp(value.height, 0.01, 1, 0.1),
  };
}

function blueprintPlacementFromInput(blueprint?: SiteVisualBlueprintInput | null): SiteVisualBlueprintPlacement | null {
  if (!blueprint) return null;
  return {
    id: blueprint.id,
    imageWidth: Math.max(1, Math.round(blueprint.width)),
    imageHeight: Math.max(1, Math.round(blueprint.height)),
    transform: cleanBlueprintTransform(blueprint.transform, defaultBlueprintTransform(blueprint.width, blueprint.height)),
  };
}

function cleanBlueprintPlacement(value: unknown, fallback: SiteVisualBlueprintPlacement | null): SiteVisualBlueprintPlacement | null {
  if (!isRecord(value)) return fallback;
  const imageWidth = clamp(value.imageWidth, 1, 12000, fallback?.imageWidth ?? 1600);
  const imageHeight = clamp(value.imageHeight, 1, 12000, fallback?.imageHeight ?? 1000);
  return {
    id: cleanNullableText(value.id, 80),
    imageWidth: Math.round(imageWidth),
    imageHeight: Math.round(imageHeight),
    transform: cleanBlueprintTransform(value.transform, fallback?.transform ?? defaultBlueprintTransform(imageWidth, imageHeight)),
  };
}

function cleanList(value: unknown, maxItems = 10) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = String(item ?? "").trim().slice(0, 90);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function inferLevelLabel(area?: string | null) {
  const text = String(area ?? "").trim();
  const match =
    text.match(/\b([0-9]+)(?:st|nd|rd|th)\s*(?:floor|level)\b/i) ??
    text.match(/\b(?:level|floor|fl|lvl)\s*([a-z0-9-]+)/i);
  if (!match?.[1]) return "Ground / General";
  return `Level ${match[1].toUpperCase()}`;
}

function dateTime(date?: string | null, time?: string | null, end = false) {
  const dateOnly = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const timeOnly = /^\d{2}:\d{2}$/.test(String(time ?? "")) ? String(time) : end ? "23:59" : "00:00";
  return `${dateOnly}T${timeOnly}:00`;
}

function itemStartsAt(item: SiteVisualWorkItem) {
  return dateTime(item.workStartDate, item.shiftStartTime, false);
}

function itemEndsAt(item: SiteVisualWorkItem) {
  return dateTime(item.workEndDate || item.workStartDate, item.shiftEndTime, true);
}

function normalizeInput(input: SiteVisualGenerationInput) {
  return {
    jobsite: {
      id: input.jobsite.id,
      name: input.jobsite.name,
      location: input.jobsite.location ?? null,
      projectNumber: input.jobsite.projectNumber ?? null,
      jobsiteNumber: input.jobsite.jobsiteNumber ?? null,
    },
    blueprint: blueprintPromptSummary(input.blueprint),
    items: input.items
      .map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        title: item.title,
        trade: item.trade ?? null,
        workArea: item.workArea ?? null,
        workStartDate: item.workStartDate ?? null,
        workEndDate: item.workEndDate ?? null,
        shiftStartTime: item.shiftStartTime ?? null,
        shiftEndTime: item.shiftEndTime ?? null,
        riskLevel: riskLevel(item.riskLevel),
        controls: [...new Set([...(item.controls ?? []), ...(item.permitTriggers ?? [])])].slice(0, 10),
        permitTriggers: item.permitTriggers ?? [],
      }))
      .sort((a, b) => `${a.workStartDate ?? ""}:${a.id}`.localeCompare(`${b.workStartDate ?? ""}:${b.id}`)),
  };
}

export function stableSiteVisualInputKey(input: SiteVisualGenerationInput) {
  return JSON.stringify(normalizeInput(input));
}

export function siteVisualPromptHash(input: SiteVisualGenerationInput) {
  return createHash("sha256").update(stableSiteVisualInputKey(input)).digest("hex");
}

export function buildSiteVisualAiPrompt(input: SiteVisualGenerationInput) {
  return JSON.stringify(
    {
      instruction:
        "Create an editable schematic 3D jobsite map from structured work data. Return JSON only. Arrange areas and work zones so a safety manager can visually inspect where work is happening. Do not invent engineering dimensions or claim BIM accuracy.",
      rules: [
        "Use simple schematic coordinates in feet-like units.",
        "Group similarly named work areas together.",
        "Place zones inside or near their work area.",
        "If a blueprint preview is supplied, align areas and zones to visible plan labels, rooms, corridors, and site boundaries.",
        "Use normalized blueprintBounds from 0 to 1 when blueprint placement is visually inferable; otherwise use null.",
        "Use risk colors: low green, medium blue, high orange, critical red.",
        "Keep all geometry compact and readable.",
        "Do not calculate overlaps; the app will recompute overlaps deterministically.",
      ],
      input: normalizeInput(input),
    },
    null,
    2
  );
}

export function buildFallbackSiteVisualScene(input: SiteVisualGenerationInput): SiteVisualScene {
  const items = normalizeInput(input).items;
  const blueprint = blueprintPlacementFromInput(input.blueprint);
  const levelLabels = Array.from(new Set(items.map((item) => inferLevelLabel(item.workArea))));
  const levels = (levelLabels.length ? levelLabels : ["Ground / General"]).slice(0, 8).map((label, index) => ({
    id: slug(label, `level-${index + 1}`),
    label,
    elevation: index * 4,
    height: 0.25,
  }));

  const areaKeys = Array.from(
    new Set(
      (items.length ? items : [{ workArea: "General", title: "General site work" }]).map((item) => {
        const level = slug(inferLevelLabel(item.workArea), "ground");
        const area = slug(item.workArea ?? "General", "general");
        return `${level}:${area}`;
      })
    )
  ).slice(0, 30);

  const areas = areaKeys.map((key, index) => {
    const [levelId, areaId] = key.split(":");
    const level = levels.find((item) => item.id === levelId) ?? levels[0];
    const col = index % 3;
    const row = Math.floor(index / 3);
    const labelSource = items.find((item) => slug(item.workArea ?? "General", "general") === areaId)?.workArea ?? "General";
    return {
      id: `${level.id}-${areaId}`,
      label: labelSource,
      levelId: level.id,
      position: { x: col * 18 - 18, y: level.elevation, z: row * 14 - 8 },
      size: { x: 14, y: 0.25, z: 10 },
      color: "#dbeafe",
      blueprintBounds: blueprint
        ? {
            x: Math.min(0.85, Math.max(0.05, 0.08 + col * 0.28)),
            y: Math.min(0.85, Math.max(0.05, 0.08 + row * 0.22)),
            width: 0.22,
            height: 0.16,
          }
        : null,
    };
  });

  const areaZoneCounts = new Map<string, number>();
  const zones = items.slice(0, 80).map((item, index): SiteVisualZone => {
    const itemLevelId = slug(inferLevelLabel(item.workArea), "ground");
    const itemAreaId = `${itemLevelId}-${slug(item.workArea ?? "General", "general")}`;
    const area = areas.find((candidate) => candidate.id === itemAreaId) ?? areas[index % Math.max(1, areas.length)];
    const count = areaZoneCounts.get(area.id) ?? 0;
    areaZoneCounts.set(area.id, count + 1);
    const col = count % 2;
    const row = Math.floor(count / 2);
    const level = levels.find((levelItem) => levelItem.id === area.levelId) ?? levels[0];
    const levelRisk = riskLevel(item.riskLevel);
    return {
      id: `${item.sourceType}-${slug(item.id, String(index + 1))}`,
      label: item.title || "Work zone",
      sourceType: item.sourceType,
      sourceId: item.id,
      scheduleItemId: item.sourceType === "schedule" ? item.id : null,
      trade: item.trade ?? null,
      workArea: item.workArea ?? area.label,
      startsAt: itemStartsAt(item),
      endsAt: itemEndsAt(item),
      riskLevel: levelRisk,
      controls: [...new Set([...(item.controls ?? []), ...(item.permitTriggers ?? [])])].slice(0, 10),
      position: {
        x: area.position.x - 3.2 + col * 6.4,
        y: level.elevation + 0.75,
        z: area.position.z - 2.3 + row * 4.6,
      },
      size: { x: 5.4, y: 1.35, z: 3.8 },
      color: RISK_COLORS[levelRisk],
      blueprintBounds: area.blueprintBounds
        ? {
            x: Math.min(0.96, area.blueprintBounds.x + 0.03 + col * 0.08),
            y: Math.min(0.96, area.blueprintBounds.y + 0.03 + row * 0.06),
            width: 0.08,
            height: 0.05,
          }
        : null,
    };
  });

  return {
    version: 1,
    levels,
    areas,
    zones,
    overlaps: detectSiteVisualOverlaps(zones),
    camera: { position: { x: 24, y: 24, z: 32 }, target: { x: 0, y: 0, z: 0 } },
    blueprint,
  };
}

export function validateSiteVisualScene(value: unknown, input: SiteVisualGenerationInput): SiteVisualScene {
  const fallback = buildFallbackSiteVisualScene(input);
  if (!isRecord(value)) return fallback;

  const parsedLevels = Array.isArray(value.levels) ? value.levels : [];
  const levels = parsedLevels.slice(0, 8).map((item, index) => {
    const record = isRecord(item) ? item : {};
    const id = slug(cleanText(record.id, `level-${index + 1}`), `level-${index + 1}`);
    return {
      id,
      label: cleanText(record.label, `Level ${index + 1}`),
      elevation: clamp(record.elevation, 0, 28, index * 4),
      height: clamp(record.height, 0.1, 2, 0.25),
    };
  });
  if (levels.length === 0) levels.push(...fallback.levels);

  const parsedAreas = Array.isArray(value.areas) ? value.areas : [];
  const levelIds = new Set(levels.map((level) => level.id));
  const areas: SiteVisualScene["areas"] = parsedAreas.slice(0, 30).map((item, index) => {
    const record = isRecord(item) ? item : {};
    const levelIdRaw = slug(cleanText(record.levelId, levels[0].id), levels[0].id);
    const levelId = levelIds.has(levelIdRaw) ? levelIdRaw : levels[0].id;
    const level = levels.find((candidate) => candidate.id === levelId) ?? levels[0];
    return {
      id: slug(cleanText(record.id, `area-${index + 1}`), `area-${index + 1}`),
      label: cleanText(record.label, `Area ${index + 1}`),
      levelId,
      position: cleanVector(record.position, { x: index * 8, y: level.elevation, z: 0 }),
      size: cleanSize(record.size, { x: 12, y: 0.25, z: 8 }),
      color: cleanColor(record.color, "#dbeafe"),
      blueprintBounds: cleanBlueprintBounds(record.blueprintBounds),
    };
  });
  if (areas.length === 0) areas.push(...fallback.areas);

  const parsedZones = Array.isArray(value.zones) ? value.zones : [];
  const zones = parsedZones.slice(0, 80).map((item, index): SiteVisualZone => {
    const record = isRecord(item) ? item : {};
    const nextRisk = riskLevel(record.riskLevel);
    return {
      id: slug(cleanText(record.id, `zone-${index + 1}`), `zone-${index + 1}`),
      label: cleanText(record.label, `Work zone ${index + 1}`),
      sourceType: sourceType(record.sourceType),
      sourceId: cleanNullableText(record.sourceId),
      scheduleItemId: cleanNullableText(record.scheduleItemId),
      trade: cleanNullableText(record.trade),
      workArea: cleanNullableText(record.workArea),
      startsAt: cleanNullableText(record.startsAt, 40),
      endsAt: cleanNullableText(record.endsAt, 40),
      riskLevel: nextRisk,
      controls: cleanList(record.controls),
      position: cleanVector(record.position, fallback.zones[index]?.position ?? { x: 0, y: 1, z: 0 }),
      size: cleanSize(record.size, fallback.zones[index]?.size ?? { x: 5, y: 1.25, z: 4 }),
      color: cleanColor(record.color, RISK_COLORS[nextRisk]),
      blueprintBounds: cleanBlueprintBounds(record.blueprintBounds),
    };
  });
  if (zones.length === 0) zones.push(...fallback.zones);

  const cameraRecord = isRecord(value.camera) ? value.camera : {};
  return {
    version: 1,
    levels,
    areas,
    zones,
    overlaps: detectSiteVisualOverlaps(zones),
    camera: {
      position: cleanVector(cameraRecord.position, fallback.camera.position, 120),
      target: cleanVector(cameraRecord.target, fallback.camera.target, 120),
    },
    blueprint: cleanBlueprintPlacement(value.blueprint, fallback.blueprint),
  };
}

function timestamp(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeWindowsOverlap(left: SiteVisualZone, right: SiteVisualZone) {
  const leftStart = timestamp(left.startsAt);
  const rightStart = timestamp(right.startsAt);
  if (leftStart == null || rightStart == null) return false;
  const leftEnd = timestamp(left.endsAt) ?? leftStart;
  const rightEnd = timestamp(right.endsAt) ?? rightStart;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function boxesIntersect(left: Pick<SiteVisualZone, "position" | "size">, right: Pick<SiteVisualZone, "position" | "size">) {
  return (
    axisRangesIntersect(left.position.x, left.size.x, right.position.x, right.size.x) &&
    axisRangesIntersect(left.position.y, left.size.y, right.position.y, right.size.y) &&
    axisRangesIntersect(left.position.z, left.size.z, right.position.z, right.size.z)
  );
}

function axisRangesIntersect(leftCenter: number, leftSize: number, rightCenter: number, rightSize: number) {
  return Math.abs(leftCenter - rightCenter) * 2 < leftSize + rightSize;
}

function horizontalFootprintsIntersect(left: Pick<SiteVisualZone, "position" | "size">, right: Pick<SiteVisualZone, "position" | "size">) {
  return (
    axisRangesIntersect(left.position.x, left.size.x, right.position.x, right.size.x) &&
    axisRangesIntersect(left.position.z, left.size.z, right.position.z, right.size.z)
  );
}

function blueprintBoundsIntersect(left: SiteVisualZone, right: SiteVisualZone) {
  if (!left.blueprintBounds || !right.blueprintBounds) return false;
  const leftBounds = left.blueprintBounds;
  const rightBounds = right.blueprintBounds;
  return (
    leftBounds.x < rightBounds.x + rightBounds.width &&
    leftBounds.x + leftBounds.width > rightBounds.x &&
    leftBounds.y < rightBounds.y + rightBounds.height &&
    leftBounds.y + leftBounds.height > rightBounds.y
  );
}

function overlapReason({
  blueprintOverlap,
  schematicOverlap,
  verticalStack,
}: {
  blueprintOverlap: boolean;
  schematicOverlap: boolean;
  verticalStack: boolean;
}) {
  if (blueprintOverlap) {
    return "Work footprints overlap on the uploaded blueprint and their scheduled windows overlap.";
  }
  if (verticalStack) {
    return "Work footprints stack above or below each other during the same scheduled window.";
  }
  if (schematicOverlap) {
    return "Work zones intersect in the schematic map and their scheduled windows overlap.";
  }
  return "Work areas overlap during the same scheduled window.";
}

export function detectSiteVisualOverlaps(zones: SiteVisualZone[]): SiteVisualOverlap[] {
  const overlaps: SiteVisualOverlap[] = [];
  for (let i = 0; i < zones.length; i += 1) {
    for (let j = i + 1; j < zones.length; j += 1) {
      const left = zones[i];
      const right = zones[j];
      if (!timeWindowsOverlap(left, right)) continue;
      const schematicOverlap = boxesIntersect(left, right);
      const blueprintOverlap = blueprintBoundsIntersect(left, right);
      const verticalStack = !schematicOverlap && horizontalFootprintsIntersect(left, right);
      if (!schematicOverlap && !blueprintOverlap && !verticalStack) continue;
      const severity =
        left.riskLevel === "critical" || right.riskLevel === "critical"
          ? "critical"
          : left.riskLevel === "high" || right.riskLevel === "high"
            ? "high"
            : "medium";
      overlaps.push({
        id: `overlap-${left.id}-${right.id}`,
        zoneIds: [left.id, right.id],
        severity,
        label: `${left.label} / ${right.label}`,
        reason: overlapReason({ blueprintOverlap, schematicOverlap, verticalStack }),
      });
    }
  }
  return overlaps.slice(0, 50);
}

export function sceneWithZones(scene: SiteVisualScene, zones: SiteVisualZone[]): SiteVisualScene {
  return {
    ...scene,
    zones,
    overlaps: detectSiteVisualOverlaps(zones),
  };
}
