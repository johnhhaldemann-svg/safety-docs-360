/**
 * Conflict policy for offline batch sync: client may only apply updates if the server
 * row has not changed since the client's snapshot (`ifUnmodifiedSince`).
 */
export function parseIsoDate(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export type ConflictCheck = {
  serverUpdatedAtIso: string;
  ifUnmodifiedSinceIso: string | null | undefined;
};

export function shouldRejectStaleUpdate({
  serverUpdatedAtIso,
  ifUnmodifiedSinceIso,
}: ConflictCheck): boolean {
  const serverMs = parseIsoDate(serverUpdatedAtIso);
  const clientMs = parseIsoDate(ifUnmodifiedSinceIso ?? null);
  if (serverMs === null || clientMs === null) return false;
  return serverMs > clientMs;
}
