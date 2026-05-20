import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_NOTIFICATION_EVENTS,
  type CompanyNotification,
  type NotificationEvent,
  type NotificationPreference,
  type NotificationPriority,
} from "@/types/product-depth";

type SupabaseJson = Record<string, unknown>;

export function normalizeNotificationRow(row: Record<string, unknown>): CompanyNotification {
  return {
    id: String(row.id ?? ""),
    companyId: String(row.company_id ?? ""),
    recipientUserId: String(row.recipient_user_id ?? ""),
    actorUserId: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    eventType: String(row.event_type ?? "system"),
    title: String(row.title ?? "Notification"),
    body: typeof row.body === "string" ? row.body : null,
    priority: normalizeNotificationPriority(row.priority),
    href: typeof row.href === "string" ? row.href : null,
    sourceTable: typeof row.source_table === "string" ? row.source_table : null,
    sourceId: typeof row.source_id === "string" ? row.source_id : null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as SupabaseJson)
      : {},
    readAt: typeof row.read_at === "string" ? row.read_at : null,
    archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function normalizeNotificationPreferenceRow(row: Record<string, unknown>): NotificationPreference {
  return {
    id: String(row.id ?? ""),
    companyId: String(row.company_id ?? ""),
    userId: String(row.user_id ?? ""),
    eventType: String(row.event_type ?? "system"),
    inAppEnabled: row.in_app_enabled !== false,
    emailEnabled: row.email_enabled === true,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export function normalizeNotificationPriority(value: unknown): NotificationPriority {
  const priority = String(value ?? "normal").trim().toLowerCase();
  if (priority === "low" || priority === "high" || priority === "critical") {
    return priority;
  }
  return "normal";
}

export function defaultNotificationPreference(eventType: string) {
  const known = DEFAULT_NOTIFICATION_EVENTS.find((item) => item.eventType === eventType);
  return {
    inAppEnabled: known?.defaultInApp ?? true,
    emailEnabled: known?.defaultEmail ?? false,
  };
}

export function isNotificationEnabled(
  eventType: string,
  preferences: Array<Pick<NotificationPreference, "eventType" | "inAppEnabled">>
) {
  const preference = preferences.find((item) => item.eventType === eventType);
  return preference?.inAppEnabled ?? defaultNotificationPreference(eventType).inAppEnabled;
}

export async function createCompanyNotification(params: {
  supabase: SupabaseClient;
  companyId: string;
  recipientUserId: string;
  eventType: NotificationEvent | string;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  href?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  metadata?: SupabaseJson;
  actorUserId?: string | null;
}) {
  const preference = await params.supabase
    .from("company_notification_preferences")
    .select("event_type, in_app_enabled")
    .eq("company_id", params.companyId)
    .eq("user_id", params.recipientUserId)
    .eq("event_type", params.eventType)
    .maybeSingle();

  const enabled =
    !preference.error && preference.data
      ? (preference.data as { in_app_enabled?: boolean }).in_app_enabled !== false
      : defaultNotificationPreference(params.eventType).inAppEnabled;

  if (!enabled) {
    return { skipped: true, notification: null, error: null };
  }

  const result = await params.supabase
    .from("company_notifications")
    .insert({
      company_id: params.companyId,
      recipient_user_id: params.recipientUserId,
      actor_user_id: params.actorUserId ?? null,
      event_type: params.eventType,
      title: params.title,
      body: params.body ?? null,
      priority: normalizeNotificationPriority(params.priority),
      href: params.href ?? null,
      source_table: params.sourceTable ?? null,
      source_id: params.sourceId ?? null,
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single();

  if (result.error) {
    return { skipped: false, notification: null, error: result.error.message };
  }

  return {
    skipped: false,
    notification: normalizeNotificationRow(result.data as Record<string, unknown>),
    error: null,
  };
}

export async function listCompanyNotificationRecipients(params: {
  supabase: SupabaseClient;
  companyId: string;
  roles?: string[];
  includeUserIds?: string[];
}) {
  const memberships = await params.supabase
    .from("company_memberships")
    .select("user_id, role, status")
    .eq("company_id", params.companyId)
    .eq("status", "active");

  if (memberships.error) {
    return { userIds: params.includeUserIds ?? [], error: memberships.error.message };
  }

  const roleSet = new Set((params.roles ?? []).map((role) => role.trim().toLowerCase()).filter(Boolean));
  const userIds = new Set(params.includeUserIds ?? []);
  for (const row of (memberships.data ?? []) as Array<{ user_id?: string | null; role?: string | null }>) {
    const role = row.role?.trim().toLowerCase() ?? "";
    if (!row.user_id) continue;
    if (roleSet.size === 0 || roleSet.has(role)) {
      userIds.add(row.user_id);
    }
  }

  return { userIds: [...userIds], error: null };
}

