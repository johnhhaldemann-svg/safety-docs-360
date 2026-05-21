import type { SupabaseClient } from "@supabase/supabase-js";
import { createCompanyNotification } from "@/lib/companyNotifications";
import type { WeatherAlert } from "@/lib/weather/alertFiltering";

export type WeatherNotificationChannel = "in_app" | "email" | "sms" | "push";

export type WeatherNotificationRecipient = {
  userId?: string | null;
  employeeId?: string | null;
  email?: string | null;
  phone?: string | null;
  channels: WeatherNotificationChannel[];
};

export type WeatherNotificationContext = {
  alertEventId: string;
  companyId: string;
  jobsiteId: string;
  jobsiteName: string;
  zipCode?: string | null;
  alert: WeatherAlert;
};

const WEATHER_ALERT_EMAIL_DISPLAY_NAME = "Urgent Safety Notification";

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

function formatTime(value?: string | null) {
  if (!value) return "not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatWeatherAlertFromEmail(value: string) {
  const formattedAddress = value.match(/<([^<>]+)>/)?.[1]?.trim();
  if (formattedAddress && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(formattedAddress)) {
    return `${WEATHER_ALERT_EMAIL_DISPLAY_NAME} <${formattedAddress}>`;
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return value;
  return `${WEATHER_ALERT_EMAIL_DISPLAY_NAME} <${value}>`;
}

export function normalizeSmsPhoneNumber(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function createWeatherDeliveryDedupeKey(params: {
  jobsiteId: string;
  userId?: string | null;
  recipientEmployeeId?: string | null;
  nwsAlertId: string;
  channel: string;
}) {
  const recipientKey = params.userId || (params.recipientEmployeeId ? `employee:${params.recipientEmployeeId}` : "unknown");
  return [params.jobsiteId, recipientKey, params.nwsAlertId, params.channel].join(":");
}

export function buildWeatherNotificationText(context: WeatherNotificationContext) {
  const expires = formatTime(context.alert.expiresAt);
  const instruction =
    context.alert.instruction?.trim() ||
    "Check site conditions, secure loose materials, and notify the site supervisor.";
  return {
    subject: `${WEATHER_ALERT_EMAIL_DISPLAY_NAME}: ${context.alert.eventName}`,
    text: [
      `${WEATHER_ALERT_EMAIL_DISPLAY_NAME}: ${context.alert.eventName} near ${context.jobsiteName}.`,
      context.zipCode ? `ZIP: ${context.zipCode}` : null,
      `Expires: ${expires}`,
      instruction,
    ].filter(Boolean).join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
        <div style="border:1px solid #fecaca;border-radius:20px;padding:28px;background:#ffffff;">
          <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#b91c1c;font-weight:700;margin:0 0 12px;">${WEATHER_ALERT_EMAIL_DISPLAY_NAME}</p>
          <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px;">${escapeHtml(context.alert.eventName)}</h1>
          <p style="margin:0 0 8px;"><strong>Jobsite:</strong> ${escapeHtml(context.jobsiteName)}</p>
          ${context.zipCode ? `<p style="margin:0 0 8px;"><strong>ZIP:</strong> ${escapeHtml(context.zipCode)}</p>` : ""}
          <p style="margin:0 0 8px;"><strong>Effective:</strong> ${escapeHtml(formatTime(context.alert.effectiveAt))}</p>
          <p style="margin:0 0 18px;"><strong>Expires:</strong> ${escapeHtml(expires)}</p>
          <p style="margin:0 0 8px;"><strong>Recommended action:</strong></p>
          <p style="margin:0;color:#475569;">${escapeHtml(instruction)}</p>
        </div>
      </div>
    `.trim(),
  };
}

export async function sendWeatherAlertEmail(params: {
  toEmail: string;
  context: WeatherNotificationContext;
  fetcher?: typeof fetch;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const configuredFromEmail =
    readEnv("WEATHER_ALERT_FROM_EMAIL") ?? readEnv("COMPANY_INVITE_FROM_EMAIL") ?? readEnv("RESEND_FROM_EMAIL");
  if (!resendApiKey || !configuredFromEmail) {
    return {
      sent: false,
      error:
        "Weather email delivery is not configured. Add RESEND_API_KEY and WEATHER_ALERT_FROM_EMAIL, COMPANY_INVITE_FROM_EMAIL, or RESEND_FROM_EMAIL.",
    };
  }

  const content = buildWeatherNotificationText(params.context);
  const fromEmail = formatWeatherAlertFromEmail(configuredFromEmail);
  const response = await (params.fetcher ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.toEmail],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false, error: body.trim() || "Weather email provider rejected the message." };
  }

  return { sent: true, error: null };
}

export async function sendWeatherAlertSms(params: {
  toPhone: string;
  context: WeatherNotificationContext;
  fetcher?: typeof fetch;
}) {
  const accountSid = readEnv("TWILIO_ACCOUNT_SID");
  const authToken = readEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = readEnv("TWILIO_FROM_NUMBER");
  const messagingServiceSid = readEnv("TWILIO_MESSAGING_SERVICE_SID");
  const toPhone = normalizeSmsPhoneNumber(params.toPhone);

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return {
      sent: false,
      error:
        "Weather SMS delivery is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.",
      toPhone,
    };
  }
  if (!toPhone) {
    return {
      sent: false,
      error: "No valid SMS phone number is available for this user.",
      toPhone: null,
    };
  }

  const content = buildWeatherNotificationText(params.context);
  const form = new URLSearchParams({
    To: toPhone,
    Body: content.text,
  });
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    form.set("From", fromNumber);
  }

  const response = await (params.fetcher ?? fetch)(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false, error: body.trim() || "Weather SMS provider rejected the message.", toPhone };
  }

  return { sent: true, error: null, toPhone };
}

export async function deliverWeatherNotification(params: {
  supabase: SupabaseClient;
  recipient: WeatherNotificationRecipient;
  channel: WeatherNotificationChannel;
  context: WeatherNotificationContext;
  fetcher?: typeof fetch;
}) {
  const dedupeKey = createWeatherDeliveryDedupeKey({
    jobsiteId: params.context.jobsiteId,
    userId: params.recipient.userId,
    recipientEmployeeId: params.recipient.employeeId,
    nwsAlertId: params.context.alert.id,
    channel: params.channel,
  });

  const inserted = await params.supabase
    .from("weather_notification_deliveries")
    .insert({
      weather_alert_event_id: params.context.alertEventId,
      company_id: params.context.companyId,
      jobsite_id: params.context.jobsiteId,
      user_id: params.recipient.userId ?? null,
      recipient_employee_id: params.recipient.employeeId ?? null,
      channel: params.channel,
      status: "pending",
      dedupe_key: dedupeKey,
    })
    .select("id")
    .single();

  if (inserted.error) {
    const message = (inserted.error.message ?? "").toLowerCase();
    if (inserted.error.code === "23505" || message.includes("duplicate")) {
      return { delivered: false, duplicate: true, skipped: false, error: null };
    }
    return { delivered: false, duplicate: false, skipped: false, error: inserted.error.message ?? "Delivery insert failed." };
  }

  const deliveryId = (inserted.data as { id?: string } | null)?.id;
  if (!deliveryId) {
    return { delivered: false, duplicate: false, skipped: false, error: "Delivery insert did not return an id." };
  }

  if (params.channel === "in_app") {
    if (!params.recipient.userId) {
      await params.supabase
        .from("weather_notification_deliveries")
        .update({ status: "skipped", error_message: "In-app delivery requires an app user recipient." })
        .eq("id", deliveryId);
      return { delivered: false, duplicate: false, skipped: true, error: "In-app delivery requires an app user recipient." };
    }

    await params.supabase
      .from("weather_notification_deliveries")
      .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
      .eq("id", deliveryId);
    const content = buildWeatherNotificationText(params.context);
    await createCompanyNotification({
      supabase: params.supabase,
      companyId: params.context.companyId,
      recipientUserId: params.recipient.userId,
      eventType: "weather_alert",
      title: content.subject,
      body: content.text,
      priority: "critical",
      href: `/jobsites/${encodeURIComponent(params.context.jobsiteId)}/overview`,
      sourceTable: "weather_alert_events",
      sourceId: params.context.alertEventId,
      metadata: {
        jobsiteId: params.context.jobsiteId,
        jobsiteName: params.context.jobsiteName,
        nwsAlertId: params.context.alert.id,
      },
    });
    return { delivered: true, duplicate: false, skipped: false, error: null };
  }

  if (params.channel === "email") {
    if (!params.recipient.email) {
      await params.supabase
        .from("weather_notification_deliveries")
        .update({ status: "skipped", error_message: "No email address is available for this user." })
        .eq("id", deliveryId);
      return { delivered: false, duplicate: false, skipped: true, error: "No email address is available for this user." };
    }

    const result = await sendWeatherAlertEmail({
      toEmail: params.recipient.email,
      context: params.context,
      fetcher: params.fetcher,
    });
    await params.supabase
      .from("weather_notification_deliveries")
      .update({
        status: result.sent ? "sent" : "failed",
        sent_at: result.sent ? new Date().toISOString() : null,
        error_message: result.error,
      })
      .eq("id", deliveryId);
    return { delivered: result.sent, duplicate: false, skipped: false, error: result.error };
  }

  if (params.channel === "sms") {
    if (!params.recipient.phone) {
      await params.supabase
        .from("weather_notification_deliveries")
        .update({ status: "skipped", error_message: "No phone number is available for this user." })
        .eq("id", deliveryId);
      return { delivered: false, duplicate: false, skipped: true, error: "No phone number is available for this user." };
    }

    const result = await sendWeatherAlertSms({
      toPhone: params.recipient.phone,
      context: params.context,
      fetcher: params.fetcher,
    });
    await params.supabase
      .from("weather_notification_deliveries")
      .update({
        status: result.sent ? "sent" : "failed",
        sent_at: result.sent ? new Date().toISOString() : null,
        error_message: result.error,
      })
      .eq("id", deliveryId);
    return { delivered: result.sent, duplicate: false, skipped: false, error: result.error };
  }

  await params.supabase
    .from("weather_notification_deliveries")
    .update({ status: "skipped", error_message: `${params.channel} delivery is not implemented yet.` })
    .eq("id", deliveryId);
  return { delivered: false, duplicate: false, skipped: true, error: `${params.channel} delivery is not implemented yet.` };
}
