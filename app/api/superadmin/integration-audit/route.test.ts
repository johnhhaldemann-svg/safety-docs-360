import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/superadmin/integrationAudit", () => ({
  buildProductionIntegrationAudit: vi.fn(async () => ({
    generatedAt: "2026-05-26T20:00:00.000Z",
    sourceOfTruth: "production",
    project: {
      supabaseRef: "mdqkfbnwxrasdmbsjcqv",
      vercelProjectId: "prj_1",
      vercelProjectName: "safety-docs-360",
      vercelOrgId: "team_1",
      latestLocalMigration: "20260526173110",
      latestRemoteMigration: "20260526173110",
    },
    summary: { totalChecks: 1, healthy: 1, warning: 0, critical: 0, unknown: 0 },
    nodes: [],
    edges: [],
    checks: [],
    topIssues: [],
  })),
}));

import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildProductionIntegrationAudit } from "@/lib/superadmin/integrationAudit";
import { GET, POST } from "./route";

const mockedAuthorize = vi.mocked(authorizeRequest);
const mockedCreateAdmin = vi.mocked(createSupabaseAdminClient);
const mockedBuildAudit = vi.mocked(buildProductionIntegrationAudit);

function authForRole(role: string) {
  return {
    role,
    supabase: {},
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/integration-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-superadmin roles", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/integration-audit"))
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Super admin access required");
    expect(mockedBuildAudit).not.toHaveBeenCalled();
  });

  it("allows super admins to read the production integration audit", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/integration-audit"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sourceOfTruth).toBe("production");
    expect(mockedAuthorize).toHaveBeenCalledWith(expect.any(Request), {
      requirePermission: "can_access_internal_admin",
      allowPending: true,
      allowSuspended: true,
    });
    expect(mockedBuildAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: expect.any(Object),
        liveVercelAccessError: expect.stringContaining("403 Forbidden"),
      })
    );
    expect(mockedCreateAdmin).toHaveBeenCalled();
  });

  it("supports POST for explicit reruns from the page", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/integration-audit", { method: "POST" }))
    );

    expect(response.status).toBe(200);
  });
});
