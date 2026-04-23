import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  normalizeAppRole: (role?: string | null) =>
    (role ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_"),
}));

vi.mock("@/lib/dashboardLayoutSettings", () => ({
  getUserDashboardLayout: vi.fn(),
  saveUserDashboardLayout: vi.fn(),
  deleteUserDashboardLayout: vi.fn(),
}));

import { DELETE, GET, PATCH } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import {
  deleteUserDashboardLayout,
  getUserDashboardLayout,
  saveUserDashboardLayout,
} from "@/lib/dashboardLayoutSettings";
import { getDashboardRoleDefaultLayout } from "@/lib/dashboardLayout";

describe("/api/dashboard/layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockAuthorized() {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      permissionMap: {
        can_manage_company_users: true,
        can_manage_users: true,
        can_view_analytics: true,
        can_view_reports: true,
      },
      supabase: {},
      user: { id: "user-1" },
    } as never);
  }

  it("rejects unauthorized access", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await GET(new Request("http://localhost/api/dashboard/layout"));
    expect(response.status).toBe(401);
  });

  it("returns the role default layout when no saved row exists", async () => {
    mockAuthorized();
    vi.mocked(getUserDashboardLayout).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const response = await GET(new Request("http://localhost/api/dashboard/layout"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.savedLayout).toBeNull();
    expect(payload.defaultLayout).toEqual(getDashboardRoleDefaultLayout("company_admin"));
    expect(payload.effectiveLayout).toHaveLength(10);
    expect(payload.availableBlocks).toHaveLength(19);
  });

  it("rejects malformed patch payloads", async () => {
    mockAuthorized();

    const response = await PATCH(
      new Request("http://localhost/api/dashboard/layout", {
        method: "PATCH",
        body: JSON.stringify({ layout: ["metric_primary"] }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("exactly 10");
  });

  it("persists a valid layout", async () => {
    mockAuthorized();
    vi.mocked(saveUserDashboardLayout).mockResolvedValue({ error: null } as never);

    const layout = [
      "metric_primary",
      "metric_secondary",
      "metric_tertiary",
      "metric_quaternary",
      "priority_queue",
      "next_actions",
      "recent_activity",
      "recent_documents",
      "recent_reports",
      "risk_ranking",
    ];

    const response = await PATCH(
      new Request("http://localhost/api/dashboard/layout", {
        method: "PATCH",
        body: JSON.stringify({ layout }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(saveUserDashboardLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        layout,
      })
    );
    expect(payload.savedLayout).toEqual(layout);
    expect(payload.effectiveLayout).toEqual(layout);
  });

  it("self-heals malformed saved layouts on read", async () => {
    mockAuthorized();
    vi.mocked(getUserDashboardLayout).mockResolvedValue({
      data: {
        user_id: "user-1",
        layout: ["metric_primary", "metric_primary", "recent_activity"],
        updated_at: null,
      },
      error: null,
    } as never);
    vi.mocked(saveUserDashboardLayout).mockResolvedValue({ error: null } as never);

    const response = await GET(new Request("http://localhost/api/dashboard/layout"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.savedLayout).toHaveLength(10);
    expect(new Set(payload.savedLayout).size).toBe(10);
    expect(saveUserDashboardLayout).toHaveBeenCalled();
  });

  it("deletes the saved row and returns the default layout", async () => {
    mockAuthorized();
    vi.mocked(deleteUserDashboardLayout).mockResolvedValue({ error: null } as never);

    const response = await DELETE(
      new Request("http://localhost/api/dashboard/layout", {
        method: "DELETE",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(deleteUserDashboardLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
      })
    );
    expect(payload.savedLayout).toBeNull();
    expect(payload.effectiveLayout).toEqual(getDashboardRoleDefaultLayout("company_admin"));
  });
});
