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

import { GET, POST } from "./route";

function createListClient(rows: unknown[] = []) {
  const range = vi.fn().mockResolvedValue({ data: rows, count: rows.length, error: null });
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range,
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  return { client: { from }, query };
}

function createInsertClient(row: unknown) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from }, insert };
}

describe("/api/company/data-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    recordCompanySecurityEvent.mockResolvedValue({ skipped: false, error: null });
  });

  it("returns company data requests for company admins", async () => {
    const { client, query } = createListClient([
      {
        id: "request-1",
        company_id: "company-1",
        request_type: "export",
        request_scope: "company",
        status: "submitted",
        title: "Export request",
      },
    ]);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1" },
      permissionMap: { can_manage_company_users: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/data-requests?limit=5"))
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.requests).toHaveLength(1);
    expect(query.range).toHaveBeenCalledWith(0, 4);
  });

  it("rejects invalid data request payloads", async () => {
    const { client } = createInsertClient({});
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1" },
      permissionMap: { can_manage_company_users: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/data-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType: "unknown", title: "Bad request" }),
        })
      )
    );

    expect(response.status).toBe(400);
  });

  it("creates a data request and logs the security event", async () => {
    const created = {
      id: "request-1",
      company_id: "company-1",
      request_type: "export",
      request_scope: "company",
      status: "submitted",
      title: "Export company records",
      subject_email: null,
    };
    const { client, insert } = createInsertClient(created);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1" },
      permissionMap: { can_manage_company_users: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/data-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "export",
            requestScope: "company",
            title: "Export company records",
          }),
        })
      )
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      company_id: "company-1",
      request_type: "export",
      request_scope: "company",
      requested_by: "admin-1",
    }));
    expect(recordCompanySecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "data_request_submitted",
      resourceId: "request-1",
    }));
  });
});
