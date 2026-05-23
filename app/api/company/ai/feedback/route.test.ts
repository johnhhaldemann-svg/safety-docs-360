import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: (role: string) => ["super_admin", "platform_admin", "admin"].includes(role),
  isCompanyRole: (role: string) =>
    ["company_admin", "safety_manager", "project_manager", "field_supervisor", "foreman", "field_user", "company_user"].includes(role),
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkFixedWindowRateLimit: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/superadmin/aiEngineOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/superadmin/aiEngineOperations")>();
  return {
    ...actual,
    recordAiEngineFeedback: vi.fn(async () => ({ ok: true, feedback: { id: 1 } })),
  };
});

import { authorizeRequest } from "@/lib/rbac";
import { recordAiEngineFeedback } from "@/lib/superadmin/aiEngineOperations";
import * as route from "./route";

const mockedAuthorize = vi.mocked(authorizeRequest);
const mockedRecord = vi.mocked(recordAiEngineFeedback);

function authForRole(role: string) {
  return {
    role,
    supabase: {},
    user: { id: "user-1" },
  } as never;
}

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/company/ai/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response.");
  return response;
}

describe("/api/company/ai/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects product feedback that contains raw generated or edited text fields", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("company_admin"));

    const response = expectResponse(await route.POST(
      request({
        surface: "permit-copilot",
        sourceId: "activity-1",
        outcome: "edited",
        rating: 3,
        reasonCode: "missing_controls",
        metadata: {
          workflowStep: "permit_copilot_suggestion",
          documentType: "hot_work",
          editDistanceRatio: 0.42,
          generatedText: "strip me",
        },
      })
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Raw AI prompt");
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("stores sanitized metadata for customer workflows", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("safety_manager"));

    const response = expectResponse(await route.POST(
      request({
        surface: "safety-intelligence.document",
        sourceId: "doc-1",
        outcome: "accepted",
        rating: 5,
        reasonCode: "field_ready",
        metadata: {
          workflowStep: "safety_intelligence_document_generation",
          documentType: "jsa",
          usedInField: true,
          promptHash: "ignored",
        },
      })
    ));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        surface: "safety-intelligence.document",
        sourceId: "doc-1",
        outcome: "accepted",
        rating: 5,
        reason: "field_ready",
        signalMetadata: expect.objectContaining({
          workflowStep: "safety_intelligence_document_generation",
          documentType: "jsa",
          reasonCode: "field_ready",
          usedInField: true,
          userRole: "safety_manager",
        }),
      })
    );
  });

  it("stores AI Engine recommendation feedback labels as reason metadata", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("safety_manager"));

    const response = expectResponse(await route.POST(
      request({
        surface: "ai-engine.daily-briefing",
        sourceId: "control-1",
        outcome: "edited",
        rating: 2,
        reasonCode: "missing_information",
        metadata: {
          workflowStep: "daily_safety_command_center",
          recommendationFeedback: "missing_information",
        },
      })
    ));

    expect(response.status).toBe(201);
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        surface: "ai-engine.daily-briefing",
        sourceId: "control-1",
        outcome: "edited",
        rating: 2,
        reason: "missing_information",
        signalMetadata: expect.objectContaining({
          workflowStep: "daily_safety_command_center",
          reasonCode: "missing_information",
          userRole: "safety_manager",
        }),
      })
    );
  });

  it("allows platform admins to write but blocks unauthenticated users", async () => {
    mockedAuthorize.mockResolvedValueOnce(authForRole("platform_admin"));
    const allowed = expectResponse(await route.POST(request({ surface: "company-memory.assist", outcome: "accepted" })));
    expect(allowed.status).toBe(201);

    mockedAuthorize.mockResolvedValueOnce({ error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as never);
    const rejected = expectResponse(await route.POST(request({ surface: "company-memory.assist", outcome: "accepted" })));
    expect(rejected.status).toBe(401);
  });

  it("rejects invalid surfaces, invalid outcomes, and demo roles", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("company_admin"));
    expect(expectResponse(await route.POST(request({ surface: "unknown", outcome: "accepted" }))).status).toBe(400);
    expect(expectResponse(await route.POST(request({ surface: "permit-copilot", outcome: "liked" }))).status).toBe(400);

    mockedAuthorize.mockResolvedValue(authForRole("sales_demo"));
    expect(expectResponse(await route.POST(request({ surface: "permit-copilot", outcome: "accepted" }))).status).toBe(403);
  });

  it("does not expose a company feedback history read endpoint", () => {
    expect((route as { GET?: unknown }).GET).toBeUndefined();
  });
});
