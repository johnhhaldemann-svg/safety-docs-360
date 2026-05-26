import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { executeRiskRecommendationAction, syncAiSafetyActionQueue } = vi.hoisted(() => ({
  executeRiskRecommendationAction: vi.fn(),
  syncAiSafetyActionQueue: vi.fn(),
}));

vi.mock("@/app/api/company/risk-memory/recommendations/[id]/actions/route", () => ({
  POST: executeRiskRecommendationAction,
}));

vi.mock("@/app/api/company/ai/safety-action-queue/sync/route", () => ({
  POST: syncAiSafetyActionQueue,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/company/ai/action-decision/execute", {
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/company/ai/action-decision/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeRiskRecommendationAction.mockResolvedValue(Response.json({
      success: true,
      recommendation: { id: "rec-1", status: "assigned" },
      riskReductionPoints: 0,
    }));
    syncAiSafetyActionQueue.mockResolvedValue(Response.json({
      success: true,
      insertedCount: 1,
      skippedDuplicateCount: 0,
    }));
  });

  it("delegates assignment intents to the existing recommendation action route", async () => {
    const response = requireRouteResponse(await POST(request({
      recommendationId: "rec-1",
      triggerId: "trigger-assign",
      intent: "request_assignment",
      confirmation: true,
    })));
    const body = await response.json();
    const forwardedRequest = executeRiskRecommendationAction.mock.calls[0]?.[0] as Request;
    const forwardedBody = await forwardedRequest.json();

    expect(response.status).toBe(200);
    expect(body.executedAction).toBe("assign");
    expect(executeRiskRecommendationAction).toHaveBeenCalledWith(
      expect.any(Request),
      { params: expect.any(Promise) },
    );
    expect(forwardedBody).toEqual(
      expect.objectContaining({
        actionType: "assign",
        actionDecisionIntent: "request_assignment",
        actionDecisionTriggerId: "trigger-assign",
      }),
    );
  });

  it("requires field verification before marking a recommendation field-used", async () => {
    const response = requireRouteResponse(await POST(request({
      recommendationId: "rec-1",
      intent: "request_field_verification",
      confirmation: true,
    })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.requiredConfirmationFields).toEqual(["fieldVerificationSummary"]);
    expect(executeRiskRecommendationAction).not.toHaveBeenCalled();
  });

  it("requires a dismiss reason for dismiss or ignore intents", async () => {
    const response = requireRouteResponse(await POST(request({
      recommendationId: "rec-1",
      intent: "request_dismissal",
      confirmation: true,
    })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.requiredConfirmationFields).toEqual(["dismissReason"]);
    expect(executeRiskRecommendationAction).not.toHaveBeenCalled();
  });

  it("blocks authority intents without mutating recommendations", async () => {
    const response = requireRouteResponse(await POST(request({
      intent: "blocked_authority",
      confirmation: true,
    })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.blocked).toBe(true);
    expect(body.blockedReason).toMatch(/cannot approve/i);
    expect(executeRiskRecommendationAction).not.toHaveBeenCalled();
    expect(syncAiSafetyActionQueue).not.toHaveBeenCalled();
  });

  it("delegates sync intents to the existing action queue sync route", async () => {
    const response = requireRouteResponse(await POST(request({
      intent: "sync_actions",
      confirmation: true,
      days: 30,
      jobsiteId: "jobsite-1",
    })));
    const body = await response.json();
    const forwardedRequest = syncAiSafetyActionQueue.mock.calls[0]?.[0] as Request;
    const forwardedBody = await forwardedRequest.json();

    expect(response.status).toBe(200);
    expect(body.executedAction).toBe("sync_actions");
    expect(forwardedBody).toEqual({ days: 30, jobsiteId: "jobsite-1" });
  });
});
