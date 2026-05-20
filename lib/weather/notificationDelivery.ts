import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeatherAlert } from "@/lib/weather/alertFiltering";

export type WeatherNotificationChannel = "in_app" | "email" | "sms" | "push";

export type WeatherNotificationRecipient = {
  userId: string;
  email?: string | null;
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

export function createWeatherDeliveryDedupeKey(params: {
  jobsiteId: string;
  userId: string;
  nwsAlertId: string;
  channel: string;
}) {
  return [params.jobsiteId, params.userId, params.nwsAlertId, params.channel].join(":");
}

export function buildWeatherNotificationText(context: WeatherNotificationContext) {
  const expires = formatTime(context.alert.expiresAt);
  const instruction =
    context.alert.instruction?.trim() ||
    "Check site conditions, secure loose materials, and notify the site supervisor.";
  return {
    subject: `Weather Alert: ${context.alert.eventName}`,
    text: [
      `${context.alert.eventName} near ${context.jobsiteName}.`,
      context.zipCode ? `ZIP: ${context.zipCode}` : null,
      `Expires: ${expires}`,
      instruction,
    ].filter(Boolean).join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
        <div style="border:1px solid #fecaca;border-radius:20px;padding:28px;background:#ffffff;">
          <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#b91c1c;font-weight:700;margin:0 0 12px;">Jobsite Weather Alert</p>
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
  const fromEmail = readEnv("WEATHER_ALERT_FROM_EMAIL") ?? readEnv("RESEND_FROM_EMAIL");
  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      error: "Weather email delivery is not configured. Add RESEND_API_KEY and WEATHER_ALERT_FROM_EMAIL.",
    };
  }

  const content = buildWeatherNotificationText(params.context);
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
    nwsAlertId: params.context.alert.id,
    channel: params.channel,
  });

  const inserted = await params.supabase
    .from("weather_notification_deliveries")
    .insert({
      weather_alert_event_id: params.context.alertEventId,
      company_id: params.context.companyId,
      jobsite_id: params.context.jobsiteId,
      user_id: params.recipient.userId,
      channel: params.channel,
      status: "pending",
      dedupe_key: dedupeKey,
    })
    .select("id")
    .single();

  if (inserted.error) {
    const message = (inserted.error.message ?? "").toLowerCase();
    if (inserted.error.code === "23505" || message.includes("duplicate")) {
      return { delivered: false, duplicate: true, error: null };
    }
    return { delivered: false, duplicate: false, error: inserted.error.message ?? "Delivery insert failed." };
  }

  const deliveryId = (inserted.data as { id?: string } | null)?.id;
  if (!deliveryId) {
    return { delivered: false, duplicate: false, error: "Delivery insert did not return an id." };
  }

  if (params.channel === "in_app") {
    await params.supabase
      .from("weather_notification_deliveries")
      .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
      .eq("id", deliveryId);
    return { delivered: true, duplicate: false, error: null };
  }

  if (params.channel === "email") {
    if (!params.recipient.email) {
      await params.supabase
        .from("weather_notification_deliveries")
        .update({ status: "skipped", error_message: "No email address is available for this user." })
        .eq("id", deliveryId);
      return { delivered: false, duplicate: false, error: "No email address is available for this user." };
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
    return { delivered: result.sent, duplicate: false, error: result.error };
  }

  await params.supabase
    .from("weather_notification_deliveries")
    .update({ status: "skipped", error_message: `${params.channel} delivery is not implemented yet.` })
    .eq("id", deliveryId);
  return { delivered: false, duplicate: false, error: `${params.channel} delivery is not implemented yet.` };
}
