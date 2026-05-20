import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";
import { defaultPermitChecklistItems } from "@/lib/safePredictPermitForms";

const {
  authorizeRequest,
  getCompanyScope,
  canManageCompanyPermits,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  blockIfCsepOnlyCompany,
  buildPermitFacetRow,
  upsertRiskMemoryFacetSafe,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  canManageCompanyPermits: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  buildPermitFacetRow: vi.fn(),
  upsertRiskMemoryFacetSafe: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyFeatureAccess", () => ({ canManageCompanyPermits }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/riskMemory/facets", () => ({ buildPermitFacetRow, upsertRiskMemoryFacetSafe }));

import { PATCH, POST } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    role: "company_admin",
    permissionMap: {},
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

function completedPermitForm() {
  return {
    checklistItems: defaultPermitChecklistItems("Hot Work").map((item) => ({ ...item, checked: true })),
    acknowledgement: {
      acknowledged: true,
      name: "Jack Jane",
      acknowledgedAt: "2026-05-20T12:00:00.000Z",
      statement: "I acknowledge the permit checklist has been reviewed.",
    },
    notes: "Fire watch assigned.",
  };
}

describe("/api/company/permits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    canManageCompanyPermits.mockReturnValue(true);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    buildPermitFacetRow.mockReturnValue({ source_module: "permit" });
    upsertRiskMemoryFacetSafe.mockResolvedValue(undefined);
  });

  it("POST stores permit checklist acknowledgement metadata", async () => {
    const insert = queryBuilder({
      data: { id: "permit-1", status: "draft", source_metadata: {} },
      error: null,
    });
    authWithBuilders([
      queryBuilder({ data: { id: "jobsite-1", status: "active" }, error: null }),
      insert,
      queryBuilder({ data: null, error: null }),
    ]);

    const response = requireRouteResponse(await POST(new Request("https://example.com/api/company/permits", {
      method: "POST",
      body: JSON.stringify({
        title: "Hot work permit",
        permitType: "Hot Work",
        jobsiteId: "jobsite-1",
        permitForm: completedPermitForm(),
      }),
    })));

    expect(response.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      source_metadata: expect.objectContaining({
        permit_form_v1: expect.objectContaining({
          acknowledgement: expect.objectContaining({ name: "Jack Jane" }),
        }),
      }),
    }));
  });

  it("PATCH merges permit form metadata without removing existing source metadata", async () => {
    const update = queryBuilder({
      data: { id: "permit-1", status: "active", source_metadata: {} },
      error: null,
    });
    authWithBuilders([
      queryBuilder({
        data: {
          id: "permit-1",
          jobsite_id: "jobsite-1",
          status: "active",
          escalation_level: "none",
          stop_work_status: "normal",
          permit_type: "Hot Work",
          source_metadata: { auto_assignment_scope: "daily" },
        },
        error: null,
      }),
      update,
      queryBuilder({ data: null, error: null }),
    ]);

    const response = requireRouteResponse(await PATCH(new Request("https://example.com/api/company/permits", {
      method: "PATCH",
      body: JSON.stringify({
        id: "permit-1",
        permitForm: completedPermitForm(),
      }),
    })));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      source_metadata: expect.objectContaining({
        auto_assignment_scope: "daily",
        permit_form_v1: expect.objectContaining({
          notes: "Fire watch assigned.",
        }),
      }),
    }));
  });
});
