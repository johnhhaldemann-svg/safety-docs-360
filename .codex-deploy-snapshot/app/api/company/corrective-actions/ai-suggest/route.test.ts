import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  blockIfCsepOnlyCompany,
  getCompanyScope,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  listCompanyAssignableUsers,
  requestAiResponsesText,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  listCompanyAssignableUsers: vi.fn(),
  requestAiResponsesText: vi.fn(),
}));

vi.mock("@/lib/ai/responses", () => ({ requestAiResponsesText }));
vi.mock("@/lib/ai/defaultModel", () => ({ resolveCompanyAiDefaultModel: () => "gpt-4o-mini" }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyAssignableUsers", () => ({ listCompanyAssignableUsers }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  isAdminRole: (role: string) => role === "admin" || role === "super_admin" || role === "platform_admin",
}));

import { POST } from "./route";

const ACTIVE_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Avery Patel",
  email: "avery@example.com",
  role: "Safety Manager",
  status: "active",
};

function makeSupabase(existingActions: Array<Record<string, unknown>> = []) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: existingActions, error: null }))
    ),
  };
  return {
    builder,
    from: vi.fn(() => builder),
  };
}

function requestBody(risk: Record<string, unknown>) {
  return new Request("https://example.com/api/company/corrective-actions/ai-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ risk }),
  });
}

describe("/api/company/corrective-actions/ai-suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    listCompanyAssignableUsers.mockResolvedValue([ACTIVE_USER]);
    requestAiResponsesText.mockResolvedValue({
      text: JSON.stringify({
        title: "Verify fall protection controls",
        description: "Pause affected work, inspect edge controls, and upload closure proof.",
        severity: "high",
        category: "fall_hazard",
        dueAt: "2026-05-21T17:00:00.000Z",
        assignedUserId: ACTIVE_USER.id,
        rationale: "Fall exposure needs immediate field verification.",
      }),
      json: {},
      meta: {
        model: "gpt-4o-mini",
        provider: "openai",
        promptHash: "hash",
        fallbackUsed: false,
        fallbackReason: null,
        attempts: 1,
        latencyMs: 1,
        usage: null,
        surface: "corrective-actions.ai-suggest",
      },
    });
  });

  it("returns an AI suggestion assigned to an active company user", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      supabase,
    });

    const response = requireRouteResponse(
      await POST(requestBody({
        id: "fall-risk",
        title: "Fall protection gap",
        riskLevel: "high",
        siteId: "site-1",
      }))
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.suggestion.assignedUserId).toBe(ACTIVE_USER.id);
    expect(json.suggestion.category).toBe("fall_hazard");
  });

  it("warns when no active users are available", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      supabase,
    });
    listCompanyAssignableUsers.mockResolvedValue([]);
    requestAiResponsesText.mockResolvedValue({
      text: JSON.stringify({
        title: "Review controls",
        description: "Review and verify the current control.",
        severity: "medium",
        category: "corrective_action",
        dueAt: "2026-05-27T17:00:00.000Z",
        assignedUserId: null,
        rationale: "A review is needed.",
      }),
      json: {},
      meta: {
        model: "gpt-4o-mini",
        provider: "openai",
        promptHash: "hash",
        fallbackUsed: false,
        fallbackReason: null,
        attempts: 1,
        latencyMs: 1,
        usage: null,
        surface: "corrective-actions.ai-suggest",
      },
    });

    const response = requireRouteResponse(
      await POST(requestBody({ id: "risk-1", title: "Housekeeping issue", riskLevel: "medium" }))
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.suggestion.assignedUserId).toBeNull();
    expect(json.suggestion.warning).toMatch(/No active company users/);
  });

  it("replaces an invalid AI assignee with an active company user", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      supabase,
    });
    requestAiResponsesText.mockResolvedValue({
      text: JSON.stringify({
        title: "Review controls",
        description: "Review and verify the current control.",
        severity: "medium",
        category: "corrective_action",
        dueAt: "2026-05-27T17:00:00.000Z",
        assignedUserId: "22222222-2222-4222-8222-222222222222",
        rationale: "A review is needed.",
      }),
      json: {},
      meta: {
        model: "gpt-4o-mini",
        provider: "openai",
        promptHash: "hash",
        fallbackUsed: false,
        fallbackReason: null,
        attempts: 1,
        latencyMs: 1,
        usage: null,
        surface: "corrective-actions.ai-suggest",
      },
    });

    const response = requireRouteResponse(
      await POST(requestBody({ id: "risk-1", title: "Housekeeping issue", riskLevel: "medium" }))
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.suggestion.assignedUserId).toBe(ACTIVE_USER.id);
    expect(json.suggestion.warning).toMatch(/outside the active company user list/);
  });

  it("dedupes when an open action already covers the risk", async () => {
    const supabase = makeSupabase([
      {
        id: "action-1",
        title: "Fall protection gap follow-up",
        description: "Risk signal: fall-risk.",
        status: "open",
      },
    ]);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      supabase,
    });

    const response = requireRouteResponse(
      await POST(requestBody({ id: "fall-risk", title: "Fall protection gap", riskLevel: "high" }))
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.existingAction.id).toBe("action-1");
    expect(requestAiResponsesText).not.toHaveBeenCalled();
  });
});
