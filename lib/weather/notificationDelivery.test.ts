import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWeatherNotificationText,
  createWeatherDeliveryDedupeKey,
  deliverWeatherNotification,
} from "@/lib/weather/notificationDelivery";

describe("weather notification delivery helpers", () => {
  const originalEnv = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  };

  afterEach(() => {
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
    expect(content.subject).toBe("Weather Alert: Severe Thunderstorm Warning");
    expect(content.text).toContain("123 Main Build");
    expect(content.text).toContain("secure loose materials");
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
