export type GusNotificationSettings = {
  autoOpenEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  voiceEnabled: boolean;
  textOnlyMode: boolean;
};

export type GusNotificationSignal = {
  priority?: number | string | null;
  category?: string | null;
  attentionLevel?: string | null;
  riskLevel?: string | null;
};

export const DEFAULT_GUS_NOTIFICATION_SETTINGS: GusNotificationSettings = {
  autoOpenEnabled: true,
  inAppEnabled: true,
  emailEnabled: true,
  voiceEnabled: false,
  textOnlyMode: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boolOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numericPriority(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeGusNotificationSettings(input: unknown): GusNotificationSettings {
  const record = isRecord(input) ? input : {};
  const settings = {
    autoOpenEnabled: boolOrDefault(record.autoOpenEnabled, DEFAULT_GUS_NOTIFICATION_SETTINGS.autoOpenEnabled),
    inAppEnabled: boolOrDefault(record.inAppEnabled, DEFAULT_GUS_NOTIFICATION_SETTINGS.inAppEnabled),
    emailEnabled: boolOrDefault(record.emailEnabled, DEFAULT_GUS_NOTIFICATION_SETTINGS.emailEnabled),
    voiceEnabled: boolOrDefault(record.voiceEnabled, DEFAULT_GUS_NOTIFICATION_SETTINGS.voiceEnabled),
    textOnlyMode: boolOrDefault(record.textOnlyMode, DEFAULT_GUS_NOTIFICATION_SETTINGS.textOnlyMode),
  };

  if (settings.textOnlyMode) {
    settings.voiceEnabled = false;
  } else if (settings.voiceEnabled) {
    settings.textOnlyMode = false;
  }

  return settings;
}

export function mergeGusNotificationSettings(
  current: unknown,
  patch: unknown,
): GusNotificationSettings {
  const currentSettings = normalizeGusNotificationSettings(current);
  const patchRecord = isRecord(patch) ? patch : {};
  const next = normalizeGusNotificationSettings({
    ...currentSettings,
    ...patchRecord,
  });

  if (patchRecord.voiceEnabled === true) {
    next.voiceEnabled = true;
    next.textOnlyMode = false;
  }
  if (patchRecord.textOnlyMode === true) {
    next.textOnlyMode = true;
    next.voiceEnabled = false;
  }

  return next;
}

export function isGusCriticalSafetyNotification(input: GusNotificationSignal) {
  const priority = numericPriority(input.priority);
  const attentionLevel = input.attentionLevel?.trim().toLowerCase();
  const riskLevel = input.riskLevel?.trim().toLowerCase();

  return (
    (priority !== null && priority <= 1) ||
    attentionLevel === "critical" ||
    riskLevel === "critical" ||
    riskLevel === "severe"
  );
}

export function isGusSafetyEscalationNotification(input: GusNotificationSignal) {
  if (isGusCriticalSafetyNotification(input)) return true;

  const priority = numericPriority(input.priority);
  const category = input.category?.trim().toLowerCase();
  const attentionLevel = input.attentionLevel?.trim().toLowerCase();

  return (
    (priority !== null && priority <= 2) ||
    attentionLevel === "high" ||
    category === "warning" ||
    category === "permit_alert" ||
    category === "training_alert" ||
    category === "risk_alert"
  );
}

export function shouldAutoOpenGusNotification(
  settingsInput: unknown,
  signal: GusNotificationSignal,
) {
  const settings = normalizeGusNotificationSettings(settingsInput);
  return settings.autoOpenEnabled || isGusSafetyEscalationNotification(signal);
}

export function shouldPersistGusInAppNotification(
  settingsInput: unknown,
  signal: GusNotificationSignal,
) {
  const settings = normalizeGusNotificationSettings(settingsInput);
  return settings.inAppEnabled || isGusCriticalSafetyNotification(signal);
}
