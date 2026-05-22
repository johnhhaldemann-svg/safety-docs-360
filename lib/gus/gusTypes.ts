export const GUS_RISK_LEVELS = ["low", "moderate", "high", "severe"] as const;

export type GusRiskLevel = (typeof GUS_RISK_LEVELS)[number];

export const GUS_MESSAGE_CATEGORIES = [
  "greeting",
  "compliment",
  "safety_tip",
  "reminder",
  "warning",
  "permit_alert",
  "training_alert",
  "document_tip",
  "risk_alert",
  "planning",
  "voice",
  "learning",
] as const;

export type GusMessageCategory = (typeof GUS_MESSAGE_CATEGORIES)[number];

export type GusMessage = {
  messageId: string;
  category: GusMessageCategory;
  priority: number;
  message: string;
  spokenText?: string;
  reason?: string;
  actionLabel?: string;
  actionHref?: string;
  actionKey?: string;
  confidence?: number;
  shouldSpeak?: boolean;
};

export const GUS_PLAN_STATUSES = [
  "draft_incomplete",
  "draft_ready_for_review",
  "needs_supervisor_review",
  "needs_competent_person_review",
  "needs_qualified_person_review",
  "blocked_missing_critical_info",
] as const;

export type GusPlanStatus = (typeof GUS_PLAN_STATUSES)[number];
