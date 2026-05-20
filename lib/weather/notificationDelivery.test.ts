import { describe, expect, it } from "vitest";
import {
  buildWeatherNotificationText,
  createWeatherDeliveryDedupeKey,
} from "@/lib/weather/notificationDelivery";

describe("weather notification delivery helpers", () => {
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
});
