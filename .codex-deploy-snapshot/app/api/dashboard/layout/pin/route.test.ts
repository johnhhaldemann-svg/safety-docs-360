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
}));

import { POST } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getUserDashboardLayout, saveUserDashboardLayout } from "@/lib/dashboardLayoutSettings";
import { getDashboardRoleDefaultLayout } from "@/lib/dashboardLayout";

describe("POST /api/dashboard/layout/pin", () => {
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

  it("returns 401 when unauthorized", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/dashboard/layout/pin", {
        method: "POST",
        body: JSON.stringify({ blockId: "graph_hazard_trends" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid block id", async () => {
    mockAuthorized();
    const response = await POST(
      new Request("http://localhost/api/dashboard/layout/pin", {
        method: "POST",
        body: JSON.stringify({ blockId: "not_real" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("persists layout when pinning a new graph block", async () => {
    mockAuthorized();
    vi.mocked(getUserDashboardLayout).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    vi.mocked(saveUserDashboardLayout).mockResolvedValue({ error: null } as never);

    const response = await POST(
      new Request("http://localhost/api/dashboard/layout/pin", {
        method: "POST",
        body: JSON.stringify({ blockId: "graph_hazard_trends" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(saveUserDashboardLayout).toHaveBeenCalled();
    expect(payload.effectiveLayout).toHaveLength(10);
    expect(payload.effectiveLayout).toContain("graph_hazard_trends");
    expect(payload.layoutChanged).toBe(true);
    expect(getDashboardRoleDefaultLayout("company_admin")).not.toContain("graph_hazard_trends");
  });

  it("reports no layout change when the block is already on the dashboard", async () => {
    mockAuthorized();
    const layout = getDashboardRoleDefaultLayout("company_admin");
    vi.mocked(getUserDashboardLayout).mockResolvedValue({
      data: { user_id: "user-1", layout, updated_at: null },
      error: null,
    } as never);
    vi.mocked(saveUserDashboardLayout).mockResolvedValue({ error: null } as never);

    const response = await POST(
      new Request("http://localhost/api/dashboard/layout/pin", {
        method: "POST",
        body: JSON.stringify({ blockId: layout[0] }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.layoutChanged).toBe(false);
    expect(saveUserDashboardLayout).toHaveBeenCalled();
  });
});
