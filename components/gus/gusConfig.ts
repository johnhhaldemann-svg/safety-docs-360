export const gusDisabledRoutes = [
  "/login",
  "/signup",
  "/company-signup",
  "/contractor-training-intake",
  "/billing",
  "/customer/billing",
  "/settings",
  "/account",
  "/error",
  "/marketing",
] as const;

export const gusAllowedRoutes = [
  "/dashboard",
  "/safe-predict",
  "/companies",
  "/jobsites",
  "/jsa",
  "/permits",
  "/training",
  "/documents",
  "/risk",
  "/observations",
  "/audits",
  "/schedule-upload",
] as const;

export const gusStorageKeys = {
  lastShownAt: "gus_last_shown_at",
  lastDismissedAt: "gus_last_dismissed_at",
  lastMessageId: "gus_last_message_id",
  disabledUntil: "gus_disabled_until",
  voiceEnabled: "gus_voice_enabled",
  quietMode: "gus_quiet_mode",
  voiceDisabledUntil: "gus_voice_disabled_until",
  textOnlyMode: "gus_text_only_mode",
} as const;

export const gusFeatureFlags = {
  gusRealtimeVoiceEnabled: false,
} as const;

export const gusPopupTiming = {
  minDelayMs: 20_000,
  maxDelayMs: 45_000,
  globalCooldownMs: 5 * 60_000,
  dismissedCooldownMs: 10 * 60_000,
  activeTypingWindowMs: 2_500,
  warningDelayMs: 800,
  maxPopupsPerSession: 6,
} as const;

export function gusRouteMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isGusDisabledRoute(pathname: string) {
  return gusDisabledRoutes.some((route) => gusRouteMatches(pathname, route));
}

export function isGusAllowedRoute(pathname: string) {
  return gusAllowedRoutes.some((route) => gusRouteMatches(pathname, route));
}
