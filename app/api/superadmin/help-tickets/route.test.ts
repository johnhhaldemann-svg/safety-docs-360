import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, createSupabaseAdminClient } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  normalizeAppRole: (role?: string | null) => role ?? "viewer",
}));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));

import { GET as LIST } from "./route";
import { PATCH } from "./[id]/route";

function authForRole(role: string) {
  return {
    role,
    user: { id: "super-1", email: "super@example.com" },
    supabase: { from: vi.fn() },
  };
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    submitter_user_id: "user-1",
    submitter_email: "worker@example.com",
    company_name: "Acme Safety",
    category: "bug",
    priority: "critical",
    status: "open",
    title: "Preview failed",
    description: "The preview failed after clicking generate.",
    created_at: "2026-05-26T00:00:00.000Z",
    updated_at: "2026-05-26T00:00:00.000Z",
    ...overrides,
  };
}

function createListAdmin(data: unknown[] = [ticketRow()]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return { from: vi.fn(() => query), query };
}

function createPatchAdmin(data: unknown = ticketRow({ status: "resolved" })) {
  const update = vi.fn(() => query);
  const query = {
    update,
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return { from: vi.fn(() => query), query, update };
}

describe("/api/superadmin/help-tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    authorizeRequest.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = requireRouteResponse(
      await LIST(new Request("https://example.com/api/superadmin/help-tickets"))
    );

    expect(response.status).toBe(401);
  });

  it("rejects non-superadmin roles", async () => {
    authorizeRequest.mockResolvedValue(authForRole("admin"));
    createSupabaseAdminClient.mockReturnValue(createListAdmin());

    const response = requireRouteResponse(
      await LIST(new Request("https://example.com/api/superadmin/help-tickets"))
    );

    expect(response.status).toBe(403);
  });

  it("allows superadmins to list the ticket queue", async () => {
    const admin = createListAdmin();
    authorizeRequest.mockResolvedValue(authForRole("super_admin"));
    createSupabaseAdminClient.mockReturnValue(admin);

    const response = requireRouteResponse(
      await LIST(
        new Request("https://example.com/api/superadmin/help-tickets?status=open&priority=critical")
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tickets).toHaveLength(1);
    expect(body.summary.critical).toBe(1);
    expect(admin.query.eq).toHaveBeenCalledWith("status", "open");
    expect(admin.query.eq).toHaveBeenCalledWith("priority", "critical");
  });

  it("allows superadmins to mark seen and update status", async () => {
    const admin = createPatchAdmin();
    authorizeRequest.mockResolvedValue(authForRole("super_admin"));
    createSupabaseAdminClient.mockReturnValue(admin);

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/help-tickets/ticket-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "resolved",
            priority: "high",
            adminNotes: "Confirmed and fixed.",
            markSeen: true,
          }),
        }),
        { params: Promise.resolve({ id: "ticket-1" }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ticket.status).toBe("resolved");
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "resolved",
        priority: "high",
        admin_notes: "Confirmed and fixed.",
        superadmin_seen_by: "super-1",
      })
    );
  });
});

