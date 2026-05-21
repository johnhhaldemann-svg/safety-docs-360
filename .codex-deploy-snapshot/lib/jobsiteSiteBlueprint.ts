export type SiteVisualBlueprintStatus = "pending" | "uploaded" | "processing" | "ready" | "failed" | "archived";

export type SiteVisualBlueprintTransform = {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
  opacity: number;
  width: number;
  height: number;
};

export type SiteVisualBlueprintInput = {
  id: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  pageNumber: number;
  transform: SiteVisualBlueprintTransform;
};

export const SITE_VISUAL_BLUEPRINT_BUCKET = "documents";
export const SITE_VISUAL_BLUEPRINT_MAX_BYTES = 25 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export function normalizeBlueprintMimeType(value: unknown) {
  const mimeType = String(value ?? "").trim().toLowerCase();
  return MIME_EXTENSIONS[mimeType] ? mimeType : null;
}

export function blueprintExtensionForMimeType(mimeType: string) {
  return MIME_EXTENSIONS[mimeType] ?? null;
}

export function sanitizeBlueprintFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "blueprint";
}

export function validateBlueprintUpload(input: {
  fileName?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  pageNumber?: unknown;
}) {
  const fileName = sanitizeBlueprintFileName(String(input.fileName ?? "").trim());
  const mimeType = normalizeBlueprintMimeType(input.mimeType);
  const fileSize = Number(input.fileSize);
  const pageNumber = Math.max(1, Math.min(200, Math.trunc(Number(input.pageNumber ?? 1) || 1)));
  if (!String(input.fileName ?? "").trim()) return { ok: false as const, error: "fileName is required." };
  if (!mimeType) return { ok: false as const, error: "Upload a PDF, PNG, JPG, or WebP blueprint." };
  if (!Number.isFinite(fileSize) || fileSize <= 0) return { ok: false as const, error: "fileSize is required." };
  if (fileSize > SITE_VISUAL_BLUEPRINT_MAX_BYTES) return { ok: false as const, error: "Blueprint file is too large. Maximum size is 25 MB." };
  return { ok: true as const, fileName, mimeType, fileSize, pageNumber };
}

export function blueprintStoragePrefix(companyId: string, jobsiteId: string, blueprintId: string) {
  return `companies/${companyId}/jobsites/${jobsiteId}/site-visual/blueprints/${blueprintId}`;
}

export function blueprintSourcePath(params: {
  companyId: string;
  jobsiteId: string;
  blueprintId: string;
  fileName: string;
  mimeType: string;
}) {
  const extension = blueprintExtensionForMimeType(params.mimeType) ?? "bin";
  const safeName = sanitizeBlueprintFileName(params.fileName);
  const normalized = safeName.toLowerCase().endsWith(`.${extension}`) ? safeName : `${safeName}.${extension}`;
  return `${blueprintStoragePrefix(params.companyId, params.jobsiteId, params.blueprintId)}/source/${normalized}`;
}

export function blueprintPreviewPath(companyId: string, jobsiteId: string, blueprintId: string) {
  return `${blueprintStoragePrefix(companyId, jobsiteId, blueprintId)}/preview/preview.webp`;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function defaultBlueprintTransform(width: number, height: number): SiteVisualBlueprintTransform {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;
  const baseWidth = aspect >= 1 ? 72 : Math.max(24, 72 * aspect);
  const baseHeight = aspect >= 1 ? Math.max(24, 72 / aspect) : 72;
  return {
    x: 0,
    z: 0,
    scale: 1,
    rotationY: 0,
    opacity: 0.72,
    width: Number(baseWidth.toFixed(2)),
    height: Number(baseHeight.toFixed(2)),
  };
}

export function cleanBlueprintTransform(value: unknown, fallback = defaultBlueprintTransform(1600, 1000)): SiteVisualBlueprintTransform {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    x: clamp(record.x, -80, 80, fallback.x),
    z: clamp(record.z, -80, 80, fallback.z),
    scale: clamp(record.scale, 0.2, 4, fallback.scale),
    rotationY: clamp(record.rotationY, -Math.PI * 2, Math.PI * 2, fallback.rotationY),
    opacity: clamp(record.opacity, 0.08, 1, fallback.opacity),
    width: clamp(record.width, 12, 120, fallback.width),
    height: clamp(record.height, 12, 120, fallback.height),
  };
}

export function blueprintPromptSummary(blueprint: SiteVisualBlueprintInput | null | undefined) {
  if (!blueprint) return null;
  return {
    id: blueprint.id,
    fileName: blueprint.fileName,
    mimeType: blueprint.mimeType,
    pageNumber: blueprint.pageNumber,
    imageWidth: blueprint.width,
    imageHeight: blueprint.height,
    planeWidth: blueprint.transform.width * blueprint.transform.scale,
    planeHeight: blueprint.transform.height * blueprint.transform.scale,
    instruction:
      "Use the attached blueprint preview as a visual guide. Place schematic areas and work zones over recognizable rooms, floors, corridors, laydown areas, or labeled work areas when possible.",
  };
}
