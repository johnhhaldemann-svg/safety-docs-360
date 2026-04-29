import { GET as getMobileMe } from "@/app/api/mobile/me/route";
import { requireRouteResponse } from "@/lib/routeResponseTest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const response = requireRouteResponse(await getMobileMe(request));
  if (!response) {
    return Response.json({ error: "Could not load features." }, { status: 500 });
  }
  const payload = (await response.json().catch(() => null)) as {
    features?: unknown;
    featureMap?: unknown;
    error?: string;
  } | null;
  if (!response.ok) {
    return Response.json({ error: payload?.error || "Could not load features." }, { status: response.status });
  }
  return Response.json({
    features: payload?.features ?? [],
    featureMap: payload?.featureMap ?? {},
  });
}
