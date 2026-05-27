import { NextResponse } from "next/server";
import {
  getAiImprovementRequest,
  updateAiImprovementRequest,
} from "@/lib/superadmin/aiImprovementRequests";
import {
  AI_IMPROVEMENT_ROUTE_RUNTIME,
  getAiImprovementClient,
  requestIpAddress,
  requestUserAgent,
  requireAiImprovementSuperadmin,
} from "../_shared";

export const runtime = AI_IMPROVEMENT_ROUTE_RUNTIME;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  const { id } = await context.params;
  const client = getAiImprovementClient(auth.supabase);
  const improvement = await getAiImprovementRequest(client, id);
  if (!improvement) {
    return NextResponse.json({ error: "AI improvement request not found." }, { status: 404 });
  }

  return NextResponse.json(
    { request: improvement },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  try {
    const { id } = await context.params;
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const client = getAiImprovementClient(auth.supabase);
    const improvement = await updateAiImprovementRequest({
      client,
      id,
      input,
      actor: { id: auth.user.id, type: "user", role: auth.role },
      ipAddress: requestIpAddress(request),
      userAgent: requestUserAgent(request),
    });

    return NextResponse.json({ request: improvement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update AI improvement request.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 400 }
    );
  }
}
