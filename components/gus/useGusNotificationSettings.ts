"use client";

import { useCallback, useEffect, useState } from "react";
import { gusStorageKeys } from "@/components/gus/gusConfig";
import {
  DEFAULT_GUS_NOTIFICATION_SETTINGS,
  mergeGusNotificationSettings,
  normalizeGusNotificationSettings,
  type GusNotificationSettings,
} from "@/lib/gus/gusNotificationSettings";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";

const GUS_NOTIFICATION_SETTINGS_EVENT = "gus-notification-settings-updated";

function readStoredSettings() {
  if (typeof window === "undefined") return DEFAULT_GUS_NOTIFICATION_SETTINGS;
  try {
    const raw = window.localStorage.getItem(gusStorageKeys.notificationSettings);
    return normalizeGusNotificationSettings(raw
      ? JSON.parse(raw)
      : null);
  } catch {
    return DEFAULT_GUS_NOTIFICATION_SETTINGS;
  }
}

function writeStoredSettings(settings: GusNotificationSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(gusStorageKeys.notificationSettings, JSON.stringify(settings));
    window.localStorage.setItem(gusStorageKeys.voiceEnabled, settings.voiceEnabled ? "true" : "false");
    window.localStorage.setItem(gusStorageKeys.textOnlyMode, settings.textOnlyMode ? "true" : "false");
    window.dispatchEvent(new Event(GUS_NOTIFICATION_SETTINGS_EVENT));
  } catch {
    // Gus preferences are allowed to fall back to server state.
  }
}

export function getGusNotificationSettingsErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/invalid auth token|jwt|unauthorized|not authenticated|auth/i.test(message)) {
    return "Sign in again to sync Gus notification preferences. Local preferences are still saved on this browser.";
  }
  return message || fallback;
}

export function useGusNotificationSettings() {
  const [settings, setSettings] = useState<GusNotificationSettings>(readStoredSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    function syncStoredSettings() {
      setSettings(readStoredSettings());
    }

    window.addEventListener(GUS_NOTIFICATION_SETTINGS_EVENT, syncStoredSettings);
    window.addEventListener("storage", syncStoredSettings);

    async function loadSettings() {
      setLoading(true);
      setError("");
      try {
        const token = await getSupabaseAccessToken();
        const response = await fetch("/api/gus/notification-settings", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = (await response.json().catch(() => null)) as
          | { settings?: GusNotificationSettings; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Gus notification settings could not be loaded.");
        }
        const next = normalizeGusNotificationSettings(payload?.settings);
        if (!active) return;
        setSettings(next);
        writeStoredSettings(next);
      } catch (err) {
        if (active) {
          setError(getGusNotificationSettingsErrorMessage(err, "Gus notification settings could not be loaded."));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      active = false;
      window.removeEventListener(GUS_NOTIFICATION_SETTINGS_EVENT, syncStoredSettings);
      window.removeEventListener("storage", syncStoredSettings);
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<GusNotificationSettings>) => {
    const optimistic = mergeGusNotificationSettings(settings, patch);
    setSettings(optimistic);
    writeStoredSettings(optimistic);
    setError("");

    try {
      const token = await getSupabaseAccessToken();
      const response = await fetch("/api/gus/notification-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ settings: patch }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { settings?: GusNotificationSettings; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Gus notification settings could not be saved.");
      }
      const saved = normalizeGusNotificationSettings(payload?.settings);
      setSettings(saved);
      writeStoredSettings(saved);
      return saved;
    } catch (err) {
      setError(getGusNotificationSettingsErrorMessage(err, "Gus notification settings could not be saved."));
      throw err;
    }
  }, [settings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
  };
}
