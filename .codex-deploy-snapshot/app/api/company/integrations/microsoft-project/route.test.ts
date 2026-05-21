import { requireRouteResponse } from "@/lib/routeResponseTest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  authorizeRequest,
  isAdminRole,
  getCompanyScope,
  blockIfCsepOnlyCompany,
  buildMicrosoftAuthorizeUrl,
  getMicrosoftProjectStatus,
  runMicrosoftProjectSync,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  buildMicrosoftAuthorizeUrl: vi.fn(),
  getMicrosoftProjectStatus: vi.fn(),
  runMicrosoftProjectSync: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/microsoftProject", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/microsoftProject")>();
  return {
    ...actual,
    buildMicrosoftAuthorizeUrl,
    getMicrosoftProjectStatus,
    runMicrosoftProjectSync,
  };
});

import * as statusRoute from "./status/route";
import * as connectRoute from "./connect/route";
import * as callbackRoute from "./callback/route";
import * as syncRoute from "./sync/route";

describe("/api/company/integrations/microsoft-project routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockImplementation((role: string) => role === "admin" || role === "super_admin");
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Company" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.com" },
      role: "company_admin",
      team: "Company",
      supabase: {},
    });
  });

  it("status returns auth errors", async () => {
    authorizeRequest.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = requireRouteResponse(
      await statusRoute.GET(new Request("https://example.com/api/company/integrations/microsoft-project/status"))
    );
    expect(response.status).toBe(401);
  });

  it("connect returns an authorization URL", async () => {
    buildMicrosoftAuthorizeUrl.mockReturnValue({
      authorizationUrl: "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
      scopes: ["User.Read"],
      dataverseEnvironmentUrl: "https://tenant.crm.dynamics.com",
    });

    const response = requireRouteResponse(
      await connectRoute.POST(
        new Request("https://example.com/api/company/integrations/microsoft-project/connect", {
          method: "POST",
          body: JSON.stringify({ dataverseEnvironmentUrl: "https://tenant.crm.dynamics.com" }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authorizationUrl).toContain("login.microsoftonline.com");
    expect(buildMicrosoftAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        userId: "user-1",
        dataverseEnvironmentUrl: "https://tenant.crm.dynamics.com",
      })
    );
  });

  it("sync blocks roles that cannot manage the integration", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1", email: "field@example.com" },
      role: "field_supervisor",
      team: "Company",
      supabase: {},
    });

    const response = requireRouteResponse(
      await syncRoute.POST(
        new Request("https://example.com/api/company/integrations/microsoft-project/sync", { method: "POST" })
      )
    );
    expect(response.status).toBe(403);
    expect(runMicrosoftProjectSync).not.toHaveBeenCalled();
  });

  it("sync runs for company admins", async () => {
    runMicrosoftProjectSync.mockResolvedValue({
      status: "succeeded",
      projectsSeen: 1,
      projectsImported: 1,
      tasksSeen: 2,
      tasksImported: 2,
      assignmentsSeen: 1,
      assignmentsImported: 1,
      warnings: [],
    });

    const response = requireRouteResponse(
      await syncRoute.POST(
        new Request("https://example.com/api/company/integrations/microsoft-project/sync", { method: "POST" })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projectsImported).toBe(1);
    expect(runMicrosoftProjectSync).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-1", actorUserId: "user-1" })
    );
  });

  it("callback redirects when Microsoft omits the authorization code", async () => {
    const response = requireRouteResponse(
      await callbackRoute.GET(
        new Request("https://example.com/api/company/integrations/microsoft-project/callback?state=abc")
      )
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get("location")).toContain("microsoftProject=error");
  });

  it("status returns connector status", async () => {
    getMicrosoftProjectStatus.mockResolvedValue({
      configured: { configured: true },
      connected: true,
      connection: { status: "connected" },
      latestRun: null,
      counts: { projects: 1, tasks: 2 },
    });

    const response = requireRouteResponse(
      await statusRoute.GET(new Request("https://example.com/api/company/integrations/microsoft-project/status"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.counts.tasks).toBe(2);
  });
});
