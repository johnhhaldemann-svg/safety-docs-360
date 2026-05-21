import type {
  CompanySecurityEventType,
  CompanySecurityResourceType,
} from "@/types/enterprise-readiness";

type MessageError = { message?: string | null };

type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

export const COMPANY_SECURITY_EVENT_LABELS: Record<CompanySecurityEventType, string> = {
  login_observed: "Login observed",
  session_observed: "Session observed",
  user_invited: "Company invite created",
  user_access_updated: "Company access updated",
  user_suspended: "Company user suspended",
  user_removed: "Company user removed",
  file_upload_link_created: "File upload link created",
  file_uploaded: "File uploaded",
  file_downloaded: "File downloaded",
  report_export_link_created: "Report export link created",
  company_setting_updated: "Company setting changed",
  billing_admin_action: "Billing admin action",
  security_sensitive_ai_action: "Security-sensitive AI action",
  data_request_submitted: "Data request submitted",
  data_request_updated: "Data request updated",
  data_request_completed: "Data request completed",
};

export function isMissingCompanySecurityEventsError(error?: MessageError | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    message.includes("company_security_events") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("relation"))
  );
}

export async function recordCompanySecurityEvent(params: {
  supabase: SupabaseLikeClient;
  companyId?: string | null;
  jobsiteId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  eventType: CompanySecurityEventType;
  resourceType: CompanySecurityResourceType;
  resourceId?: string | null;
  title?: string | null;
  detail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
}) {
  const companyId = params.companyId?.trim();
  if (!companyId) {
    return { skipped: true, error: null };
  }

  const insertResult = await (
    params.supabase.from("company_security_events") as unknown as {
      insert: (
        values: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).insert({
    company_id: companyId,
    jobsite_id: params.jobsiteId ?? null,
    actor_user_id: params.actorUserId ?? null,
    actor_role: params.actorRole ?? null,
    event_type: params.eventType,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    title: params.title?.trim() || COMPANY_SECURITY_EVENT_LABELS[params.eventType],
    detail: params.detail?.trim() || null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    metadata: params.metadata ?? {},
    occurred_at: params.occurredAt ?? new Date().toISOString(),
  });

  if (isMissingCompanySecurityEventsError(insertResult.error)) {
    return { skipped: true, error: null };
  }

  return {
    skipped: false,
    error: insertResult.error,
  };
}
