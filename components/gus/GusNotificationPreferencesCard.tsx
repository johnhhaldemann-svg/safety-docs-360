"use client";

import { Bell, MailCheck, Megaphone, Volume2 } from "lucide-react";
import { InlineMessage, SectionCard, StatusBadge } from "@/components/WorkspacePrimitives";
import { useGusNotificationSettings } from "@/components/gus/useGusNotificationSettings";
import type { GusNotificationSettings } from "@/lib/gus/gusNotificationSettings";

type SettingKey = keyof GusNotificationSettings;

const preferenceRows: Array<{
  key: SettingKey;
  label: string;
  detail: string;
  icon: typeof Bell;
}> = [
  {
    key: "autoOpenEnabled",
    label: "Routine Gus popups",
    detail: "Allow non-urgent Gus coaching prompts to open automatically.",
    icon: Megaphone,
  },
  {
    key: "inAppEnabled",
    label: "Gus notification center records",
    detail: "Save Gus safety review notes in the app notification center.",
    icon: Bell,
  },
  {
    key: "emailEnabled",
    label: "Email me Gus safety notes",
    detail: "Show the email option for confirmed Gus safety review notes.",
    icon: MailCheck,
  },
  {
    key: "voiceEnabled",
    label: "Gus voice",
    detail: "Let Gus speak when voice is available and the current page allows it.",
    icon: Volume2,
  },
  {
    key: "textOnlyMode",
    label: "Text only",
    detail: "Keep Gus silent and show guidance as text.",
    icon: Bell,
  },
];

export function GusNotificationPreferencesCard() {
  const { settings, loading, error, updateSettings } = useGusNotificationSettings();

  async function toggleSetting(key: SettingKey) {
    const nextValue = !settings[key];
    const patch: Partial<GusNotificationSettings> = { [key]: nextValue };
    if (key === "voiceEnabled" && nextValue) {
      patch.textOnlyMode = false;
    }
    if (key === "textOnlyMode" && nextValue) {
      patch.voiceEnabled = false;
    }
    await updateSettings(patch).catch(() => undefined);
  }

  return (
    <SectionCard
      title="Gus notification preferences"
      description="Choose when Gus can interrupt, record review notes, email confirmed notes, or speak."
      aside={<StatusBadge label={loading ? "Loading" : "Saved"} tone={error ? "warning" : "success"} />}
    >
      {error ? <InlineMessage tone="warning">{error}</InlineMessage> : null}
      <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-white">
        {preferenceRows.map((row) => {
          const Icon = row.icon;
          const checked = settings[row.key];
          return (
            <label
              key={row.key}
              className="flex cursor-pointer items-start gap-3 px-4 py-4 transition hover:bg-[var(--app-panel-soft)]"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-accent-primary)]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--app-text-strong)]">{row.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">{row.detail}</span>
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => void toggleSetting(row.key)}
                className="mt-1 h-5 w-5 rounded border-[var(--app-border-strong)] text-[var(--app-accent-primary)] focus:ring-[var(--app-accent-primary)]"
              />
            </label>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-[var(--app-muted)]">
        Critical safety warnings can still appear in-app for human review.
      </p>
    </SectionCard>
  );
}
