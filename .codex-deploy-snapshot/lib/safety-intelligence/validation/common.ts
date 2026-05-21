import type { JsonObject } from "@/types/safety-intelligence";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export function ensureString(value: unknown, field: string): string {
  const next = String(value ?? "").trim();
  if (!next) {
    throw new Error(`${field} is required.`);
  }
  return next;
}

export function ensureOptionalString(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

export function ensureJsonObject(value: unknown): JsonObject {
  if (!isRecord(value)) {
    return {};
  }
  return value as JsonObject;
}

