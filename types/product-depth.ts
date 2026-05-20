export type WorkspaceSearchResultType =
  | "document"
  | "jobsite"
  | "field_issue"
  | "corrective_action"
  | "incident"
  | "permit"
  | "jsa"
  | "training"
  | "contractor"
  | "generated_document"
  | "company_memory"
  | "marketplace_template"
  | "risk_recommendation";

export type WorkspaceSearchResult = {
  id: string;
  type: WorkspaceSearchResultType;
  title: string;
  subtitle: string | null;
  status: string | null;
  updatedAt: string | null;
  href: string;
  jobsiteName: string | null;
  matchedFields: string[];
  sourceTable: string;
};

export type WorkspaceSearchFacets = {
  typeCounts: Record<WorkspaceSearchResultType, number>;
  jobsiteCounts: Record<string, number>;
  total: number;
  query: string;
};

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationEvent =
  | "review_queue_changed"
  | "assignment_created"
  | "weather_alert"
  | "billing_invoice"
  | "training_gap"
  | "permit_auto_assignment"
  | "risk_recommendation"
  | "webhook_delivery_failed"
  | "integration_webhook_test"
  | "system";

export type CompanyNotification = {
  id: string;
  companyId: string;
  recipientUserId: string;
  actorUserId: string | null;
  eventType: NotificationEvent | string;
  title: string;
  body: string | null;
  priority: NotificationPriority;
  href: string | null;
  sourceTable: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type NotificationPreference = {
  id: string;
  companyId: string;
  userId: string;
  eventType: NotificationEvent | string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_NOTIFICATION_EVENTS: Array<{
  eventType: NotificationEvent;
  label: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
}> = [
  { eventType: "review_queue_changed", label: "Review queue changes", defaultInApp: true, defaultEmail: false },
  { eventType: "assignment_created", label: "Assignments", defaultInApp: true, defaultEmail: false },
  { eventType: "weather_alert", label: "Weather alerts", defaultInApp: true, defaultEmail: true },
  { eventType: "billing_invoice", label: "Billing invoices", defaultInApp: true, defaultEmail: true },
  { eventType: "training_gap", label: "Training gaps", defaultInApp: true, defaultEmail: false },
  { eventType: "permit_auto_assignment", label: "Permit auto-assignments", defaultInApp: true, defaultEmail: false },
  { eventType: "risk_recommendation", label: "Risk recommendations", defaultInApp: true, defaultEmail: false },
  { eventType: "webhook_delivery_failed", label: "Webhook delivery failures", defaultInApp: true, defaultEmail: true },
  { eventType: "integration_webhook_test", label: "Integration webhook tests", defaultInApp: true, defaultEmail: false },
];
