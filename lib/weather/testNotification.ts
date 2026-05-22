import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeatherNotificationChannel, WeatherNotificationContext } from "@/lib/weather/notificationDelivery";
import { sendWeatherAlertEmail, sendWeatherAlertSms } from "@/lib/weather/notificationDelivery";
import { resolveJobsiteWeatherNotificationRecipients } from "@/lib/weather/checkJobsiteWeatherAlerts";
import type { WeatherAlert } from "@/lib/weather/alertFiltering";

type TestNotificationJobsite = {
  id: string;
  company_id: string;
  name: string | null;
  zip_code: string | null;
  project_manager: string | null;
  safety_lead: string | null;
  weather_latitude: number | string | null;
  weather_longitude: number | string | null;
};

export type JobsiteWeatherTestNotificationResult = {
  ok: boolean;
  recipientsSeen: number;
  deliveriesSent: number;
  deliveriesFailed: number;
  deliveriesSkipped: number;
  results: Array<{
    recipientName: string | null;
    userId: string | null;
    employeeId: string | null;
    contact: string | null;
    normalizedContact?: string | null;
    channel: WeatherNotificationChannel;
    status: "sent" | "failed" | "skipped";
    error: string | null;
  }>;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeChannels(value: unknown): WeatherNotificationChannel[] {
  if (!Array.isArray(value)) return ["email", "sms"];
  const allowed = new Set(["email", "sms"]);
  const channels = value
    .map((item) => String(item ?? "").trim())
    .filter((item): item is WeatherNotificationChannel => allowed.has(item));
  return channels.length > 0 ? [...new Set(channels)] : ["email", "sms"];
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function isEmailConfigured() {
  return Boolean(
    readEnv("RESEND_API_KEY") &&
      (readEnv("WEATHER_ALERT_FROM_EMAIL") || readEnv("COMPANY_INVITE_FROM_EMAIL") || readEnv("RESEND_FROM_EMAIL"))
  );
}

function isSmsConfigured() {
  return Boolean(
    readEnv("TWILIO_ACCOUNT_SID") &&
      readEnv("TWILIO_AUTH_TOKEN") &&
      (readEnv("TWILIO_FROM_NUMBER") || readEnv("TWILIO_MESSAGING_SERVICE_SID"))
  );
}

function buildTestAlert(): WeatherAlert {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    id: `test-weather-notification-${now.getTime()}`,
    eventName: "Urgent Safety Notification Test",
    severity: "Test",
    urgency: "Expected",
    certainty: "Likely",
    headline: "SafePredict urgent safety notification test.",
    description: "This is a test urgent safety notification. No action is required.",
    instruction: "No action required. This confirms urgent safety notification email and SMS delivery setup.",
    effectiveAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: "Test",
    rawPayload: { source: "SafePredict test notification" },
  };
}

export async function sendJobsiteWeatherTestNotification(params: {
  supabase: SupabaseClient;
  jobsite: TestNotificationJobsite;
  channels?: unknown;
  fetcher?: typeof fetch;
}): Promise<JobsiteWeatherTestNotificationResult> {
  const requestedChannels = normalizeChannels(params.channels);
  const recipientsByJobsite = await resolveJobsiteWeatherNotificationRecipients({
    supabase: params.supabase,
    jobsites: [params.jobsite],
  });
  const recipients = recipientsByJobsite.get(params.jobsite.id) ?? [];
  const alert = buildTestAlert();
  const context: WeatherNotificationContext = {
    alertEventId: alert.id,
    companyId: params.jobsite.company_id,
    jobsiteId: params.jobsite.id,
    jobsiteName: clean(params.jobsite.name) || "Jobsite",
    zipCode: params.jobsite.zip_code,
    alert,
  };

  const result: JobsiteWeatherTestNotificationResult = {
    ok: true,
    recipientsSeen: recipients.length,
    deliveriesSent: 0,
    deliveriesFailed: 0,
    deliveriesSkipped: 0,
    results: [],
  };
  const emailConfigured = isEmailConfigured();
  const smsConfigured = isSmsConfigured();

  for (const recipient of recipients) {
    for (const channel of requestedChannels) {
      if (channel === "email") {
        if (!emailConfigured) {
          result.deliveriesSkipped += 1;
          result.results.push({
            recipientName: recipient.name,
            userId: recipient.userId,
            employeeId: recipient.employeeId,
            contact: recipient.email,
            channel,
            status: "skipped",
            error: "Weather email provider is not configured.",
          });
          continue;
        }
        if (!recipient.email) {
          result.deliveriesSkipped += 1;
          result.results.push({
            recipientName: recipient.name,
            userId: recipient.userId,
            employeeId: recipient.employeeId,
            contact: recipient.email,
            channel,
            status: "skipped",
            error: "No email address is available for this recipient.",
          });
          continue;
        }

        const sent = await sendWeatherAlertEmail({
          toEmail: recipient.email,
          context,
          fetcher: params.fetcher,
        });
        if (sent.sent) result.deliveriesSent += 1;
        else result.deliveriesFailed += 1;
        result.results.push({
          recipientName: recipient.name,
          userId: recipient.userId,
          employeeId: recipient.employeeId,
          contact: recipient.email,
          channel,
          status: sent.sent ? "sent" : "failed",
          error: sent.error,
        });
      }

      if (channel === "sms") {
        if (!smsConfigured) {
          result.deliveriesSkipped += 1;
          result.results.push({
            recipientName: recipient.name,
            userId: recipient.userId,
            employeeId: recipient.employeeId,
            contact: recipient.phone,
            channel,
            status: "skipped",
            error: "Weather SMS provider is not configured.",
          });
          continue;
        }
        if (!recipient.phone) {
          result.deliveriesSkipped += 1;
          result.results.push({
            recipientName: recipient.name,
            userId: recipient.userId,
            employeeId: recipient.employeeId,
            contact: recipient.phone,
            channel,
            status: "skipped",
            error: "No phone number is available for this recipient.",
          });
          continue;
        }

        const sent = await sendWeatherAlertSms({
          toPhone: recipient.phone,
          context,
          fetcher: params.fetcher,
        });
        if (sent.sent) result.deliveriesSent += 1;
        else result.deliveriesFailed += 1;
        result.results.push({
          recipientName: recipient.name,
          userId: recipient.userId,
          employeeId: recipient.employeeId,
          contact: recipient.phone,
          normalizedContact: sent.toPhone ?? null,
          channel,
          status: sent.sent ? "sent" : "failed",
          error: sent.error,
        });
      }
    }
  }

  result.ok = result.recipientsSeen > 0 && result.deliveriesFailed === 0 && result.deliveriesSent > 0;
  return result;
}
