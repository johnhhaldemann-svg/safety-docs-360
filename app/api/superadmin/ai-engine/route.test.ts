import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/superadmin/aiEngineOperations", () => ({
  getAiEngineMetrics: vi.fn(async () => ({
    summary: { totalCalls: 0, fallbackCalls: 0, fallbackRate: 0, failedCalls: 0, failureRate: 0 },
    bySurface: [],
    byModel: [],
    byProvider: [],
    recentFailures: [],
  })),
  getAiEngineCalls: vi.fn(async () => ({ rows: [], count: 0 })),
  getAiEngineFeedback: vi.fn(async () => ({ rows: [], count: 0 })),
  recordAiEngineFeedback: vi.fn(async () => ({ ok: true, feedback: { id: 1 } })),
  getAiEngineEvalSummary: vi.fn(() => ({ totalFixtures: 0, surfaces: [] })),
  getAiEngineRecommendationSnapshot: vi.fn(async () => ({
    snapshot: null,
    stale: true,
    recommendations: [],
    summary: "No snapshot.",
  })),
  refreshAiEngineRecommendationSnapshot: vi.fn(async () => ({
    ok: true,
    recommendations: [],
    summary: "Snapshot refreshed.",
  })),
  validateAiEngineToolNames: vi.fn((tools?: string[] | null) => {
    const allowed = new Set([
      "get_ai_metrics",
      "get_ai_calls",
      "get_eval_coverage",
      "get_feedback_signals",
      "get_visual_job_health",
      "get_release_gate_snapshot",
    ]);
    const invalid = (tools ?? []).filter((tool) => !allowed.has(tool));
    return invalid.length ? { ok: false, invalid } : { ok: true, tools: tools ?? ["get_ai_metrics"] };
  }),
  runAiEngineDiagnostics: vi.fn(async () => ({
    ok: true,
    toolResults: [],
    toolResultsSummary: [{ toolName: "get_ai_metrics", rowCount: 0, evidenceIds: [] }],
    recommendations: [],
    summary: "Diagnostics refreshed.",
    summaryMeta: { toolCallsUsed: 1 },
  })),
}));

import { authorizeRequest } from "@/lib/rbac";
import * as metricsRoute from "./metrics/route";
import * as callsRoute from "./calls/route";
import * as feedbackRoute from "./feedback/route";
import * as evalsRoute from "./evals/route";
import * as recommendationsRoute from "./recommendations/route";
import * as diagnosticsRoute from "./diagnostics/route";
import * as aiEngineOperations from "@/lib/superadmin/aiEngineOperations";

const mockedAuthorize = vi.mocked(authorizeRequest);

function authForRole(role: string) {
  return {
    role,
    supabase: {},
    user: { id: "user-1" },
  } as never;
}

function expectResponse(response: Response | undefined): Response {
  if (!response) {
    throw new Error("Expected route handler to return a response");
  }
  return response;
}

describe("/api/superadmin/ai-engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["platform_admin", "admin", "company_admin", "marketing", "sales_demo"])(
    "rejects %s from AI Engine metrics",
    async (role) => {
      mockedAuthorize.mockResolvedValue(authForRole(role));

      const response = expectResponse(
        await metricsRoute.GET(new Request("https://example.com/api/superadmin/ai-engine/metrics"))
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain("Super admin access required");
      expect(mockedAuthorize).toHaveBeenCalledWith(expect.any(Request), {
        requirePermission: "can_access_internal_admin",
        allowPending: true,
        allowSuspended: true,
      });

      const recommendationsResponse = expectResponse(
        await recommendationsRoute.GET(
          new Request("https://example.com/api/superadmin/ai-engine/recommendations")
        )
      );
      expect(recommendationsResponse.status).toBe(403);
    }
  );

  it("allows super admins to read each AI Engine endpoint", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    await expect(
      metricsRoute.GET(new Request("https://example.com/api/superadmin/ai-engine/metrics"))
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      callsRoute.GET(new Request("https://example.com/api/superadmin/ai-engine/calls"))
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      feedbackRoute.GET(new Request("https://example.com/api/superadmin/ai-engine/feedback"))
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      evalsRoute.GET(new Request("https://example.com/api/superadmin/ai-engine/evals"))
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      recommendationsRoute.GET(new Request("https://example.com/api/superadmin/ai-engine/recommendations"))
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      diagnosticsRoute.POST(
        new Request("https://example.com/api/superadmin/ai-engine/diagnostics", {
          method: "POST",
          body: JSON.stringify({ surface: "all", tools: ["get_ai_metrics"] }),
        })
      )
    ).resolves.toMatchObject({ status: 200 });
  });

  it("records learning-loop feedback only for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = expectResponse(
      await feedbackRoute.POST(
        new Request("https://example.com/api/superadmin/ai-engine/feedback", {
          method: "POST",
          body: JSON.stringify({
            surface: "safety-intelligence",
            sourceId: "run-1",
            outcome: "accepted",
            rating: 5,
            reason: "Good deterministic fallback copy.",
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.feedback.id).toBe(1);
  });

  it("refreshes recommendation snapshots only for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = expectResponse(
      await recommendationsRoute.POST(
        new Request("https://example.com/api/superadmin/ai-engine/recommendations", {
          method: "POST",
          body: JSON.stringify({ surface: "all", windowDays: 7 }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.summary).toBe("Snapshot refreshed.");
  });

  it("reads recommendation snapshots without recomputing", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = expectResponse(
      await recommendationsRoute.GET(
        new Request("https://example.com/api/superadmin/ai-engine/recommendations?surface=all&windowDays=7")
      )
    );

    expect(response.status).toBe(200);
    expect(aiEngineOperations.getAiEngineRecommendationSnapshot).toHaveBeenCalledTimes(1);
    expect(aiEngineOperations.refreshAiEngineRecommendationSnapshot).not.toHaveBeenCalled();
  });

  it("rejects invalid read-only diagnostic tools", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = expectResponse(
      await diagnosticsRoute.POST(
        new Request("https://example.com/api/superadmin/ai-engine/diagnostics", {
          method: "POST",
          body: JSON.stringify({ tools: ["drop_database"] }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid AI Engine tool");
    expect(aiEngineOperations.runAiEngineDiagnostics).not.toHaveBeenCalled();
  });
});
