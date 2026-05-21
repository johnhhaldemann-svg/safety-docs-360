import { beforeEach, describe, expect, it, vi } from "vitest";

const { isCronRequestAuthorized, createSupabaseAdminClient, autoAssignSchedulePermits } = vi.hoisted(() => ({
  isCronRequestAuthorized: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  autoAssignSchedulePermits: vi.fn(),
}));

vi.mock("@/lib/cronAuth", () => ({ isCronRequestAuthorized }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/schedulePermitAutoAssignment", () => ({ autoAssignSchedulePermits }));

import { GET } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.limit.mockResolvedValue(result);
  return builder;
}

function request() {
  return new Request("https://example.com/api/cron/ai-engine-permit-auto-assign");
}

describe("GET /api/cron/ai-engine-permit-auto-assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCronRequestAuthorized.mockReturnValue(true);
    const jobsites = queryBuilder({
      data: [
        { id: "jobsite-1", company_id: "company-1", status: "active" },
        { id: "jobsite-closed", company_id: "company-1", status: "closed" },
      ],
      error: null,
    });
    createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => jobsites) });
    autoAssignSchedulePermits.mockResolvedValue({
      success: true,
      createdPermits: [{ permitId: "permit-1" }],
      skippedPermits: [],
      unassignedPermits: [],
    });
  });

  it("rejects unauthorized cron requests", async () => {
    isCronRequestAuthorized.mockReturnValue(false);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(autoAssignSchedulePermits).not.toHaveBeenCalled();
  });

  it("runs weekly permit auto-assignment for active jobsites only", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      scope: "weekly",
      attempted: 1,
      succeeded: 1,
      createdPermits: 1,
    });
    expect(autoAssignSchedulePermits).toHaveBeenCalledTimes(1);
    expect(autoAssignSchedulePermits).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        scope: "weekly",
        actorUserId: null,
      })
    );
  });
});
