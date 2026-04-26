import type { NextResponse } from "next/server";

/** Narrow Next route handler results for Vitest + `tsc --noEmit` (handlers typed as possibly undefined). */
export function requireRouteResponse<T extends Response | NextResponse>(r: T | undefined | null): T {
  if (r == null) {
    throw new Error("Route handler returned no response");
  }
  return r;
}
