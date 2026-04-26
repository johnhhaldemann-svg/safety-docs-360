import type { NextResponse } from "next/server";

type RouteHandlerResponse = Response | NextResponse;

/**
 * Narrow App Router handler results for Vitest + `tsc --noEmit`.
 * Some handlers are inferred as `Response | undefined`; avoid a generic `T` here so
 * `T` is not inferred as `Response | undefined` (which breaks the return type).
 */
export function requireRouteResponse(
  r: RouteHandlerResponse | undefined | null
): RouteHandlerResponse {
  if (r == null) {
    throw new Error("Route handler returned no response");
  }
  return r;
}
