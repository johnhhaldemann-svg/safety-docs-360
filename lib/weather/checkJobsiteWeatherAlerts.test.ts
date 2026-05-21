import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkJobsiteWeatherAlerts,
  isJobsiteWeatherNotificationsEnabled,
} from "@/lib/weather/checkJobsiteWeatherAlerts";

describe("jobsite weather cron", () => {
  const originalFeatureFlag = process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS;

  afterEach(() => {
    process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS = originalFeatureFlag;
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
});
