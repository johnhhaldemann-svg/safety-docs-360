import { NextResponse } from "next/server";
import { POST as executeRiskRecommendationAction } from "@/app/api/company/risk-memory/recommendations/[id]/actions/route";
import { POST as syncAiSafetyActionQueue } from "@/app/api/company/ai/safety-action-queue/sync/route";
import {
  buildActionDecisionForwardBody,
  validateActionDecisionExecution,
  type AiActionDecisionExecutionInput,
} from "@/lib/aiActionDecisionWorkflow";

export const runtime = "nodejs";

function clean(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

async function jsonFrom(response: Response) {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

async function expectRouteResponse(response: Response | undefined, fallbackMessage: string) {
  if (response) return response;
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AiActionDecisionExecutionInput | null;
  const validation = validateActionDecisionExecution(body ?? {});
  if (!validation.ok) {
    const status = validation.mapping?.blocked ? 200 : 400;
    return NextResponse.json(
      {
        success: false,
        blocked: Boolean(validation.mapping?.blocked),
        error: validation.error,
        blockedReason: validation.blockedReason,
        executedAction: null,
        eventId: null,
        requiredConfirmationFields: validation.requiredConfirmationFields,
      },
      { status },
    );
  }

  if (validation.mapping.workflowAction === "sync_actions") {
    const syncRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        days: body?.days,
        jobsiteId: body?.jobsiteId,
      }),
    });
    const syncResponse = await expectRouteResponse(
      await syncAiSafetyActionQueue(syncRequest),
      "AI safety action sync did not return a response.",
    );
    const payload = await jsonFrom(syncResponse);
    return NextResponse.json(
      {
        ...(payload ?? {}),
        executedAction: "sync_actions",
        triggerId: clean(body?.triggerId, 120) || null,
        intent: validation.mapping.intent,
        blockedReason: null,
        eventId: null,
        requiredConfirmationFields: [],
      },
      { status: syncResponse.status },
    );
  }

  const recommendationId = clean(body?.recommendationId, 120);
  const forwardBody = buildActionDecisionForwardBody(body ?? {}, validation.mapping);
  const forwardedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(forwardBody),
  });
  const response = await expectRouteResponse(
    await executeRiskRecommendationAction(forwardedRequest, {
      params: Promise.resolve({ id: recommendationId }),
    }),
    "Recommendation action execution did not return a response.",
  );
  const payload = await jsonFrom(response);

  return NextResponse.json(
    {
      ...(payload ?? {}),
      executedAction: validation.mapping.workflowAction,
      triggerId: clean(body?.triggerId, 120) || null,
      intent: validation.mapping.intent,
      blockedReason: null,
      eventId: (payload?.eventId as string | null | undefined) ?? null,
      requiredConfirmationFields: [],
    },
    { status: response.status },
  );
}
