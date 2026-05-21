/**
 * Authorize Vercel Cron (or manual) invocations of `/api/cron/*`.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in project env.
 * Query `?secret=` is supported for manual triggers; avoid logging full URLs that contain it.
 */
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const rawAuth = request.headers.get("authorization")?.trim() ?? "";
  const bearerMatch = rawAuth.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : "";
  if (bearerToken === secret) return true;

  const querySecret = new URL(request.url).searchParams.get("secret");
  return querySecret === secret;
}
