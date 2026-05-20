import { afterEach, describe, expect, it } from "vitest";
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
});
