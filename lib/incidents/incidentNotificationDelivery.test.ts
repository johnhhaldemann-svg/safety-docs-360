import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildIncidentAlertContent,
  createIncidentDeliveryDedupeKey,
  deliverIncidentAlert,
  isSevereIncidentAlert,
  sendIncidentAlertEmail,
  shouldDispatchIncidentAlert,
} from "@/lib/incidents/incidentNotificationDelivery";

describe("incident notification delivery helpers", () => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    INCIDENT_ALERT_FROM_EMAIL: process.env.INCIDENT_ALERT_FROM_EMAIL,
    WEATHER_ALERT_FROM_EMAIL: process.env.WEATHER_ALERT_FROM_EMAIL,
    COMPANY_INVITE_FROM_EMAIL: process.env.COMPANY_INVITE_FROM_EMAIL,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };

  afterEach(() => {
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.INCIDENT_ALERT_FROM_EMAIL = originalEnv.INCIDENT_ALERT_FROM_EMAIL;
    process.env.WEATHER_ALERT_FROM_EMAIL = originalEnv.WEATHER_ALERT_FROM_EMAIL;
    process.env.COMPANY_INVITE_FROM_EMAIL = originalEnv.COMPANY_INVITE_FROM_EMAIL;
    process.env.RESEND_FROM_EMAIL = originalEnv.RESEND_FROM_EMAIL;
    vi.restoreAllMocks();
  });

  const baseRecord = {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "22222222-2222-4222-8222-222222222222",
    jobsiteId: "33333333-3333-4333-8333-333333333333",
    title: "Fall from ladder",
    severity: "medium",
    category: "incident",
    fatality: false,
    idlhFlag: false,
    sifFlag: false,
    stopWorkStatus: "normal",
    createdAt: "2026-05-21T18:00:00.000Z",
  };

  it("classifies severe incident alert triggers", () => {
    expect(isSevereIncidentAlert({ ...baseRecord, severity: "critical" })).toBe(true);
    expect(isSevereIncidentAlert({ ...baseRecord, fatality: true })).toBe(true);
    expect(isSevereIncidentAlert({ ...baseRecord, idlhFlag: true })).toBe(true);
    expect(isSevereIncidentAlert({ ...baseRecord, sifFlag: true })).toBe(true);
    expect(isSevereIncidentAlert({ ...baseRecord, stopWorkStatus: "stop_work_requested" })).toBe(true);
    expect(isSevereIncidentAlert({ ...baseRecord, severity: "high" })).toBe(false);
  });

  it("dispatches on high first visibility and later severe escalation", () => {
    expect(
      shouldDispatchIncidentAlert({
        previous: null,
        next: { ...baseRecord, severity: "high" },
      })
    ).toBe(true);
    expect(
      shouldDispatchIncidentAlert({
        previous: { ...baseRecord, severity: "high" },
        next: { ...baseRecord, severity: "critical" },
      })
    ).toBe(true);
    expect(
      shouldDispatchIncidentAlert({
        previous: { ...baseRecord, severity: "critical" },
        next: { ...baseRecord, severity: "critical", title: "Edited title" },
      })
    ).toBe(false);
  });

  it("builds stable dedupe keys", () => {
    expect(
      createIncidentDeliveryDedupeKey({
        sourceTable: "company_incidents",
        sourceId: "incident-1",
        recipientUserId: "user-1",
        channel: "email",
      })
    ).toBe("company_incidents:incident-1:user:user-1:email:incident-alert-v1");
  });

  it("builds action-oriented urgent content", () => {
    const content = buildIncidentAlertContent({
      record: { ...baseRecord, fatality: true },
      jobsiteName: "Tower A",
    });
    expect(content.subject).toBe("Urgent Safety Notification: Fall from ladder");
    expect(content.text).toContain("Top drivers: Fatality");
    expect(content.text).toContain("Verify emergency response");
    expect(content.html).toContain("Tower A");
  });

  it("sends incident alert email through Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INCIDENT_ALERT_FROM_EMAIL = "alerts@example.com";
    delete process.env.WEATHER_ALERT_FROM_EMAIL;
    delete process.env.COMPANY_INVITE_FROM_EMAIL;
    delete process.env.RESEND_FROM_EMAIL;
    const fetcher = vi.fn(async () => Response.json({ id: "email-1" })) as unknown as typeof fetch;

    await expect(
      sendIncidentAlertEmail({
        toEmail: "safety@example.com",
        record: { ...baseRecord, idlhFlag: true },
        jobsiteName: "Tower A",
        fetcher,
      })
    ).resolves.toEqual({
      sent: true,
      status: "sent",
      providerMessageId: "email-1",
      error: null,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"from":"Urgent Safety Notification <alerts@example.com>"'),
      })
    );
  });

  it("records email delivery status", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INCIDENT_ALERT_FROM_EMAIL = "alerts@example.com";
    const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "delivery-1" }, error: null })),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert, update })) };
    const fetcher = vi.fn(async () => Response.json({ id: "email-1" })) as unknown as typeof fetch;

    await expect(
      deliverIncidentAlert({
        supabase: supabase as never,
        sourceTable: "company_incidents",
        record: { ...baseRecord, fatality: true },
        recipient: { userId: "user-1", email: "safety@example.com", name: "Safety Manager" },
        channel: "email",
        fetcher,
      })
    ).resolves.toMatchObject({ delivered: true, duplicate: false, skipped: false, error: null });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: baseRecord.companyId,
        source_table: "company_incidents",
        recipient_user_id: "user-1",
        channel: "email",
      })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        provider_message_id: "email-1",
        error_message: null,
      })
    );
  });

  it("skips email delivery when the recipient has no email", async () => {
    const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "delivery-1" }, error: null })),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert, update })) };

    await expect(
      deliverIncidentAlert({
        supabase: supabase as never,
        sourceTable: "company_incidents",
        record: { ...baseRecord, fatality: true },
        recipient: { userId: "user-1", email: null, name: "Safety Manager" },
        channel: "email",
      })
    ).resolves.toMatchObject({ delivered: false, skipped: true });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped", error_message: "No email address is available for this user." })
    );
  });
});
