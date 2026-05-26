import { describe, expect, it } from "vitest";
import {
  defaultNotificationPreference,
  isNotificationEnabled,
  normalizeNotificationPreferenceRow,
  normalizeNotificationPriority,
  normalizeNotificationRow,
} from "@/lib/companyNotifications";

describe("company notification helpers", () => {
  it("normalizes notification rows from Supabase", () => {
    expect(
      normalizeNotificationRow({
        id: "notification-1",
        company_id: "company-1",
        recipient_user_id: "user-1",
        actor_user_id: "actor-1",
        event_type: "weather_alert",
        title: "Lightning within 10 miles",
        priority: "critical",
        href: "/jobsites/jobsite-1/overview",
        source_table: "weather_alert_events",
        source_id: "event-1",
        metadata: { jobsiteId: "jobsite-1" },
        read_at: null,
        created_at: "2026-05-20T12:00:00.000Z",
      })
    ).toMatchObject({
      id: "notification-1",
      companyId: "company-1",
      recipientUserId: "user-1",
      actorUserId: "actor-1",
      eventType: "weather_alert",
      title: "Lightning within 10 miles",
      priority: "critical",
      href: "/jobsites/jobsite-1/overview",
      sourceTable: "weather_alert_events",
      sourceId: "event-1",
      metadata: { jobsiteId: "jobsite-1" },
      readAt: null,
      archivedAt: null,
      createdAt: "2026-05-20T12:00:00.000Z",
    });
  });

  it("falls back to normal priority for unknown values", () => {
    expect(normalizeNotificationPriority("HIGH")).toBe("high");
    expect(normalizeNotificationPriority("urgent")).toBe("normal");
  });

  it("normalizes preference rows and applies default event behavior", () => {
    expect(
      normalizeNotificationPreferenceRow({
        id: "pref-1",
        company_id: "company-1",
        user_id: "user-1",
        event_type: "billing_invoice",
        in_app_enabled: false,
        email_enabled: true,
      })
    ).toMatchObject({
      id: "pref-1",
      companyId: "company-1",
      userId: "user-1",
      eventType: "billing_invoice",
      inAppEnabled: false,
      emailEnabled: true,
    });

    expect(defaultNotificationPreference("weather_alert")).toEqual({
      inAppEnabled: true,
      emailEnabled: true,
    });
    expect(defaultNotificationPreference("gus_email_notification")).toEqual({
      inAppEnabled: true,
      emailEnabled: true,
    });
    expect(defaultNotificationPreference("custom_event")).toEqual({
      inAppEnabled: true,
      emailEnabled: false,
    });
  });

  it("uses explicit in-app preferences before defaults", () => {
    expect(
      isNotificationEnabled("training_gap", [
        {
          eventType: "training_gap",
          inAppEnabled: false,
        },
      ])
    ).toBe(false);

    expect(isNotificationEnabled("permit_auto_assignment", [])).toBe(true);
  });
});
