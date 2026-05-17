import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/companyScope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/companyScope")>("@/lib/companyScope");
  return { ...actual, getCompanyScope };
});

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest };
});

import { GET } from "./route";

function createSecurityEventsClient(rows: unknown[] = []) {
  const range = vi.fn().mockResolvedValue({ data: rows, count: rows.length, error: null });
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range,
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  return { client: { from }, query, select, range };
}

describe("/api/company/security/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
  });

  it("returns paginated company security events for managers", async () => {
    const { client, query } = createSecurityEventsClient([
      {
        id: "event-1",
        company_id: "company-1",
        event_type: "user_invited",
        resource_type: "company_invite",
        title: "Company invite created",
        occurred_at: "2026-05-17T16:00:00.000Z",
      },
    ]);
    authorizeRequest.mockResolvedValue({
      role: "manager",
      team: "Builder Co",
      user: { id: "manager-1" },
      permissionMap: { can_view_analytics: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/security/events?limit=10"))
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(1);
    expect(query.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(query.range).toHaveBeenCalledWith(0, 9);
  });

  it("denies read-only users even when the auth layer allowed the request", async () => {
    const { client } = createSecurityEventsClient();
    authorizeRequest.mockResolvedValue({
      role: "read_only",
      team: "Builder Co",
      user: { id: "viewer-1" },
      permissionMap: { can_view_analytics: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/security/events"))
    );

    expect(response.status).toBe(403);
  });

  it("ignores cross-company selectors for company-scoped managers", async () => {
    const { client, query } = createSecurityEventsClient();
    authorizeRequest.mockResolvedValue({
      role: "manager",
      team: "Builder Co",
      user: { id: "manager-1" },
      permissionMap: { can_view_analytics: true },
      supabase: client,
    });

    await GET(
      new Request("https://example.com/api/company/security/events?companyId=company-2")
    );

    expect(query.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(query.eq).not.toHaveBeenCalledWith("company_id", "company-2");
  });
});
