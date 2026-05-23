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

export const GUS_BOT_STATES = [
  "idle",
  "thinking",
  "wave",
  "pointing",
  "warning",
  "planning",
  "muted",
] as const;

export type GusBotState = (typeof GUS_BOT_STATES)[number];

export const GUS_DECISION_KINDS = [
  "silent",
  "idle",
  "nudge",
  "warning",
  "planning_offer",
  "draft_action_offer",
] as const;

export type GusDecisionKind = (typeof GUS_DECISION_KINDS)[number];

export type GusContextSignal = {
  signalId: string;
  source: "risk" | "permit" | "training" | "jsa" | "observation" | "weather" | "action" | "planning" | "page";
  label: string;
  detail?: string;
  riskLevel?: GusRiskLevel;
  count?: number;
  actionHref?: string;
};

export type GusCompanionAction = {
  actionKey: string;
  label: string;
  href?: string;
  requiresConfirmation?: boolean;
};

export type GusCoachPriority = "low" | "medium" | "high" | "critical";

export type GusCoachFollowUp = {
  followUpId: string;
  prompt: string;
  actionLabel: string;
};

export type GusCoachDirective = {
  directiveId: string;
  priority: GusCoachPriority;
  title: string;
  instruction: string;
  whyItMatters: string;
  recommendedActionLabel: string;
  recommendedActionHref?: string;
  recommendedActionKey: string;
  followUps: GusCoachFollowUp[];
  sourceDecisionId: string;
  unresolved: boolean;
  humanReviewRequired: true;
};

export type GusCoachLoopState = {
  activeDirective?: GusCoachDirective;
  unresolvedDirectives: GusCoachDirective[];
  lastFollowUpAt?: string;
};

export type GusAutonomyLevel = "monitor_recommend";

export type GusOperatingLimit = "left" | "confirmation" | "right";

export type GusAutonomyAction = {
  actionKey: string;
  label: string;
  limit: GusOperatingLimit;
  requiresConfirmation: boolean;
  canModifyOfficialRecords: boolean;
};

export type GusAutonomyDecision = {
  decisionId: string;
  level: GusAutonomyLevel;
  action: GusAutonomyAction;
  allowed: boolean;
  blocked: boolean;
  reason: string;
  shouldOpen: boolean;
  shouldInterrupt: boolean;
  humanReviewRequired: true;
};

export type GusAutonomyStatus = {
  statusId: string;
  state: "monitoring" | "waiting_on_review" | "blocked" | "limited";
  label: string;
  detail: string;
  voiceAvailable: boolean;
  micAvailable: boolean;
  contextAvailable: boolean;
  memoryAvailable: boolean;
  conversationAvailable: boolean;
  aiEngineAvailable: boolean;
  lastCheckedAt: string;
};

export type GusDecision = {
  decisionId: string;
  kind: GusDecisionKind;
  botState: GusBotState;
  attentionLevel: "none" | "low" | "medium" | "high" | "critical";
  message: GusMessage;
  reason?: string;
  signals: GusContextSignal[];
  actions: GusCompanionAction[];
  shouldOpen: boolean;
  shouldSpeak: boolean;
};

export type GusConversationTurn = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type GusPersonalityProfile = {
  profileId: "calm_mentor";
  displayName: "Calm Mentor";
  traits: string[];
  boundaries: string[];
};

export type GusSafetyPreferenceMemory = {
  preferredDetailLevel: "concise" | "balanced" | "step_by_step";
  usefulTopics: string[];
  repeatedThemes: string[];
  updatedAt?: string;
};

export type GusConversationRequest = {
  message: string;
  history?: GusConversationTurn[];
  context?: Partial<import("@/lib/gus/gusContext").GusContext>;
  decision?: Partial<GusDecision>;
  safetyPreferences?: Partial<GusSafetyPreferenceMemory>;
};

export type GusConversationResponse = {
  answer: string;
  tone: "calm_mentor";
  suggestedActions: string[];
  missingInformation: string[];
  riskFlags: string[];
  recommendedControls: string[];
  safetyPreferences: GusSafetyPreferenceMemory;
  draftOnly: true;
  humanReviewRequired: true;
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
