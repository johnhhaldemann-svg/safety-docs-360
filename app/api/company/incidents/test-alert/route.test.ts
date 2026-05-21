import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isCompanyRole: vi.fn(),
  getCompanyScope: vi.fn(),
  canManageCompanyIncidents: vi.fn(),
  dispatchIncidentAlertNotifications: vi.fn(),
  serverLog: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
  isCompanyRole: mocks.isCompanyRole,
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/companyFeatureAccess", () => ({
  canManageCompanyIncidents: mocks.canManageCompanyIncidents,
}));
vi.mock("@/lib/incidents/incidentNotificationDelivery", () => ({
  dispatchIncidentAlertNotifications: mocks.dispatchIncidentAlertNotifications,
}));
vi.mock("@/lib/serverLog", () => ({ serverLog: mocks.serverLog }));

import { POST } from "./route";

function request() {
  return new Request("https://example.com/api/company/incidents/test-alert", {
    method: "POST",
  });
}

describe("POST /api/company/incidents/test-alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue({
      role: "company_admin",
      permissionMap: {},
      team: "Summit Builders",
      supabase: { from: vi.fn() },
      user: {
        id: "user-1",
        email: "safety@example.com",
        user_metadata: { full_name: "Safety Manager" },
      },
    });
    mocks.isCompanyRole.mockReturnValue(true);
    mocks.getCompanyScope.mockResolvedValue({
      companyId: "company-1",
      companyName: "Summit Builders",
    });
    mocks.canManageCompanyIncidents.mockReturnValue(true);
    mocks.dispatchIncidentAlertNotifications.mockResolvedValue({
      attempted: true,
      recipients: 2,
      sent: 4,
      skipped: 0,
      failed: 0,
      error: null,
    });
  });

  it("dispatches a synthetic critical IDLH incident alert", async () => {
    const response = (await POST(request()))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      recipients: 2,
      sent: 4,
      skipped: 0,
      failed: 0,
    });
    expect(mocks.dispatchIncidentAlertNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTable: "company_incidents",
        actorUserId: "user-1",
        record: expect.objectContaining({
          companyId: "company-1",
          ownerUserId: "user-1",
          title: "TEST ONLY - Incident alert system check",
          severity: "critical",
          idlhFlag: true,
          sifFlag: true,
          stopWorkStatus: "stop_work_requested",
          escalationLevel: "critical",
        }),
      })
    );
  });

  it("rejects users who cannot manage incidents", async () => {
    mocks.canManageCompanyIncidents.mockReturnValue(false);

    const response = (await POST(request()))!;

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Only company admins and managers can send incident alert tests.",
    });
    expect(mocks.dispatchIncidentAlertNotifications).not.toHaveBeenCalled();
  });

  it("returns a warning response when every delivery fails", async () => {
    mocks.dispatchIncidentAlertNotifications.mockResolvedValue({
      attempted: true,
      recipients: 1,
      sent: 0,
      skipped: 0,
      failed: 2,
      error: "One or more incident alert deliveries failed.",
    });

    const response = (await POST(request()))!;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      recipients: 1,
      sent: 0,
      failed: 2,
      warning: "One or more incident alert deliveries failed.",
    });
    expect(mocks.serverLog).toHaveBeenCalledWith(
      "warn",
      "incident_alert_test_warning",
      expect.objectContaining({ companyId: "company-1", failed: 2 })
    );
  });
});
