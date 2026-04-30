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
}));

import { authorizeRequest } from "@/lib/rbac";
import * as metricsRoute from "./metrics/route";
import * as callsRoute from "./calls/route";
import * as feedbackRoute from "./feedback/route";
import * as evalsRoute from "./evals/route";

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
});
