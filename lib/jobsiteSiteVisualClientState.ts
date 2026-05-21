export type SiteVisualClientZoneRef = { id: string };

export type SiteVisualClientJobStatus = "queued" | "running" | "ready" | "fallback_ready" | "failed" | string;

export function nextSelectedSiteVisualZoneId(
  currentZoneId: string | null,
  zones: SiteVisualClientZoneRef[]
) {
  if (currentZoneId && zones.some((zone) => zone.id === currentZoneId)) {
    return currentZoneId;
  }
  return zones[0]?.id ?? null;
}

export function isFinishedSiteVisualJobStatus(status: SiteVisualClientJobStatus) {
  return status === "ready" || status === "fallback_ready";
}

export function isFailedSiteVisualJobStatus(status: SiteVisualClientJobStatus) {
  return status === "failed";
}

export function siteVisualPollTimeoutMessage(kind: "site visual" | "detailed visual") {
  return `The ${kind} is still processing. Refresh this page in a moment to check the latest status.`;
}

export function mergeSiteVisualZoneSavePayload<
  TPayload extends {
    scene?: (Record<string, unknown> & { zones: TZone[] }) | null;
    zones?: TZone[];
    render?: unknown | null;
  },
  TZone extends SiteVisualClientZoneRef,
>(
  current: TPayload,
  update: {
    scene?: (Record<string, unknown> & { zones: TZone[] }) | null;
    zones?: TZone[];
  }
): TPayload {
  return {
    ...current,
    scene: update.scene ?? (current.scene ? { ...current.scene, zones: update.zones ?? current.scene.zones } : current.scene),
    zones: update.zones ?? current.zones,
    render: null,
  };
}
