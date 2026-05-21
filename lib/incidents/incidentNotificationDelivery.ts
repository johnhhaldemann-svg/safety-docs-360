import type { SupabaseClient } from "@supabase/supabase-js";
import { createCompanyNotification } from "@/lib/companyNotifications";

export type IncidentNotificationChannel = "in_app" | "email";
export type IncidentNotificationSourceTable = "company_incidents" | "company_safety_submissions";

export type IncidentAlertRecord = {
  id: string;
  companyId: string;
  jobsiteId?: string | null;
  title: string;
  description?: string | null;
  severity?: string | null;
  category?: string | null;
  fatality?: boolean | null;
  idlhFlag?: boolean | null;
  sifFlag?: boolean | null;
  stopWorkStatus?: string | null;
  escalationLevel?: string | null;
  occurredAt?: string | null;
  createdAt?: string | null;
  ownerUserId?: string | null;
};

export type IncidentAlertRecipient = {
  userId: string;
  email: string | null;
  name: string | null;
};

type MembershipRow = {
  user_id?: string | null;
  role?: string | null;
  status?: string | null;
};

type JobsiteAssignmentRow = {
  user_id?: string | null;
  role?: string | null;
};

type JobsiteRow = {
  id: string;
  name?: string | null;
};

const COMPANY_ALERT_ROLES = new Set(["company_admin", "manager", "safety_manager"]);
const JOBSITE_ALERT_ROLES = new Set(["project_manager", "field_supervisor", "foreman"]);
const INCIDENT_ALERT_EMAIL_DISPLAY_NAME = "Urgent Safety Notification";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatTime(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatIncidentAlertFromEmail(value: string) {
  const formattedAddress = value.match(/<([^<>]+)>/)?.[1]?.trim();
  if (formattedAddress && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(formattedAddress)) {
    return `${INCIDENT_ALERT_EMAIL_DISPLAY_NAME} <${formattedAddress}>`;
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return value;
  return `${INCIDENT_ALERT_EMAIL_DISPLAY_NAME} <${value}>`;
}

function getIncidentAlertFromEmail() {
  return (
    readEnv("INCIDENT_ALERT_FROM_EMAIL") ??
    readEnv("WEATHER_ALERT_FROM_EMAIL") ??
    readEnv("COMPANY_INVITE_FROM_EMAIL") ??
    readEnv("INVITE_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL")
  );
}

function getBaseUrl() {
  return (
    readEnv("NEXT_PUBLIC_SITE_URL") ??
    readEnv("NEXT_PUBLIC_APP_URL") ??
    readEnv("SITE_URL") ??
    (readEnv("VERCEL_PROJECT_PRODUCTION_URL")
      ? `https://${readEnv("VERCEL_PROJECT_PRODUCTION_URL")}`
      : null) ??
    (readEnv("VERCEL_URL") ? `https://${readEnv("VERCEL_URL")}` : null)
  );
}

function incidentUrl() {
  const baseUrl = getBaseUrl();
  const path = "/incidents";
  if (!baseUrl) return path;
  return new URL(path, baseUrl).toString();
}

export function isSevereIncidentAlert(record: Pick<IncidentAlertRecord, "fatality" | "idlhFlag" | "severity" | "sifFlag" | "stopWorkStatus">) {
  const stopWorkStatus = normalizeKey(record.stopWorkStatus);
  return (
    record.fatality === true ||
    record.idlhFlag === true ||
    normalizeKey(record.severity) === "critical" ||
    record.sifFlag === true ||
    stopWorkStatus === "stop_work_requested" ||
    stopWorkStatus === "stop_work_active"
  );
}

export function isActionableIncidentAlert(record: Pick<IncidentAlertRecord, "fatality" | "idlhFlag" | "severity" | "sifFlag" | "stopWorkStatus" | "category">) {
  return (
    isSevereIncidentAlert(record) ||
    normalizeKey(record.severity) === "high" ||
    normalizeKey(record.category) === "incident"
  );
}

export function shouldDispatchIncidentAlert(params: {
  previous?: IncidentAlertRecord | null;
  next: IncidentAlertRecord;
}) {
  const previousSevere = params.previous ? isSevereIncidentAlert(params.previous) : false;
  const nextSevere = isSevereIncidentAlert(params.next);
  const previousActionable = params.previous ? isActionableIncidentAlert(params.previous) : false;
  const nextActionable = isActionableIncidentAlert(params.next);
  return (nextSevere && !previousSevere) || (nextActionable && !previousActionable);
}

export function createIncidentDeliveryDedupeKey(params: {
  sourceTable: IncidentNotificationSourceTable;
  sourceId: string;
  recipientUserId: string;
  channel: IncidentNotificationChannel;
}) {
  return [
    params.sourceTable,
    params.sourceId,
    `user:${params.recipientUserId}`,
    params.channel,
    "incident-alert-v1",
  ].join(":");
}

export function buildIncidentAlertContent(params: {
  record: IncidentAlertRecord;
  jobsiteName?: string | null;
}) {
  const severe = isSevereIncidentAlert(params.record);
  const title = clean(params.record.title) || "Incident alert";
  const severity = clean(params.record.severity) || "not set";
  const category = clean(params.record.category) || "incident";
  const drivers = [
    params.record.fatality ? "Fatality" : null,
    params.record.idlhFlag ? "IDLH" : null,
    params.record.sifFlag ? "SIF potential" : null,
    normalizeKey(params.record.severity) === "critical" ? "Critical severity" : null,
    normalizeKey(params.record.stopWorkStatus) === "stop_work_active" ? "Stop-work active" : null,
    normalizeKey(params.record.stopWorkStatus) === "stop_work_requested" ? "Stop-work requested" : null,
  ].filter(Boolean) as string[];
  const subject = severe
    ? `Urgent Safety Notification: ${cleanSubject(title)}`
    : `Incident alert: ${cleanSubject(title)}`;
  const action = severe
    ? "Verify emergency response, notify safety leadership, preserve facts, and complete a stop-work review before work resumes."
    : "Review the incident, confirm controls, and assign follow-up actions.";
  const url = incidentUrl();
  const text = [
    subject,
    `Category: ${category}`,
    `Severity: ${severity}`,
    params.jobsiteName ? `Jobsite: ${params.jobsiteName}` : null,
    `Occurred: ${formatTime(params.record.occurredAt ?? params.record.createdAt)}`,
    drivers.length ? `Top drivers: ${drivers.join(", ")}` : null,
    `Next action: ${action}`,
    url,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:680px;margin:0 auto;padding:24px;">
      <div style="border:1px solid ${severe ? "#fecaca" : "#fed7aa"};border-radius:20px;padding:28px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${severe ? "#b91c1c" : "#c2410c"};font-weight:700;margin:0 0 12px;">${severe ? "Urgent Safety Notification" : "Incident Alert"}</p>
        <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 8px;"><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p style="margin:0 0 8px;"><strong>Severity:</strong> ${escapeHtml(severity)}</p>
        ${params.jobsiteName ? `<p style="margin:0 0 8px;"><strong>Jobsite:</strong> ${escapeHtml(params.jobsiteName)}</p>` : ""}
        <p style="margin:0 0 8px;"><strong>Occurred:</strong> ${escapeHtml(formatTime(params.record.occurredAt ?? params.record.createdAt))}</p>
        ${drivers.length ? `<p style="margin:0 0 18px;"><strong>Top drivers:</strong> ${escapeHtml(drivers.join(", "))}</p>` : ""}
        <p style="margin:0 0 8px;"><strong>Immediate next action:</strong></p>
        <p style="margin:0 0 22px;color:#475569;">${escapeHtml(action)}</p>
        <p style="margin:0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">Open Incident Log</a></p>
      </div>
    </div>
  `.trim();

  return { subject, text, html, href: "/incidents" };
}

async function getAuthUserContactById(supabase: SupabaseClient, userId: string) {
  const admin = supabase.auth?.admin;
  if (!admin?.getUserById) return { email: null, name: null };
  const result = await admin.getUserById(userId);
  const user = result.data.user;
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const name =
    (typeof metadata?.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    user?.email ||
    null;
  return { email: user?.email ?? null, name };
}

export async function resolveIncidentAlertRecipients(params: {
  supabase: SupabaseClient;
  companyId: string;
  jobsiteId?: string | null;
  ownerUserId?: string | null;
}): Promise<{ recipients: IncidentAlertRecipient[]; error: string | null }> {
  const userIds = new Set<string>();
  const memberships = await params.supabase
    .from("company_memberships")
    .select("user_id, role, status")
    .eq("company_id", params.companyId)
    .eq("status", "active");

  if (memberships.error) {
    return { recipients: [], error: memberships.error.message };
  }

  for (const row of (memberships.data ?? []) as MembershipRow[]) {
    if (row.user_id && COMPANY_ALERT_ROLES.has(normalizeKey(row.role))) {
      userIds.add(row.user_id);
    }
  }

  if (params.jobsiteId) {
    const assignments = await params.supabase
      .from("company_jobsite_assignments")
      .select("user_id, role")
      .eq("company_id", params.companyId)
      .eq("jobsite_id", params.jobsiteId);
    if (!assignments.error) {
      for (const row of (assignments.data ?? []) as JobsiteAssignmentRow[]) {
        if (row.user_id && JOBSITE_ALERT_ROLES.has(normalizeKey(row.role))) {
          userIds.add(row.user_id);
        }
      }
    }
  }

  if (params.ownerUserId) {
    userIds.add(params.ownerUserId);
  }

  const recipients = await Promise.all(
    [...userIds].map(async (userId) => {
      const contact = await getAuthUserContactById(params.supabase, userId).catch(() => ({
        email: null,
        name: null,
      }));
      return {
        userId,
        email: contact.email,
        name: contact.name,
      };
    })
  );

  return { recipients, error: null };
}

async function loadJobsiteName(params: {
  supabase: SupabaseClient;
  companyId: string;
  jobsiteId?: string | null;
}) {
  if (!params.jobsiteId) return null;
  const result = await params.supabase
    .from("company_jobsites")
    .select("id, name")
    .eq("company_id", params.companyId)
    .eq("id", params.jobsiteId)
    .maybeSingle();
  if (result.error) return null;
  return ((result.data as JobsiteRow | null)?.name ?? null) || null;
}

export async function sendIncidentAlertEmail(params: {
  toEmail: string;
  record: IncidentAlertRecord;
  jobsiteName?: string | null;
  fetcher?: typeof fetch;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const configuredFromEmail = getIncidentAlertFromEmail();
  if (!resendApiKey || !configuredFromEmail) {
    return {
      sent: false,
      status: "skipped" as const,
      providerMessageId: null,
      error:
        "Incident alert email was not sent because email delivery is not configured. Add RESEND_API_KEY and INCIDENT_ALERT_FROM_EMAIL in Vercel.",
    };
  }

  const content = buildIncidentAlertContent({
    record: params.record,
    jobsiteName: params.jobsiteName,
  });
  const response = await (params.fetcher ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatIncidentAlertFromEmail(configuredFromEmail),
      to: [params.toEmail],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      sent: false,
      status: "failed" as const,
      providerMessageId: null,
      error: body.trim() || "Incident alert email provider rejected the message.",
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return { sent: true, status: "sent" as const, providerMessageId: payload?.id ?? null, error: null };
}

async function reserveIncidentDelivery(params: {
  supabase: SupabaseClient;
  companyId: string;
  sourceTable: IncidentNotificationSourceTable;
  sourceId: string;
  recipientUserId: string;
  recipientEmail?: string | null;
  channel: IncidentNotificationChannel;
}) {
  const dedupeKey = createIncidentDeliveryDedupeKey({
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    recipientUserId: params.recipientUserId,
    channel: params.channel,
  });
  const result = await params.supabase
    .from("incident_notification_deliveries")
    .insert({
      company_id: params.companyId,
      source_table: params.sourceTable,
      source_id: params.sourceId,
      recipient_user_id: params.recipientUserId,
      recipient_email: params.recipientEmail ?? null,
      channel: params.channel,
      status: "pending",
      dedupe_key: dedupeKey,
    })
    .select("id")
    .single();
  if (result.error) {
    const message = (result.error.message ?? "").toLowerCase();
    if (result.error.code === "23505" || message.includes("duplicate")) {
      return { id: null, duplicate: true, error: null };
    }
    return { id: null, duplicate: false, error: result.error.message ?? "Delivery insert failed." };
  }
  return { id: (result.data as { id?: string } | null)?.id ?? null, duplicate: false, error: null };
}

export async function deliverIncidentAlert(params: {
  supabase: SupabaseClient;
  sourceTable: IncidentNotificationSourceTable;
  record: IncidentAlertRecord;
  recipient: IncidentAlertRecipient;
  channel: IncidentNotificationChannel;
  jobsiteName?: string | null;
  actorUserId?: string | null;
  fetcher?: typeof fetch;
}) {
  const reserved = await reserveIncidentDelivery({
    supabase: params.supabase,
    companyId: params.record.companyId,
    sourceTable: params.sourceTable,
    sourceId: params.record.id,
    recipientUserId: params.recipient.userId,
    recipientEmail: params.recipient.email,
    channel: params.channel,
  });
  if (reserved.duplicate) {
    return { delivered: false, duplicate: true, skipped: false, error: null };
  }
  if (reserved.error || !reserved.id) {
    return { delivered: false, duplicate: false, skipped: false, error: reserved.error ?? "Delivery insert did not return an id." };
  }

  if (params.channel === "in_app") {
    const content = buildIncidentAlertContent({
      record: params.record,
      jobsiteName: params.jobsiteName,
    });
    const notification = await createCompanyNotification({
      supabase: params.supabase,
      companyId: params.record.companyId,
      recipientUserId: params.recipient.userId,
      actorUserId: params.actorUserId ?? null,
      eventType: "incident_alert",
      title: content.subject,
      body: content.text,
      priority: isSevereIncidentAlert(params.record) ? "critical" : "high",
      href: content.href,
      sourceTable: params.sourceTable,
      sourceId: params.record.id,
      metadata: {
        jobsiteId: params.record.jobsiteId ?? null,
        jobsiteName: params.jobsiteName ?? null,
        fatality: params.record.fatality === true,
        idlhFlag: params.record.idlhFlag === true,
        sifFlag: params.record.sifFlag === true,
        stopWorkStatus: params.record.stopWorkStatus ?? null,
      },
      ignorePreference: isSevereIncidentAlert(params.record),
    });
    const sent = !notification.error;
    await params.supabase
      .from("incident_notification_deliveries")
      .update({
        status: sent ? "sent" : "failed",
        sent_at: sent ? new Date().toISOString() : null,
        error_message: notification.error,
      })
      .eq("id", reserved.id);
    return { delivered: sent, duplicate: false, skipped: false, error: notification.error };
  }

  if (!params.recipient.email) {
    await params.supabase
      .from("incident_notification_deliveries")
      .update({ status: "skipped", error_message: "No email address is available for this user." })
      .eq("id", reserved.id);
    return { delivered: false, duplicate: false, skipped: true, error: "No email address is available for this user." };
  }

  const email = await sendIncidentAlertEmail({
    toEmail: params.recipient.email,
    record: params.record,
    jobsiteName: params.jobsiteName,
    fetcher: params.fetcher,
  });
  await params.supabase
    .from("incident_notification_deliveries")
    .update({
      status: email.status,
      sent_at: email.sent ? new Date().toISOString() : null,
      provider_message_id: email.providerMessageId,
      error_message: email.error,
    })
    .eq("id", reserved.id);
  return {
    delivered: email.sent,
    duplicate: false,
    skipped: email.status === "skipped",
    error: email.error,
  };
}

export async function dispatchIncidentAlertNotifications(params: {
  supabase: SupabaseClient;
  sourceTable: IncidentNotificationSourceTable;
  record: IncidentAlertRecord;
  actorUserId?: string | null;
  fetcher?: typeof fetch;
}) {
  if (!isActionableIncidentAlert(params.record)) {
    return { attempted: false, recipients: 0, sent: 0, skipped: 0, failed: 0, error: null };
  }

  const [jobsiteName, recipientsResult] = await Promise.all([
    loadJobsiteName({
      supabase: params.supabase,
      companyId: params.record.companyId,
      jobsiteId: params.record.jobsiteId,
    }),
    resolveIncidentAlertRecipients({
      supabase: params.supabase,
      companyId: params.record.companyId,
      jobsiteId: params.record.jobsiteId,
      ownerUserId: params.record.ownerUserId,
    }),
  ]);

  if (recipientsResult.error) {
    return { attempted: true, recipients: 0, sent: 0, skipped: 0, failed: 1, error: recipientsResult.error };
  }

  const channels: IncidentNotificationChannel[] = isSevereIncidentAlert(params.record)
    ? ["in_app", "email"]
    : ["in_app"];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const recipient of recipientsResult.recipients) {
    for (const channel of channels) {
      const delivery = await deliverIncidentAlert({
        supabase: params.supabase,
        sourceTable: params.sourceTable,
        record: params.record,
        recipient,
        channel,
        jobsiteName,
        actorUserId: params.actorUserId,
        fetcher: params.fetcher,
      });
      if (delivery.delivered) sent += 1;
      else if (delivery.skipped || delivery.duplicate) skipped += 1;
      else failed += 1;
    }
  }

  return {
    attempted: true,
    recipients: recipientsResult.recipients.length,
    sent,
    skipped,
    failed,
    error: failed > 0 ? "One or more incident alert deliveries failed." : null,
  };
}
