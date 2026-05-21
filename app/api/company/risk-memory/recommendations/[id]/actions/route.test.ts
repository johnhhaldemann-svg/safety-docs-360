import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  isAdminRole,
  getCompanyScope,
  companyHasCsepPlanName,
  csepWorkspaceForbiddenResponse,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  validateCompanyAssignableUserId,
  createSupabaseAdminClient,
  recordAiEngineFeedback,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn(),
  getCompanyScope: vi.fn(),
  companyHasCsepPlanName: vi.fn(),
  csepWorkspaceForbiddenResponse: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  validateCompanyAssignableUserId: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  recordAiEngineFeedback: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest, isAdminRole };
});
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ companyHasCsepPlanName, csepWorkspaceForbiddenResponse }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/companyAssignableUsers", () => ({ validateCompanyAssignableUserId }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/superadmin/aiEngineOperations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/superadmin/aiEngineOperations")>("@/lib/superadmin/aiEngineOperations");
  return { ...actual, recordAiEngineFeedback };
});

import { POST } from "./route";

function chain<T extends Record<string, unknown>>(extra: T) {
  const obj: Record<string, unknown> = { ...extra };
  obj.eq = vi.fn(() => obj);
  obj.select = vi.fn(() => obj);
  return obj as T & {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  };
}

function buildSupabase() {
  const recommendationLookup = vi.fn(async () => ({
    data: {
      id: "rec-1",
      company_id: "company-1",
      jobsite_id: "jobsite-1",
      title: "Verify fall protection",
      body: "Assign a competent person to verify controls.",
      status: "active",
      priority: "high",
      action_type: "create_corrective_action",
      owner_user_id: null,
      due_at: null,
      linked_module: null,
      linked_record_id: null,
      verification_required: true,
      mitigation_state: "unverified",
      risk_reduction_points: 0,
      accepted_at: null,
    },
    error: null,
  }));
  const updateSingle = vi.fn(async () => ({
    data: {
      id: "rec-1",
      status: "accepted",
      action_type: "create_corrective_action",
      linked_module: "corrective_action",
      linked_record_id: "action-1",
      mitigation_state: "linked_action_created",
      risk_reduction_points: 0,
    },
    error: null,
  }));
  const correctiveSingle = vi.fn(async () => ({ data: { id: "action-1" }, error: null }));
  const eventInsert = vi.fn(async () => ({ data: null, error: null }));
  const tables: Record<string, unknown> = {
    company_risk_ai_recommendations: {
      select: vi.fn(() => chain({ maybeSingle: recommendationLookup })),
      update: vi.fn(() => chain({ single: updateSingle })),
    },
    company_corrective_actions: {
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: correctiveSingle })) })),
    },
    company_risk_recommendation_events: {
      insert: eventInsert,
    },
  };
  const supabase = {
    from: vi.fn((table: string) => tables[table]),
  };
  return { supabase, recommendationLookup, updateSingle, correctiveSingle, eventInsert, tables };
}

describe("/api/company/risk-memory/recommendations/[id]/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    companyHasCsepPlanName.mockResolvedValue(false);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    validateCompanyAssignableUserId.mockResolvedValue({ assignedUserId: null, error: null });
    createSupabaseAdminClient.mockReturnValue(null);
    recordAiEngineFeedback.mockResolvedValue(undefined);
  });

  it("rejects field users", async () => {
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "user-1" },
      supabase: buildSupabase().supabase,
    });

    const response = requireRouteResponse(await POST(
      new Request("https://example.com/api/company/risk-memory/recommendations/rec-1/actions", {
        method: "POST",
        body: JSON.stringify({ actionType: "assign" }),
      }),
      { params: Promise.resolve({ id: "rec-1" }) }
    ));

    expect(response.status).toBe(403);
  });

  it("creates a linked corrective action without applying mitigation credit yet", async () => {
    const { supabase, updateSingle, correctiveSingle, eventInsert } = buildSupabase();
    authorizeRequest.mockResolvedValue({
      role: "safety_manager",
      user: { id: "user-1" },
      supabase,
    });

    const response = requireRouteResponse(await POST(
      new Request("https://example.com/api/company/risk-memory/recommendations/rec-1/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "create_corrective_action", jobsiteId: "jobsite-1" }),
      }),
      { params: Promise.resolve({ id: "rec-1" }) }
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.linkedModule).toBe("corrective_action");
    expect(body.riskReductionPoints).toBe(0);
    expect(correctiveSingle).toHaveBeenCalledTimes(1);
    expect(updateSingle).toHaveBeenCalledTimes(1);
    expect(eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "corrective_action_created",
      to_status: "accepted",
    }));
  });
});
