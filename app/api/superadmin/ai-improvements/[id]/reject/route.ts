import { NextResponse } from "next/server";
import {
  parseRejectionInput,
  rejectAiImprovementRequest,
} from "@/lib/superadmin/aiImprovementRequests";
import {
  AI_IMPROVEMENT_ROUTE_RUNTIME,
  getAiImprovementClient,
  requestIpAddress,
  requestUserAgent,
  requireAiImprovementSuperadmin,
} from "../../_shared";

export const runtime = AI_IMPROVEMENT_ROUTE_RUNTIME;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseRejectionInput(body);
    if (parsed.actorType !== "user") {
      return NextResponse.json({ error: "Super Admin user rejection is required." }, { status: 403 });
    }

    const client = getAiImprovementClient(auth.supabase);
    const improvement = await rejectAiImprovementRequest({
      client,
      id,
      actor: { id: auth.user.id, type: "user", role: auth.role },
      rejectionReason: parsed.rejectionReason,
      ipAddress: requestIpAddress(request),
      userAgent: requestUserAgent(request),
    });

    return NextResponse.json({ request: improvement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reject AI improvement request.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
