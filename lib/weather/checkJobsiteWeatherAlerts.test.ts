import { afterEach, describe, expect, it, vi } from "vitest";

const deliverWeatherNotificationMock = vi.hoisted(() =>
  vi.fn(async () => ({ delivered: true, duplicate: false, skipped: false, error: null }))
);

vi.mock("@/lib/weather/notificationDelivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather/notificationDelivery")>();
  return {
    ...actual,
    deliverWeatherNotification: deliverWeatherNotificationMock,
  };
});

import {
  checkJobsiteWeatherAlerts,
  isJobsiteWeatherNotificationsEnabled,
} from "@/lib/weather/checkJobsiteWeatherAlerts";

describe("jobsite weather cron", () => {
  const originalFeatureFlag = process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS;

  afterEach(() => {
    process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS = originalFeatureFlag;
    deliverWeatherNotificationMock.mockClear();
  });

  it("is feature-flagged off by default", async () => {
    delete process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS;
    expect(isJobsiteWeatherNotificationsEnabled()).toBe(false);
    await expect(checkJobsiteWeatherAlerts()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      jobsitesSeen: 0,
    });
  });

  it("updates the last checked timestamp even when no active alerts are found", async () => {
    const update = vi.fn(() => ({ eq: vi.fn() }));
    const from = vi.fn((table: string) => {
      if (table === "company_jobsites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: "jobsite-1",
                        company_id: "company-1",
                        name: "Main site",
                        zip_code: "53022",
                        weather_latitude: 43.2286,
                        weather_longitude: -88.1246,
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
          update,
        };
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      };
    });
    const supabase = { from, auth: { admin: { getUserById: vi.fn() } } };
    const nwsClient = { getActiveAlerts: vi.fn().mockResolvedValue([]) };

    await expect(
      checkJobsiteWeatherAlerts({
        supabase: supabase as never,
        nwsClient: nwsClient as never,
        requireFeatureFlag: false,
        sendNotifications: false,
      })
    ).resolves.toMatchObject({
      ok: true,
      jobsitesSeen: 1,
      locationsSeen: 1,
      alertsSeen: 0,
      locationsFailed: 0,
    });

    expect(update).toHaveBeenCalledWith({ weather_last_checked_at: expect.any(String) });
  });

  it("notifies assigned PMs and matched site leads by email and SMS", async () => {
    process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS = "true";
    const update = vi.fn(() => ({ eq: vi.fn() }));
    const upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "event-1" }, error: null })),
      })),
    }));
    const from = vi.fn((table: string) => {
      if (table === "company_jobsites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: "jobsite-1",
                        company_id: "company-1",
                        name: "Main site",
                        zip_code: "53022",
                        project_manager: "Avery Patel",
                        safety_lead: "Maria Chen",
                        weather_latitude: 43.2286,
                        weather_longitude: -88.1246,
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
          update,
        };
      }
      if (table === "jobsite_weather_subscriptions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      if (table === "company_jobsite_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [{ company_id: "company-1", jobsite_id: "jobsite-1", user_id: "pm-1", role: "project_manager" }],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "user_roles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  { company_id: "company-1", user_id: "pm-1", role: "project_manager", account_status: "active" },
                  { company_id: "company-1", user_id: "lead-1", role: "foreman", account_status: "active" },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  { user_id: "pm-1", full_name: "Avery Patel", preferred_name: null, phone: "5551112222" },
                  { user_id: "lead-1", full_name: "Maria Chen", preferred_name: null, phone: "5553334444" },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "company_employee_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }
      if (table === "weather_alert_events") {
        return { upsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = {
      from,
      auth: {
        admin: {
          getUserById: vi.fn(async (userId: string) => ({
            data: { user: { email: `${userId}@example.com`, user_metadata: {} } },
          })),
        },
      },
    };
    const nwsClient = {
      getActiveAlerts: vi.fn().mockResolvedValue([
        {
          id: "nws-alert-1",
          eventName: "Severe Thunderstorm Warning",
          severity: "Severe",
          urgency: "Immediate",
          certainty: "Likely",
          headline: "Storm warning",
          description: "Description",
          instruction: "Secure loose materials.",
          effectiveAt: "2026-05-20T19:45:00Z",
          expiresAt: "2026-05-20T21:15:00Z",
          status: "Actual",
          rawPayload: {},
        },
      ]),
    };

    await expect(
      checkJobsiteWeatherAlerts({
        supabase: supabase as never,
        nwsClient: nwsClient as never,
        requireFeatureFlag: false,
      })
    ).resolves.toMatchObject({
      ok: true,
      jobsitesSeen: 1,
      alertEventsUpserted: 1,
      deliveriesSent: 4,
    });

    expect(deliverWeatherNotificationMock).toHaveBeenCalledTimes(4);
    expect(deliverWeatherNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: expect.objectContaining({ userId: "pm-1", email: "pm-1@example.com", phone: "5551112222" }),
        channel: "email",
      })
    );
    expect(deliverWeatherNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: expect.objectContaining({ userId: "lead-1", email: "lead-1@example.com", phone: "5553334444" }),
        channel: "sms",
      })
    );
  });

  it("notifies non-user workforce PMs and site leads by email and SMS", async () => {
    process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS = "true";
    const update = vi.fn(() => ({ eq: vi.fn() }));
    const upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: "event-1" }, error: null })),
      })),
    }));
    const from = vi.fn((table: string) => {
      if (table === "company_jobsites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: "jobsite-1",
                        company_id: "company-1",
                        name: "Hillcrest Office Fit-Out",
                        zip_code: "53022",
                        project_manager: "Morgan Ellis",
                        safety_lead: "Grace Monroe",
                        weather_latitude: 43.2286,
                        weather_longitude: -88.1246,
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
          update,
        };
      }
      if (table === "jobsite_weather_subscriptions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      if (table === "company_jobsite_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
      if (table === "user_profiles") {
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
                    id: "employee-pm-1",
                    company_id: "company-1",
                    full_name: "Morgan Ellis",
                    email: "morgan@example.com",
                    phone: "5551112222",
                    phone_normalized: "5551112222",
                    status: "active",
                  },
                  {
                    id: "employee-lead-1",
                    company_id: "company-1",
                    full_name: "Grace Monroe",
                    email: "grace@example.com",
                    phone: "5553334444",
                    phone_normalized: "5553334444",
                    status: "active",
                  },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "weather_alert_events") {
        return { upsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = {
      from,
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    };
    const nwsClient = {
      getActiveAlerts: vi.fn().mockResolvedValue([
        {
          id: "nws-alert-1",
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
      ]),
    };

    await expect(
      checkJobsiteWeatherAlerts({
        supabase: supabase as never,
        nwsClient: nwsClient as never,
        requireFeatureFlag: false,
      })
    ).resolves.toMatchObject({
      ok: true,
      jobsitesSeen: 1,
      alertEventsUpserted: 1,
      deliveriesSent: 4,
    });

    expect(deliverWeatherNotificationMock).toHaveBeenCalledTimes(4);
    expect(deliverWeatherNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: expect.objectContaining({
          userId: null,
          employeeId: "employee-pm-1",
          email: "morgan@example.com",
          phone: "5551112222",
        }),
        channel: "sms",
      })
    );
    expect(deliverWeatherNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: expect.objectContaining({
          userId: null,
          employeeId: "employee-lead-1",
          email: "grace@example.com",
          phone: "5553334444",
        }),
        channel: "email",
      })
    );
  });
});
