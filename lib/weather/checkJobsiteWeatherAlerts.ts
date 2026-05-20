import type { SupabaseClient } from "@supabase/supabase-js";
import { serverLog } from "@/lib/serverLog";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  getDefaultWeatherAlertMinSeverity,
  isWeatherAlertRelevant,
  type WeatherAlert,
} from "@/lib/weather/alertFiltering";
import { deliverWeatherNotification, type WeatherNotificationChannel } from "@/lib/weather/notificationDelivery";
import { NwsClient } from "@/lib/weather/nwsClient";

type JobsiteWeatherRow = {
  id: string;
  company_id: string;
  name: string | null;
  zip_code: string | null;
  weather_latitude: number | string | null;
  weather_longitude: number | string | null;
};

type WeatherSubscriptionRow = {
  id: string;
  company_id: string;
  jobsite_id: string;
  user_id: string;
  enabled: boolean;
  channels: string[] | null;
  min_severity: string | null;
  event_allowlist: unknown;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export type JobsiteWeatherCronResult = {
  ok: boolean;
  skipped: boolean;
  error?: string;
  jobsitesSeen: number;
  locationsSeen: number;
  alertsSeen: number;
  alertEventsUpserted: number;
  deliveriesSent: number;
  deliveriesSkipped: number;
  deliveriesFailed: number;
  locationsFailed: number;
  jobsitesSkipped: number;
};

function emptyResult(overrides?: Partial<JobsiteWeatherCronResult>): JobsiteWeatherCronResult {
  return {
    ok: true,
    skipped: false,
    jobsitesSeen: 0,
    locationsSeen: 0,
    alertsSeen: 0,
    alertEventsUpserted: 0,
    deliveriesSent: 0,
    deliveriesSkipped: 0,
    deliveriesFailed: 0,
    locationsFailed: 0,
    jobsitesSkipped: 0,
    ...overrides,
  };
}

function readPositiveInt(name: string, fallback: number, max: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.floor(value));
}

export function isJobsiteWeatherNotificationsEnabled() {
  const value = process.env.FEATURE_JOBSITE_WEATHER_NOTIFICATIONS?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function asNumber(value: number | string | null) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function locationKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function normalizeChannels(value: unknown): WeatherNotificationChannel[] {
  if (!Array.isArray(value)) return ["in_app"];
  const allowed = new Set(["in_app", "email", "sms", "push"]);
  const channels = value
    .map((item) => String(item ?? "").trim())
    .filter((item): item is WeatherNotificationChannel => allowed.has(item));
  return channels.length > 0 ? channels : ["in_app"];
}

function isWithinQuietHours(row: WeatherSubscriptionRow, now = new Date()) {
  if (!row.quiet_hours_start || !row.quiet_hours_end) return false;
  const start = row.quiet_hours_start.slice(0, 5);
  const end = row.quiet_hours_end.slice(0, 5);
  const current = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

async function getUserEmailById(supabase: SupabaseClient, userId: string) {
  const result = await supabase.auth.admin.getUserById(userId);
  return result.data.user?.email ?? null;
}

async function loadUserEmailMap(supabase: SupabaseClient, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (userId) => [userId, await getUserEmailById(supabase, userId).catch(() => null)] as const)
  );
  return new Map(entries);
}

async function upsertWeatherAlertEvent(params: {
  supabase: SupabaseClient;
  jobsite: JobsiteWeatherRow;
  alert: WeatherAlert;
}) {
  const result = await params.supabase
    .from("weather_alert_events")
    .upsert(
      {
        company_id: params.jobsite.company_id,
        jobsite_id: params.jobsite.id,
        nws_alert_id: params.alert.id,
        event_name: params.alert.eventName,
        severity: params.alert.severity,
        urgency: params.alert.urgency,
        certainty: params.alert.certainty,
        headline: params.alert.headline,
        description: params.alert.description,
        instruction: params.alert.instruction,
        effective_at: params.alert.effectiveAt,
        expires_at: params.alert.expiresAt,
        status: params.alert.status,
        raw_payload_json: params.alert.rawPayload,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "jobsite_id,nws_alert_id" }
    )
    .select("id")
    .single();

  if (result.error) throw new Error(result.error.message || "Failed to upsert weather alert.");
  const id = (result.data as { id?: string } | null)?.id;
  if (!id) throw new Error("Weather alert upsert did not return an id.");
  return id;
}

export async function checkJobsiteWeatherAlerts(input: {
  supabase?: SupabaseClient | null;
  nwsClient?: NwsClient;
  fetcher?: typeof fetch;
  maxJobsites?: number;
} = {}): Promise<JobsiteWeatherCronResult> {
  if (!isJobsiteWeatherNotificationsEnabled()) {
    return emptyResult({ skipped: true });
  }

  const supabase = input.supabase ?? createSupabaseAdminClient();
  if (!supabase) {
    return emptyResult({ ok: false, error: "Missing Supabase service role configuration." });
  }

  const maxJobsites = input.maxJobsites ?? readPositiveInt("WEATHER_CRON_MAX_JOBSITES", 500, 5000);
  const nwsClient = input.nwsClient ?? new NwsClient({ fetcher: input.fetcher });
  const result = emptyResult();

  const jobsitesResult = await supabase
    .from("company_jobsites")
    .select("id, company_id, name, zip_code, weather_latitude, weather_longitude")
    .eq("weather_enabled", true)
    .neq("status", "archived")
    .limit(maxJobsites);

  if (jobsitesResult.error) {
    return emptyResult({ ok: false, error: jobsitesResult.error.message || "Failed to load weather jobsites." });
  }

  const jobsites = ((jobsitesResult.data ?? []) as JobsiteWeatherRow[]).filter(Boolean);
  result.jobsitesSeen = jobsites.length;

  const jobsitesByLocation = new Map<string, { latitude: number; longitude: number; jobsites: JobsiteWeatherRow[] }>();
  for (const jobsite of jobsites) {
    const latitude = asNumber(jobsite.weather_latitude);
    const longitude = asNumber(jobsite.weather_longitude);
    if (latitude === null || longitude === null) {
      result.jobsitesSkipped += 1;
      continue;
    }
    const key = locationKey(latitude, longitude);
    const group = jobsitesByLocation.get(key) ?? { latitude, longitude, jobsites: [] };
    group.jobsites.push(jobsite);
    jobsitesByLocation.set(key, group);
  }
  result.locationsSeen = jobsitesByLocation.size;

  const jobsiteIds = jobsites.map((jobsite) => jobsite.id);
  const subscriptionsByJobsite = new Map<string, WeatherSubscriptionRow[]>();
  if (jobsiteIds.length > 0) {
    const subscriptionsResult = await supabase
      .from("jobsite_weather_subscriptions")
      .select("id, company_id, jobsite_id, user_id, enabled, channels, min_severity, event_allowlist, quiet_hours_start, quiet_hours_end")
      .in("jobsite_id", jobsiteIds)
      .eq("enabled", true);

    if (subscriptionsResult.error) {
      return emptyResult({ ok: false, error: subscriptionsResult.error.message || "Failed to load subscriptions." });
    }

    for (const subscription of ((subscriptionsResult.data ?? []) as WeatherSubscriptionRow[])) {
      const rows = subscriptionsByJobsite.get(subscription.jobsite_id) ?? [];
      rows.push(subscription);
      subscriptionsByJobsite.set(subscription.jobsite_id, rows);
    }
  }

  const userEmailMap = await loadUserEmailMap(
    supabase,
    [...subscriptionsByJobsite.values()].flat().map((subscription) => subscription.user_id)
  );

  const globalMinSeverity = getDefaultWeatherAlertMinSeverity();
  for (const group of jobsitesByLocation.values()) {
    let alerts: WeatherAlert[] = [];
    try {
      alerts = await nwsClient.getActiveAlerts(group.latitude, group.longitude);
      result.alertsSeen += alerts.length;
    } catch (error) {
      result.locationsFailed += 1;
      serverLog("warn", "jobsite_weather_location_failed", {
        location: locationKey(group.latitude, group.longitude),
        jobsites: group.jobsites.length,
        message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
      });
      continue;
    }

    const checkedAt = new Date().toISOString();
    for (const jobsite of group.jobsites) {
      await supabase
        .from("company_jobsites")
        .update({ weather_last_checked_at: checkedAt })
        .eq("id", jobsite.id);

      const subscriptions = subscriptionsByJobsite.get(jobsite.id) ?? [];
      if (subscriptions.length === 0) continue;

      for (const alert of alerts) {
        if (!isWeatherAlertRelevant({ alert, minSeverity: globalMinSeverity })) continue;

        let alertEventId: string;
        try {
          alertEventId = await upsertWeatherAlertEvent({ supabase, jobsite, alert });
          result.alertEventsUpserted += 1;
        } catch (error) {
          result.deliveriesFailed += 1;
          serverLog("warn", "jobsite_weather_alert_upsert_failed", {
            jobsiteId: jobsite.id,
            alertId: alert.id.slice(0, 120),
            message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
          });
          continue;
        }

        for (const subscription of subscriptions) {
          if (isWithinQuietHours(subscription)) {
            result.deliveriesSkipped += 1;
            continue;
          }
          if (!isWeatherAlertRelevant({ alert, minSeverity: subscription.min_severity, eventAllowlist: subscription.event_allowlist })) {
            continue;
          }

          for (const channel of normalizeChannels(subscription.channels)) {
            const delivery = await deliverWeatherNotification({
              supabase,
              recipient: {
                userId: subscription.user_id,
                email: userEmailMap.get(subscription.user_id) ?? null,
                channels: normalizeChannels(subscription.channels),
              },
              channel,
              context: {
                alertEventId,
                companyId: jobsite.company_id,
                jobsiteId: jobsite.id,
                jobsiteName: jobsite.name?.trim() || "Jobsite",
                zipCode: jobsite.zip_code,
                alert,
              },
              fetcher: input.fetcher,
            });
            if (delivery.duplicate) result.deliveriesSkipped += 1;
            else if (delivery.delivered) result.deliveriesSent += 1;
            else result.deliveriesFailed += 1;
          }
        }
      }
    }
  }

  serverLog("info", "jobsite_weather_cron_completed", {
    jobsitesSeen: result.jobsitesSeen,
    locationsSeen: result.locationsSeen,
    alertsSeen: result.alertsSeen,
    deliveriesSent: result.deliveriesSent,
    deliveriesFailed: result.deliveriesFailed,
  });

  return result;
}
