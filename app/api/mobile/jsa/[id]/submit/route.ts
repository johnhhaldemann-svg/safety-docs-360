import { NextResponse } from "next/server";
import { PATCH as patchJsa } from "@/app/api/company/jsas/route";
import { requireRouteResponse } from "@/lib/routeResponseTest";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const patched = new Request(request.url, {
    method: "PATCH",
    headers: request.headers,
    body: JSON.stringify({ id, status: "pending_review" }),
  });
  const response = requireRouteResponse(await patchJsa(patched));
  if (!response) {
    return NextResponse.json({ error: "Could not submit JSA." }, { status: 500 });
  }
  if (!response.ok) return response;
  const payload = (await response.json().catch(() => null)) as unknown;
  return NextResponse.json({
    success: true,
    reviewStatus: "pending_review",
    message: "JSA sent for company admin review.",
    jsa: (payload as { jsa?: unknown })?.jsa ?? null,
  });
}
