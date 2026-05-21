import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWeatherNotificationText,
  createWeatherDeliveryDedupeKey,
  deliverWeatherNotification,
  normalizeSmsPhoneNumber,
  sendWeatherAlertEmail,
} from "@/lib/weather/notificationDelivery";

describe("weather notification delivery helpers", () => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    WEATHER_ALERT_FROM_EMAIL: process.env.WEATHER_ALERT_FROM_EMAIL,
    COMPANY_INVITE_FROM_EMAIL: process.env.COMPANY_INVITE_FROM_EMAIL,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  };

  it("normalizes U.S. SMS numbers to E.164 before provider delivery", () => {
    expect(normalizeSmsPhoneNumber("262-290-1309")).toBe("+12622901309");
    expect(normalizeSmsPhoneNumber("(262) 290-1309")).toBe("+12622901309");
    expect(normalizeSmsPhoneNumber("1-262-290-1309")).toBe("+12622901309");
    expect(normalizeSmsPhoneNumber("12345")).toBeNull();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.WEATHER_ALERT_FROM_EMAIL = originalEnv.WEATHER_ALERT_FROM_EMAIL;
    process.env.COMPANY_INVITE_FROM_EMAIL = originalEnv.COMPANY_INVITE_FROM_EMAIL;
    process.env.RESEND_FROM_EMAIL = originalEnv.RESEND_FROM_EMAIL;
    process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
    process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    process.env.TWILIO_FROM_NUMBER = originalEnv.TWILIO_FROM_NUMBER;
    process.env.TWILIO_MESSAGING_SERVICE_SID = originalEnv.TWILIO_MESSAGING_SERVICE_SID;
    vi.restoreAllMocks();
  });

  it("builds stable delivery dedupe keys", () => {
    expect(
      createWeatherDeliveryDedupeKey({
        jobsiteId: "site-1",
        userId: "user-1",
        nwsAlertId: "alert-1",
        channel: "email",
      })
    ).toBe("site-1:user-1:alert-1:email");
  });

  it("builds action-oriented notification content", () => {
    const content = buildWeatherNotificationText({
      alertEventId: "event-1",
      companyId: "company-1",
      jobsiteId: "site-1",
      jobsiteName: "123 Main Build",
      zipCode: "10001",
      alert: {
        id: "alert-1",
        eventName: "Severe Thunderstorm Warning",
        severity: "Severe",
        urgency: "Immediate",
        certainty: "Likely",
        headline: "Storm warning",
        description: "Description",
        instruction: "Check site conditions and secure loose materials.",
        effectiveAt: "2026-05-20T19:45:00Z",
        expiresAt: "2026-05-20T21:15:00Z",
        status: "Actual",
        rawPayload: {},
      },
    });
    expect(content.subject).toBe("Urgent Safety Notification: Severe Thunderstorm Warning");
    expect(content.html).toContain("Urgent Safety Notification");
    expect(content.text).toContain("123 Main Build");
    expect(content.text).toContain("secure loose materials");
  });

  it("sends weather email with urgent safety notification sender name", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.WEATHER_ALERT_FROM_EMAIL = "alerts@example.com";
    delete process.env.COMPANY_INVITE_FROM_EMAIL;
    delete process.env.RESEND_FROM_EMAIL;
    const fetcher = vi.fn(async () => Response.json({ id: "email-1" })) as unknown as typeof fetch;

    await expect(
      sendWeatherAlertEmail({
        toEmail: "field@example.com",
        fetcher,
        context: {
          alertEventId: "event-1",
          companyId: "company-1",
          jobsiteId: "site-1",
          jobsiteName: "123 Main Build",
          zipCode: "10001",
          alert: {
            id: "alert-1",
            eventName: "Severe Thunderstorm Warning",
            severity: "Severe",
            urgency: "Immediate",
            certainty: "Likely",
            headline: "Storm warning",
            description: "Description",
            instruction: "Check site conditions and secure loose materials.",
            effectiveAt: "2026-05-20T19:45:00Z",
            expiresAt: "2026-05-20T21:15:00Z",
            status: "Actual",
            rawPayload: {},
          },
        },
      })
    ).resolves.toEqual({ sent: true, error: null });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: expect.stringContaining('"from":"Urgent Safety Notification <alerts@example.com>"'),
      })
    );
  });

  it("uses the company invite sender when no dedicated weather sender is configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.WEATHER_ALERT_FROM_EMAIL;
    process.env.COMPANY_INVITE_FROM_EMAIL = "SafetyDocs360 <invites@example.com>";
    delete process.env.RESEND_FROM_EMAIL;
    const fetcher = vi.fn(async () => Response.json({ id: "email-1" })) as unknown as typeof fetch;

    await expect(
      sendWeatherAlertEmail({
        toEmail: "field@example.com",
        fetcher,
        context: {
          alertEventId: "event-1",
          companyId: "company-1",
          jobsiteId: "site-1",
          jobsiteName: "123 Main Build",
          zipCode: "10001",
          alert: {
            id: "alert-1",
            eventName: "Severe Thunderstorm Warning",
            severity: "Severe",
            urgency: "Immediate",
            certainty: "Likely",
            headline: "Storm warning",
            description: "Description",
            instruction: "Check site conditions and secure loose materials.",
            effectiveAt: "2026-05-20T19:45:00Z",
            expiresAt: "2026-05-20T21:15:00Z",
            status: "Actual",
            rawPayload: {},
          },
        },
      })
    ).resolves.toEqual({ sent: true, error: null });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: expect.stringContaining('"from":"Urgent Safety Notification <invites@example.com>"'),
      })
    );
  });

  it("sends weather alert SMS through Twilio and records the delivery", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;

    const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "delivery-1" }, error: null })),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert, update })) };
    const fetcher = vi.fn(async () => Response.json({ sid: "SM123" })) as unknown as typeof fetch;

    await expect(
      deliverWeatherNotification({
        supabase: supabase as never,
        recipient: {
          userId: "user-1",
          phone: "(555) 222-3333",
          channels: ["sms"],
        },
        channel: "sms",
        context: {
          alertEventId: "event-1",
          companyId: "company-1",
          jobsiteId: "site-1",
          jobsiteName: "123 Main Build",
          zipCode: "10001",
          alert: {
            id: "alert-1",
            eventName: "Winter Storm Warning",
            severity: "Severe",
            urgency: "Expected",
            certainty: "Likely",
            headline: "Snow expected",
            description: "Description",
            instruction: "Review site conditions.",
            effectiveAt: "2026-05-20T19:45:00Z",
            expiresAt: "2026-05-20T21:15:00Z",
            status: "Actual",
            rawPayload: {},
          },
        },
        fetcher,
      })
    ).resolves.toMatchObject({ delivered: true, duplicate: false, skipped: false });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: expect.stringContaining("To=%2B15552223333"),
      })
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        recipient_employee_id: null,
        channel: "sms",
      })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", sent_at: expect.any(String), error_message: null })
    );
  });

  it("records SMS deliveries for workforce profile recipients", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;

    const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "delivery-1" }, error: null })),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert, update })) };
    const fetcher = vi.fn(async () => Response.json({ sid: "SM123" })) as unknown as typeof fetch;

    await expect(
      deliverWeatherNotification({
        supabase: supabase as never,
        recipient: {
          employeeId: "employee-1",
          phone: "(555) 222-3333",
          channels: ["sms"],
        },
        channel: "sms",
        context: {
          alertEventId: "event-1",
          companyId: "company-1",
          jobsiteId: "site-1",
          jobsiteName: "123 Main Build",
          zipCode: "10001",
          alert: {
            id: "alert-1",
            eventName: "Winter Storm Warning",
            severity: "Severe",
            urgency: "Expected",
            certainty: "Likely",
            headline: "Snow expected",
            description: "Description",
            instruction: "Review site conditions.",
            effectiveAt: "2026-05-20T19:45:00Z",
            expiresAt: "2026-05-20T21:15:00Z",
            status: "Actual",
            rawPayload: {},
          },
        },
        fetcher,
      })
    ).resolves.toMatchObject({ delivered: true, duplicate: false, skipped: false });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        recipient_employee_id: "employee-1",
        dedupe_key: "site-1:employee:employee-1:alert-1:sms",
      })
    );
  });

  it("skips SMS delivery when the recipient has no phone", async () => {
    const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "delivery-1" }, error: null })),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert, update })) };

    await expect(
      deliverWeatherNotification({
        supabase: supabase as never,
        recipient: { userId: "user-1", channels: ["sms"] },
        channel: "sms",
        context: {
          alertEventId: "event-1",
          companyId: "company-1",
          jobsiteId: "site-1",
          jobsiteName: "123 Main Build",
          alert: {
            id: "alert-1",
            eventName: "Winter Storm Warning",
            severity: "Severe",
            urgency: "Expected",
            certainty: "Likely",
            headline: "Snow expected",
            description: "Description",
            instruction: "Review site conditions.",
            effectiveAt: "2026-05-20T19:45:00Z",
            expiresAt: "2026-05-20T21:15:00Z",
            status: "Actual",
            rawPayload: {},
          },
        },
      })
    ).resolves.toMatchObject({ delivered: false, skipped: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped", error_message: "No phone number is available for this user." })
    );
  });
});
