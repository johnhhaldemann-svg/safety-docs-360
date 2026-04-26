import { requireRouteResponse } from "@/lib/routeResponseTest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, isAdminRole, getCompanyScope, blockIfCsepOnlyCompany, getJobsiteAccessScope } =
  vi.hoisted(() => ({
    authorizeRequest: vi.fn(),
    isAdminRole: vi.fn(),
    getCompanyScope: vi.fn(),
    blockIfCsepOnlyCompany: vi.fn(),
    getJobsiteAccessScope: vi.fn(),
  }));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobsiteAccess")>();
  return {
    ...actual,
    getJobsiteAccessScope,
  };
});

import { POST } from "./route";

describe("/api/company/field-sync/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when role cannot run toolbox", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: {},
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/field-sync/batch", {
          method: "POST",
          body: JSON.stringify({
            operations: [
              {
                opId: "1",
                kind: "toolbox_session_create",
                jobsiteId: "jobsite-1",
              },
            ],
          }),
        })
      )
    );
    expect(response.status).toBe(403);
  });

  it("marks toolbox_session_upsert as conflict when server row is newer than ifUnmodifiedSince", async () => {
    const maybeSingleRead = vi.fn().mockResolvedValue({
      data: {
        jobsite_id: "jobsite-1",
        updated_at: "2026-04-02T12:00:00.000Z",
      },
      error: null,
    });
    const chainRead = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleRead,
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "company_toolbox_sessions") {
          return chainRead;
        }
        return chainRead;
      }),
    };

    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "field_supervisor",
      team: null,
      supabase,
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/field-sync/batch", {
          method: "POST",
          body: JSON.stringify({
            operations: [
              {
                opId: "op-1",
                kind: "toolbox_session_upsert",
                sessionId: "session-1",
                ifUnmodifiedSince: "2026-04-01T12:00:00.000Z",
                patch: { status: "completed" },
              },
            ],
          }),
        })
      )
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ opId: string; ok: boolean; conflict?: boolean; error?: string }>;
    };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      opId: "op-1",
      ok: false,
      conflict: true,
      error: "Server has newer changes.",
    });
  });

  it("rejects toolbox_session_create for jobsite outside restricted scope", async () => {
    getJobsiteAccessScope.mockResolvedValue({ restricted: true, jobsiteIds: ["jobsite-allowed"] });

    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      supabase: {},
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/field-sync/batch", {
          method: "POST",
          body: JSON.stringify({
            operations: [
              {
                opId: "1",
                kind: "toolbox_session_create",
                jobsiteId: "other-jobsite",
              },
            ],
          }),
        })
      )
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ opId: string; ok: boolean; error?: string }>;
    };
    expect(body.results[0]).toMatchObject({
      opId: "1",
      ok: false,
      error: "Invalid jobsite.",
    });
  });
});
