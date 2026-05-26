import {
  PLATFORM_HELP_TICKET_CATEGORIES,
  PLATFORM_HELP_TICKET_PRIORITIES,
  PLATFORM_HELP_TICKET_STATUSES,
  type PlatformHelpTicket,
  type PlatformHelpTicketCategory,
  type PlatformHelpTicketPriority,
  type PlatformHelpTicketStatus,
  type PlatformHelpTicketSummary,
} from "@/types/platform-support";

type TicketRow = Record<string, unknown>;

export const PLATFORM_HELP_TICKET_CATEGORY_LABELS: Record<PlatformHelpTicketCategory, string> = {
  login_access: "Login or Access",
  documents: "Documents",
  jobsites: "Jobsites",
  billing: "Billing",
  integrations: "Integrations",
  performance: "Performance",
  bug: "Bug or Error",
  other: "Other",
};

export const PLATFORM_HELP_TICKET_PRIORITY_LABELS: Record<PlatformHelpTicketPriority, string> = {
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export const PLATFORM_HELP_TICKET_STATUS_LABELS: Record<PlatformHelpTicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_user: "Waiting on User",
  resolved: "Resolved",
  closed: "Closed",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanLongText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isPlatformHelpTicketCategory(
  value: unknown
): value is PlatformHelpTicketCategory {
  return (
    typeof value === "string" &&
    (PLATFORM_HELP_TICKET_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isPlatformHelpTicketPriority(
  value: unknown
): value is PlatformHelpTicketPriority {
  return (
    typeof value === "string" &&
    (PLATFORM_HELP_TICKET_PRIORITIES as readonly string[]).includes(value)
  );
}

export function isPlatformHelpTicketStatus(
  value: unknown
): value is PlatformHelpTicketStatus {
  return (
    typeof value === "string" &&
    (PLATFORM_HELP_TICKET_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizePlatformHelpTicketRow(row: TicketRow): PlatformHelpTicket {
  const category = isPlatformHelpTicketCategory(row.category) ? row.category : "other";
  const priority = isPlatformHelpTicketPriority(row.priority) ? row.priority : "normal";
  const status = isPlatformHelpTicketStatus(row.status) ? row.status : "open";

  return {
    id: String(row.id ?? ""),
    submitterUserId: String(row.submitter_user_id ?? ""),
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    submitterEmail: typeof row.submitter_email === "string" ? row.submitter_email : null,
    submitterName: typeof row.submitter_name === "string" ? row.submitter_name : null,
    submitterRole: typeof row.submitter_role === "string" ? row.submitter_role : null,
    companyName: typeof row.company_name === "string" ? row.company_name : null,
    category,
    priority,
    status,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    pageUrl: typeof row.page_url === "string" ? row.page_url : null,
    browserUserAgent:
      typeof row.browser_user_agent === "string" ? row.browser_user_agent : null,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    adminNotes: typeof row.admin_notes === "string" ? row.admin_notes : null,
    resolutionNote:
      typeof row.resolution_note === "string" ? row.resolution_note : null,
    assignedSuperadminUserId:
      typeof row.assigned_superadmin_user_id === "string"
        ? row.assigned_superadmin_user_id
        : null,
    superadminSeenAt:
      typeof row.superadmin_seen_at === "string" ? row.superadmin_seen_at : null,
    superadminSeenBy:
      typeof row.superadmin_seen_by === "string" ? row.superadmin_seen_by : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
    closedAt: typeof row.closed_at === "string" ? row.closed_at : null,
  };
}

export function summarizePlatformHelpTickets(
  tickets: PlatformHelpTicket[]
): PlatformHelpTicketSummary {
  return tickets.reduce(
    (summary, ticket) => {
      summary.total += 1;
      if (ticket.status === "open") summary.open += 1;
      if (ticket.status === "in_progress") summary.inProgress += 1;
      if (ticket.status === "waiting_on_user") summary.waitingOnUser += 1;
      if (ticket.status === "resolved") summary.resolved += 1;
      if (ticket.status === "closed") summary.closed += 1;
      if (!ticket.superadminSeenAt && !["resolved", "closed"].includes(ticket.status)) {
        summary.unseen += 1;
      }
      if (ticket.priority === "critical") summary.critical += 1;
      if (ticket.priority === "high") summary.high += 1;
      return summary;
    },
    {
      total: 0,
      open: 0,
      inProgress: 0,
      waitingOnUser: 0,
      resolved: 0,
      closed: 0,
      unseen: 0,
      critical: 0,
      high: 0,
    }
  );
}

export function validatePlatformHelpTicketCreate(input: unknown):
  | {
      ok: true;
      value: {
        category: PlatformHelpTicketCategory;
        priority: PlatformHelpTicketPriority;
        title: string;
        description: string;
        pageUrl: string | null;
        browserUserAgent: string | null;
        metadata: Record<string, unknown>;
      };
    }
  | { ok: false; error: string } {
  const body = isRecord(input) ? input : {};
  const title = cleanText(body.title, 160);
  const description = cleanLongText(body.description, 4000);
  const category = isPlatformHelpTicketCategory(body.category)
    ? body.category
    : null;
  const priority = isPlatformHelpTicketPriority(body.priority)
    ? body.priority
    : null;
  const pageUrl = cleanText(body.pageUrl ?? body.page_url, 2048) || null;
  const browserUserAgent =
    cleanText(body.browserUserAgent ?? body.browser_user_agent, 512) || null;
  const metadata = isRecord(body.metadata) ? body.metadata : {};

  if (!category) return { ok: false, error: "Choose a supported ticket category." };
  if (!priority) return { ok: false, error: "Choose a supported ticket priority." };
  if (title.length < 6) {
    return { ok: false, error: "Ticket title must be at least 6 characters." };
  }
  if (description.length < 12) {
    return {
      ok: false,
      error: "Ticket description must be at least 12 characters.",
    };
  }

  return {
    ok: true,
    value: { category, priority, title, description, pageUrl, browserUserAgent, metadata },
  };
}

export function validatePlatformHelpTicketUpdate(input: unknown):
  | {
      ok: true;
      value: {
        status?: PlatformHelpTicketStatus;
        priority?: PlatformHelpTicketPriority;
        adminNotes?: string | null;
        resolutionNote?: string | null;
        assignedSuperadminUserId?: string | null;
        markSeen?: boolean;
      };
    }
  | { ok: false; error: string } {
  const body = isRecord(input) ? input : {};
  const value: {
    status?: PlatformHelpTicketStatus;
    priority?: PlatformHelpTicketPriority;
    adminNotes?: string | null;
    resolutionNote?: string | null;
    assignedSuperadminUserId?: string | null;
    markSeen?: boolean;
  } = {};

  if ("status" in body) {
    if (!isPlatformHelpTicketStatus(body.status)) {
      return { ok: false, error: "Unsupported ticket status." };
    }
    value.status = body.status;
  }

  if ("priority" in body) {
    if (!isPlatformHelpTicketPriority(body.priority)) {
      return { ok: false, error: "Unsupported ticket priority." };
    }
    value.priority = body.priority;
  }

  if ("adminNotes" in body || "admin_notes" in body) {
    const notes = cleanLongText(body.adminNotes ?? body.admin_notes, 4000);
    value.adminNotes = notes || null;
  }

  if ("resolutionNote" in body || "resolution_note" in body) {
    const note = cleanLongText(body.resolutionNote ?? body.resolution_note, 4000);
    value.resolutionNote = note || null;
  }

  if ("assignedSuperadminUserId" in body || "assigned_superadmin_user_id" in body) {
    const assigned = body.assignedSuperadminUserId ?? body.assigned_superadmin_user_id;
    if (assigned !== null && assigned !== undefined) {
      if (typeof assigned !== "string" || !UUID_RE.test(assigned)) {
        return { ok: false, error: "Assigned superadmin must be a valid user id." };
      }
      value.assignedSuperadminUserId = assigned;
    } else {
      value.assignedSuperadminUserId = null;
    }
  }

  if ("markSeen" in body || "mark_seen" in body) {
    value.markSeen = body.markSeen === true || body.mark_seen === true;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No supported ticket update provided." };
  }

  return { ok: true, value };
}

