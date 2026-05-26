import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  sendGusEmailNotification: vi.fn(),
  createCompanyNotification: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest: mocks.authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/gus/gusEmailNotifications", () => ({ sendGusEmailNotification: mocks.sendGusEmailNotification }));
vi.mock("@/lib/companyNotifications", () => ({ createCompanyNotification: mocks.createCompanyNotification }));

import { POST } from "@/app/api/gus/notifications/email/route";

function emailRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/gus/notifications/email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function supabaseWithSettings(settings: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "user_profiles") throw new Error(`Unexpected table ${table}`);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { gus_notification_settings: settings },
          error: null,
        }),
      };
    }),
  };
}

describe("Gus email notification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    mocks.sendGusEmailNotification.mockResolvedValue({
      sent: true,
      status: "sent",
      providerMessageId: "email_123",
      payload: {
        actionHref: "/dashboard",
        subject: "Review permit gap",
      },
    });
    mocks.createCompanyNotification.mockResolvedValue({ skipped: false, notification: { id: "n1" }, error: null });
  });

  it("rejects direct email sends when Gus email notifications are disabled", async () => {
    mocks.authorizeRequest.mockResolvedValue({
      supabase: supabaseWithSettings({ emailEnabled: false }),
      user: { id: "user-1", email: "safety@example.com" },
      team: "Builder Co",
    });

    const response = (await POST(emailRequest({ confirmed: true, message: "Review the permit gap." }))) as Response;
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toContain("turned off");
    expect(mocks.sendGusEmailNotification).not.toHaveBeenCalled();
    expect(mocks.createCompanyNotification).not.toHaveBeenCalled();
  });

  it("skips noncritical notification-center records when Gus in-app records are disabled", async () => {
    mocks.authorizeRequest.mockResolvedValue({
      supabase: supabaseWithSettings({ inAppEnabled: false, emailEnabled: true }),
      user: { id: "user-1", email: "safety@example.com" },
      team: "Builder Co",
    });

    const response = (await POST(
      emailRequest({
        confirmed: true,
        message: "Routine review note.",
        priority: 3,
        category: "reminder",
        attentionLevel: "low",
      }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(mocks.sendGusEmailNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createCompanyNotification).not.toHaveBeenCalled();
  });

  it("persists critical Gus notification-center records even when routine in-app records are disabled", async () => {
    mocks.authorizeRequest.mockResolvedValue({
      supabase: supabaseWithSettings({ inAppEnabled: false, emailEnabled: true }),
      user: { id: "user-1", email: "safety@example.com" },
      team: "Builder Co",
    });

    const response = (await POST(
      emailRequest({
        confirmed: true,
        message: "Stop-work review is needed.",
        priority: 1,
        category: "warning",
        attentionLevel: "critical",
      }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(mocks.createCompanyNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "gus_email_notification",
        priority: "critical",
        ignorePreference: true,
      }),
    );
  });
});
