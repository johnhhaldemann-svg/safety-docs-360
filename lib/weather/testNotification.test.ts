import { afterEach, describe, expect, it, vi } from "vitest";
import { sendJobsiteWeatherTestNotification } from "@/lib/weather/testNotification";

describe("weather test notification", () => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    WEATHER_ALERT_FROM_EMAIL: process.env.WEATHER_ALERT_FROM_EMAIL,
    COMPANY_INVITE_FROM_EMAIL: process.env.COMPANY_INVITE_FROM_EMAIL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  };

  afterEach(() => {
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.WEATHER_ALERT_FROM_EMAIL = originalEnv.WEATHER_ALERT_FROM_EMAIL;
    process.env.COMPANY_INVITE_FROM_EMAIL = originalEnv.COMPANY_INVITE_FROM_EMAIL;
    process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
    process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    process.env.TWILIO_FROM_NUMBER = originalEnv.TWILIO_FROM_NUMBER;
    process.env.TWILIO_MESSAGING_SERVICE_SID = originalEnv.TWILIO_MESSAGING_SERVICE_SID;
    vi.restoreAllMocks();
  });

  it("sends email and SMS to active workforce profiles assigned to the jobsite", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.WEATHER_ALERT_FROM_EMAIL = "alerts@example.com";
    delete process.env.COMPANY_INVITE_FROM_EMAIL;
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;

    const from = vi.fn((table: string) => {
      if (table === "company_jobsite_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }
      if (table === "company_employee_jobsite_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    company_id: "company-1",
                    jobsite_id: "jobsite-1",
                    employee_id: "employee-1",
                    status: "active",
                  },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "user_roles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }
      if (table === "company_employee_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: "employee-1",
                    company_id: "company-1",
                    full_name: "Morgan Rivera",
                    email: "morgan@example.com",
                    phone: "5552221309",
                    phone_normalized: "5552221309",
                    status: "active",
                  },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const fetcher = vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch;

    await expect(
      sendJobsiteWeatherTestNotification({
        supabase: { from } as never,
        jobsite: {
          id: "jobsite-1",
          company_id: "company-1",
          name: "Hillcrest Office Fit-Out",
          zip_code: "53022",
          project_manager: "Morgan Ellis",
          safety_lead: "Grace Monroe",
          weather_latitude: 43.2286,
          weather_longitude: -88.1246,
        },
        channels: ["email", "sms"],
        fetcher,
      })
    ).resolves.toMatchObject({
      ok: true,
      recipientsSeen: 1,
      deliveriesSent: 2,
      deliveriesFailed: 0,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends configured email and skips SMS when Twilio is not configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.WEATHER_ALERT_FROM_EMAIL = "weather@example.com";
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;

    const from = vi.fn((table: string) => {
      if (table === "company_jobsite_assignments") {
        return { select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) };
      }
      if (table === "company_employee_jobsite_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [{ company_id: "company-1", jobsite_id: "jobsite-1", employee_id: "employee-1", status: "active" }],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "user_roles") {
        return { select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) };
      }
      if (table === "company_employee_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: "employee-1",
                    company_id: "company-1",
                    full_name: "Morgan Rivera",
                    email: "morgan@example.com",
                    phone: "5552221309",
                    phone_normalized: "5552221309",
                    status: "active",
                  },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const fetcher = vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch;

    await expect(
      sendJobsiteWeatherTestNotification({
        supabase: { from } as never,
        jobsite: {
          id: "jobsite-1",
          company_id: "company-1",
          name: "Hillcrest Office Fit-Out",
          zip_code: "53022",
          project_manager: null,
          safety_lead: null,
          weather_latitude: 43.2286,
          weather_longitude: -88.1246,
        },
        channels: ["email", "sms"],
        fetcher,
      })
    ).resolves.toMatchObject({
      ok: true,
      recipientsSeen: 1,
      deliveriesSent: 1,
      deliveriesSkipped: 1,
      deliveriesFailed: 0,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
  });
});
