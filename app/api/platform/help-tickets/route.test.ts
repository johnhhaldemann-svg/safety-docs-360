import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, checkFixedWindowRateLimit } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  checkFixedWindowRateLimit: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/rateLimit", () => ({ checkFixedWindowRateLimit }));

import { GET, POST } from "./route";

function authWithSupabase(supabase: unknown = {}) {
  return {
    user: {
      id: "user-1",
      email: "worker@example.com",
      user_metadata: { full_name: "Worker One" },
    },
    role: "company_user",
    team: "Acme",
    supabase,
  };
}

function createListClient(data: unknown[] = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data, error: null })),
  };
  return {
    query,
    supabase: { from: vi.fn(() => query) },
  };
}

function createInsertClient() {
  const single = vi.fn(async () => ({
    data: {
      id: "ticket-1",
      submitter_user_id: "user-1",
      category: "bug",
      priority: "high",
      status: "open",
      title: "Preview failed",
      description: "The preview failed after clicking generate.",
      created_at: "2026-05-26T00:00:00.000Z",
      updated_at: "2026-05-26T00:00:00.000Z",
    },
    error: null,
  }));
  const selectAfterInsert = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: selectAfterInsert }));
  const table = { insert };
  return {
    insert,
    supabase: { from: vi.fn(() => table) },
  };
}

describe("/api/platform/help-tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkFixedWindowRateLimit.mockReturnValue({ ok: true });
    getCompanyScope.mockResolvedValue({
      companyId: "00000000-0000-4000-8000-000000000001",
      companyName: "Acme Safety",
    });
  });

  it("returns 401 when unauthorized", async () => {
    authorizeRequest.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/platform/help-tickets"))
    );

    expect(response.status).toBe(401);
  });

  it("lists only tickets submitted by the current user", async () => {
    const { query, supabase } = createListClient();
    authorizeRequest.mockResolvedValue(authWithSupabase(supabase));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/platform/help-tickets"))
    );

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("submitter_user_id", "user-1");
  });

  it("creates a valid signed-in help ticket", async () => {
    const { insert, supabase } = createInsertClient();
    authorizeRequest.mockResolvedValue(authWithSupabase(supabase));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/platform/help-tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "bug",
            priority: "high",
            title: "Preview failed",
            description: "The preview failed after clicking generate.",
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ticket.id).toBe("ticket-1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        submitter_user_id: "user-1",
        company_id: "00000000-0000-4000-8000-000000000001",
        submitter_email: "worker@example.com",
      })
    );
  });

  it("rejects invalid ticket details", async () => {
    authorizeRequest.mockResolvedValue(authWithSupabase({}));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/platform/help-tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "safety_incident",
            priority: "urgent",
            title: "Bad",
            description: "No",
          }),
        })
      )
    );

    expect(response.status).toBe(400);
  });

  it("rate limits ticket creation", async () => {
    authorizeRequest.mockResolvedValue(authWithSupabase({}));
    checkFixedWindowRateLimit.mockReturnValue({ ok: false, retryAfterSec: 60 });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/platform/help-tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "bug",
            priority: "normal",
            title: "Preview failed",
            description: "The preview failed after clicking generate.",
          }),
        })
      )
    );

    expect(response.status).toBe(429);
  });
});

