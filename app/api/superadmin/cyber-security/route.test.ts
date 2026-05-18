import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/superadmin/cyberSecurityMonitor", () => ({
  buildCyberSecuritySnapshot: vi.fn(async () => ({
    generatedAt: "2026-05-18T12:00:00.000Z",
    monitoredUrl: "https://example.com/",
    overallStatus: "healthy",
    postureScore: 100,
    summary: { totalChecks: 1, healthy: 1, warning: 0, critical: 0, unknown: 0 },
    website: { url: "https://example.com/", statusCode: 200, responseTimeMs: 120, checks: [], headers: [] },
    telemetry: {
      companies: 1,
      securityEventsLast24h: 0,
      securityEventsLast7d: 0,
      sensitiveEventsLast7d: 0,
      pendingDataRequests: 0,
      suspendedAccounts: 0,
      recentEvents: [],
      checks: [],
    },
    compliance: { documents: [], checks: [] },
    controlGroups: [],
  })),
}));

import { authorizeRequest } from "@/lib/rbac";
import { buildCyberSecuritySnapshot } from "@/lib/superadmin/cyberSecurityMonitor";
import { GET, POST } from "./route";

const mockedAuthorize = vi.mocked(authorizeRequest);
const mockedBuildSnapshot = vi.mocked(buildCyberSecuritySnapshot);

function authForRole(role: string) {
  return {
    role,
    supabase: {},
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/cyber-security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["platform_admin", "admin", "company_admin", "sales_demo"])(
    "rejects %s from the cyber security monitor",
    async (role) => {
      mockedAuthorize.mockResolvedValue(authForRole(role));

      const response = requireRouteResponse(
        await GET(new Request("https://example.com/api/superadmin/cyber-security"))
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain("Super admin access required");
      expect(mockedBuildSnapshot).not.toHaveBeenCalled();
    }
  );

  it("allows super admins to read the cyber security snapshot", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/cyber-security"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.postureScore).toBe(100);
    expect(mockedAuthorize).toHaveBeenCalledWith(expect.any(Request), {
      requirePermission: "can_access_internal_admin",
      allowPending: true,
      allowSuspended: true,
    });
    expect(mockedBuildSnapshot).toHaveBeenCalledWith({
      admin: expect.any(Object),
      requestUrl: "https://example.com/api/superadmin/cyber-security",
    });
  });

  it("supports POST for explicit reruns from the page", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/cyber-security", { method: "POST" }))
    );

    expect(response.status).toBe(200);
  });
});
