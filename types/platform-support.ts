export const PLATFORM_HELP_TICKET_CATEGORIES = [
  "login_access",
  "documents",
  "jobsites",
  "billing",
  "integrations",
  "performance",
  "bug",
  "other",
] as const;

export const PLATFORM_HELP_TICKET_PRIORITIES = [
  "normal",
  "high",
  "critical",
] as const;

export const PLATFORM_HELP_TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_user",
  "resolved",
  "closed",
] as const;

export type PlatformHelpTicketCategory =
  (typeof PLATFORM_HELP_TICKET_CATEGORIES)[number];

export type PlatformHelpTicketPriority =
  (typeof PLATFORM_HELP_TICKET_PRIORITIES)[number];

export type PlatformHelpTicketStatus =
  (typeof PLATFORM_HELP_TICKET_STATUSES)[number];

export type PlatformHelpTicket = {
  id: string;
  submitterUserId: string;
  companyId: string | null;
  submitterEmail: string | null;
  submitterName: string | null;
  submitterRole: string | null;
  companyName: string | null;
  category: PlatformHelpTicketCategory;
  priority: PlatformHelpTicketPriority;
  status: PlatformHelpTicketStatus;
  title: string;
  description: string;
  pageUrl: string | null;
  browserUserAgent: string | null;
  metadata: Record<string, unknown>;
  adminNotes: string | null;
  resolutionNote: string | null;
  assignedSuperadminUserId: string | null;
  superadminSeenAt: string | null;
  superadminSeenBy: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
};

export type PlatformHelpTicketSummary = {
  total: number;
  open: number;
  inProgress: number;
  waitingOnUser: number;
  resolved: number;
  closed: number;
  unseen: number;
  critical: number;
  high: number;
};

