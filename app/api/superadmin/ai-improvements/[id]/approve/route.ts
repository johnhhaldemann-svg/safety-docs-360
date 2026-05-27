import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import {
  approveAiImprovementRequest,
  parseApprovalInput,
  recordAiImprovementAuditEvent,
  type AiImprovementActor,
} from "@/lib/superadmin/aiImprovementRequests";
import {
  getAiImprovementClient,
  requestIpAddress,
  requestUserAgent,
} from "../../_shared";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function logUnauthorizedApprovalAttempt(params: {
  client: ReturnType<typeof getAiImprovementClient>;
  requestId: string;
  actor: AiImprovementActor;
  request: Request;
  reason: string;
}) {
  await recordAiImprovementAuditEvent({
    client: params.client,
    requestId: params.requestId,
    actor: params.actor,
    eventType: "unauthorized_approval_attempt",
    ipAddress: requestIpAddress(params.request),
    userAgent: requestUserAgent(params.request),
    metadata: { reason: params.reason },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseApprovalInput(body);
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    const client = getAiImprovementClient({});
    await logUnauthorizedApprovalAttempt({
      client,
      requestId: id,
      actor: { type: parsed.actorType, role: null, id: null },
      request,
      reason: "authorization_failed",
    }).catch(() => undefined);
    return auth.error;
  }

  const client = getAiImprovementClient(auth.supabase);
  const actor = { id: auth.user.id, type: parsed.actorType, role: auth.role } satisfies AiImprovementActor;
  if (parsed.actorType !== "user" || normalizeAppRole(auth.role) !== "super_admin") {
    await logUnauthorizedApprovalAttempt({
      client,
      requestId: id,
      actor,
      request,
      reason: parsed.actorType !== "user" ? "non_user_actor" : "not_super_admin",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Super Admin user approval is required." }, { status: 403 });
  }

  try {
    const improvement = await approveAiImprovementRequest({
      client,
      id,
      actor,
      overrideReason: parsed.overrideReason,
      ipAddress: requestIpAddress(request),
      userAgent: requestUserAgent(request),
    });

    return NextResponse.json({ request: improvement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve AI improvement request.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
