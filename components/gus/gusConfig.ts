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
  recentSocialLineIds: "gus_recent_social_line_ids",
  lastSitrepAt: "gus_last_sitrep_at",
  lastSitrepId: "gus_last_sitrep_id",
  activeCoachItems: "gus_active_coach_items",
  lastCoachFollowupAt: "gus_last_coach_followup_at",
  lastMicTranscript: "gus_last_mic_transcript",
  autonomyState: "gus_autonomy_state",
  lastAutonomyCheckAt: "gus_last_autonomy_check_at",
  lastUnresolvedPriority: "gus_last_unresolved_priority",
} as const;

export const gusFeatureFlags = {
  gusSmartBotEnabled: true,
  gusConversationalCoachEnabled: true,
  gusAutonomousSocialCoachEnabled: true,
  gusSitrepEnabled: true,
  gusActiveCoachLoopEnabled: true,
  gusMicInputEnabled: true,
  gusAutonomyLoopEnabled: true,
  gusSelfMaintenanceStatusEnabled: true,
  gusRealtimeVoiceEnabled: false,
} as const;

export const gusPopupTiming = {
  minDelayMs: 12_000,
  maxDelayMs: 30_000,
  globalCooldownMs: 5 * 60_000,
  dismissedCooldownMs: 10 * 60_000,
  activeTypingWindowMs: 2_500,
  warningDelayMs: 800,
  maxPopupsPerSession: 6,
} as const;

export const gusSitrepTiming = {
  sitrepIntervalMs: 10 * 60_000,
  sitrepCriticalVoiceOnly: true,
} as const;

export const gusAutonomyTiming = {
  checkIntervalMs: 60_000,
  unresolvedFollowUpCooldownMs: 5 * 60_000,
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
