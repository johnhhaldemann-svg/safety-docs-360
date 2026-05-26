import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUS_NOTIFICATION_SETTINGS,
  isGusCriticalSafetyNotification,
  mergeGusNotificationSettings,
  normalizeGusNotificationSettings,
  shouldAutoOpenGusNotification,
  shouldPersistGusInAppNotification,
} from "@/lib/gus/gusNotificationSettings";

describe("Gus notification settings", () => {
  it("normalizes unknown values to conservative defaults", () => {
    expect(normalizeGusNotificationSettings(null)).toEqual(DEFAULT_GUS_NOTIFICATION_SETTINGS);
    expect(
      normalizeGusNotificationSettings({
        autoOpenEnabled: false,
        inAppEnabled: "no",
        emailEnabled: false,
        voiceEnabled: true,
        textOnlyMode: false,
      }),
    ).toEqual({
      autoOpenEnabled: false,
      inAppEnabled: true,
      emailEnabled: false,
      voiceEnabled: true,
      textOnlyMode: false,
    });
  });

  it("keeps text-only mode and voice mutually exclusive", () => {
    expect(
      normalizeGusNotificationSettings({
        voiceEnabled: true,
        textOnlyMode: true,
      }),
    ).toMatchObject({
      voiceEnabled: false,
      textOnlyMode: true,
    });

    expect(
      mergeGusNotificationSettings(
        { voiceEnabled: false, textOnlyMode: true },
        { voiceEnabled: true },
      ),
    ).toMatchObject({
      voiceEnabled: true,
      textOnlyMode: false,
    });
  });

  it("lets high and critical safety warnings auto-open when routine popups are off", () => {
    const mutedRoutine = { ...DEFAULT_GUS_NOTIFICATION_SETTINGS, autoOpenEnabled: false };

    expect(shouldAutoOpenGusNotification(mutedRoutine, { category: "safety_tip", priority: 4 })).toBe(false);
    expect(shouldAutoOpenGusNotification(mutedRoutine, { category: "risk_alert", priority: 2 })).toBe(true);
    expect(shouldAutoOpenGusNotification(mutedRoutine, { attentionLevel: "critical" })).toBe(true);
  });

  it("only overrides disabled in-app records for critical safety notifications", () => {
    const disabledInApp = { ...DEFAULT_GUS_NOTIFICATION_SETTINGS, inAppEnabled: false };

    expect(isGusCriticalSafetyNotification({ priority: 1 })).toBe(true);
    expect(shouldPersistGusInAppNotification(disabledInApp, { category: "risk_alert", priority: 2 })).toBe(false);
    expect(shouldPersistGusInAppNotification(disabledInApp, { category: "warning", priority: 1 })).toBe(true);
  });
});
