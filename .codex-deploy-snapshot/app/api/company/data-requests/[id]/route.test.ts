import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, recordCompanySecurityEvent } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  recordCompanySecurityEvent: vi.fn(),
}));

vi.mock("@/lib/companyScope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/companyScope")>("@/lib/companyScope");
  return { ...actual, getCompanyScope };
});

vi.mock("@/lib/companySecurityEvents", () => ({ recordCompanySecurityEvent }));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest };
});

import { PATCH } from "./route";

function createPatchClient(existing: unknown, updated: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
  const selectQuery = {
    eq: vi.fn(() => selectQuery),
    maybeSingle,
  };
  const single = vi.fn().mockResolvedValue({ data: updated, error: null });
  const updateSelect = vi.fn(() => ({ single }));
  const updateQuery = {
    eq: vi.fn(() => updateQuery),
    select: updateSelect,
  };
  const update = vi.fn(() => updateQuery);
  const select = vi.fn(() => selectQuery);
  const from = vi.fn(() => ({ select, update }));
  return { client: { from }, update, updateQuery };
}

describe("/api/company/data-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    recordCompanySecurityEvent.mockResolvedValue({ skipped: false, error: null });
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1" },
      permissionMap: { can_manage_company_users: true },
      supabase: {},
    });
  });

  it("updates request status and records completion evidence", async () => {
    const existing = {
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "company-1",
      request_type: "export",
      request_scope: "company",
      status: "reviewing",
      title: "Export company records",
    };
    const updated = {
      ...existing,
      status: "completed",
      completed_by: "admin-1",
      completed_at: "2026-05-17T16:00:00.000Z",
    };
    const { client, update } = createPatchClient(existing, updated);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1" },
      permissionMap: { can_manage_company_users: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await PATCH(
        new Request(
          "https://example.com/api/company/data-requests/11111111-1111-4111-8111-111111111111",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed", completionEvidence: "Export delivered." }),
          }
        ),
        { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) }
      )
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      completed_by: "admin-1",
      completion_evidence: "Export delivered.",
    }));
    expect(recordCompanySecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "data_request_completed",
      resourceId: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("rejects invalid statuses", async () => {
    const existing = {
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "company-1",
      request_type: "export",
      request_scope: "company",
      status: "submitted",
      title: "Export company records",
    };
    const { client } = createPatchClient(existing, existing);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1" },
      permissionMap: { can_manage_company_users: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await PATCH(
        new Request(
          "https://example.com/api/company/data-requests/11111111-1111-4111-8111-111111111111",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "invalid" }),
          }
        ),
        { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) }
      )
    );

    expect(response.status).toBe(400);
  });
});
