/**
 * Simple in-memory fixed-window rate limiter for API routes.
 * Resets per serverless instance; sufficient to blunt casual abuse.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function checkFixedWindowRateLimit(
  key: string,
  options?: { windowMs?: number; max?: number }
): RateLimitResult {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options?.max ?? DEFAULT_MAX;
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now - b.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (b.count >= max) {
    const elapsed = now - b.windowStart;
    const retryAfterMs = Math.max(0, windowMs - elapsed);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  b.count += 1;
  return { ok: true };
}

export function contentTypeFromFilenameHint(pathOrName: string): string {
  const lower = pathOrName.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}
