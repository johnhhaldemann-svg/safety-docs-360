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
  project_manager: string | null;
  safety_lead: string | null;
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

type WeatherUserContact = {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
};

type WeatherAssignmentRow = {
  company_id: string;
  jobsite_id: string;
  user_id: string;
  role: string | null;
};

type WeatherRoleRow = {
  company_id: string;
  user_id: string;
  role: string | null;
  account_status: string | null;
};

type WeatherProfileRow = {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  phone: string | null;
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

export type CheckJobsiteWeatherAlertsInput = {
  supabase?: SupabaseClient | null;
  nwsClient?: NwsClient;
  fetcher?: typeof fetch;
  maxJobsites?: number;
  jobsiteIds?: string[];
  requireFeatureFlag?: boolean;
  sendNotifications?: boolean;
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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeRole(value: unknown) {
  return normalizeKey(value).replace(/\s+/g, "_");
}

function isActiveStatus(value: unknown) {
  const status = normalizeKey(value);
  return !status || status === "active" || status === "approved";
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

async function getAuthUserContactById(supabase: SupabaseClient, userId: string) {
  const result = await supabase.auth.admin.getUserById(userId);
  const user = result.data.user;
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const metadataName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;
  return {
    email: user?.email ?? null,
    name: clean(metadataName) || null,
  };
}

async function loadUserContactMap(supabase: SupabaseClient, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const profilesByUserId = new Map<string, WeatherProfileRow>();
  if (uniqueIds.length > 0) {
    const profilesResult = await supabase
      .from("user_profiles")
      .select("user_id, full_name, preferred_name, phone")
      .in("user_id", uniqueIds);
    if (!profilesResult.error) {
      for (const profile of (profilesResult.data ?? []) as WeatherProfileRow[]) {
        profilesByUserId.set(profile.user_id, profile);
      }
    }
  }

  const entries = await Promise.all(
    uniqueIds.map(async (userId) => {
      const authContact = await getAuthUserContactById(supabase, userId).catch(() => ({ email: null, name: null }));
      const profile = profilesByUserId.get(userId);
      const contact: WeatherUserContact = {
        userId,
        email: authContact.email,
        phone: profile?.phone ?? null,
        name: clean(profile?.preferred_name) || clean(profile?.full_name) || authContact.name,
      };
      return [userId, contact] as const;
    })
  );
  return new Map(entries);
}

function contactMatchesLabel(contact: WeatherUserContact | null | undefined, label: string | null) {
  const wanted = normalizeKey(label);
  if (!wanted || !contact) return false;
  return [contact.name, contact.email].some((value) => normalizeKey(value) === wanted);
}

function syntheticWeatherSubscription(jobsite: JobsiteWeatherRow, userId: string): WeatherSubscriptionRow {
  return {
    id: `auto-weather-${jobsite.id}-${userId}`,
    company_id: jobsite.company_id,
    jobsite_id: jobsite.id,
    user_id: userId,
    enabled: true,
    channels: ["email", "sms"],
    min_severity: null,
    event_allowlist: null,
    quiet_hours_start: null,
    quiet_hours_end: null,
  };
}

async function loadPmAndSiteLeadSubscriptions(params: {
  supabase: SupabaseClient;
  jobsites: JobsiteWeatherRow[];
}) {
  const jobsiteIds = [...new Set(params.jobsites.map((jobsite) => jobsite.id).filter(Boolean))];
  const companyIds = [...new Set(params.jobsites.map((jobsite) => jobsite.company_id).filter(Boolean))];
  const subscriptionsByJobsite = new Map<string, WeatherSubscriptionRow[]>();
  if (jobsiteIds.length === 0 || companyIds.length === 0) return subscriptionsByJobsite;

  const [assignmentResult, roleResult] = await Promise.all([
    params.supabase
      .from("company_jobsite_assignments")
      .select("company_id, jobsite_id, user_id, role")
      .in("jobsite_id", jobsiteIds),
    params.supabase
      .from("user_roles")
      .select("company_id, user_id, role, account_status")
      .in("company_id", companyIds),
  ]);

  if (assignmentResult.error || roleResult.error) {
    throw new Error(
      assignmentResult.error?.message ||
        roleResult.error?.message ||
        "Failed to load PM and Site Lead weather recipients."
    );
  }

  const assignments = ((assignmentResult.data ?? []) as WeatherAssignmentRow[]).filter((row) => clean(row.user_id));
  const roles = ((roleResult.data ?? []) as WeatherRoleRow[]).filter((row) => clean(row.user_id));
  const contactsByUserId = await loadUserContactMap(params.supabase, roles.map((row) => row.user_id));
  const activeProjectManagers = new Set(
    roles
      .filter((row) => normalizeRole(row.role) === "project_manager" && isActiveStatus(row.account_status))
      .map((row) => row.user_id)
  );
  const activeUsersByCompany = new Map<string, string[]>();
  for (const row of roles) {
    if (!isActiveStatus(row.account_status)) continue;
    const rows = activeUsersByCompany.get(row.company_id) ?? [];
    rows.push(row.user_id);
    activeUsersByCompany.set(row.company_id, rows);
  }

  for (const jobsite of params.jobsites) {
    const recipientIds = new Set<string>();
    for (const assignment of assignments) {
      if (
        assignment.jobsite_id === jobsite.id &&
        assignment.company_id === jobsite.company_id &&
        normalizeRole(assignment.role) === "project_manager" &&
        activeProjectManagers.has(assignment.user_id)
      ) {
        recipientIds.add(assignment.user_id);
      }
    }

    const siteLeadLabel = clean(jobsite.safety_lead);
    if (siteLeadLabel) {
      for (const userId of activeUsersByCompany.get(jobsite.company_id) ?? []) {
        if (contactMatchesLabel(contactsByUserId.get(userId), siteLeadLabel)) {
          recipientIds.add(userId);
        }
      }
    }

    if (recipientIds.size > 0) {
      subscriptionsByJobsite.set(
        jobsite.id,
        [...recipientIds].map((userId) => syntheticWeatherSubscription(jobsite, userId))
      );
    }
  }

  return subscriptionsByJobsite;
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

export async function checkJobsiteWeatherAlerts(input: CheckJobsiteWeatherAlertsInput = {}): Promise<JobsiteWeatherCronResult> {
  if (input.requireFeatureFlag !== false && !isJobsiteWeatherNotificationsEnabled()) {
    return emptyResult({ skipped: true });
  }

  const supabase = input.supabase ?? createSupabaseAdminClient();
  if (!supabase) {
    return emptyResult({ ok: false, error: "Missing Supabase service role configuration." });
  }

  const maxJobsites = input.maxJobsites ?? readPositiveInt("WEATHER_CRON_MAX_JOBSITES", 500, 5000);
  const nwsClient = input.nwsClient ?? new NwsClient({ fetcher: input.fetcher });
  const targetJobsiteIds = [...new Set((input.jobsiteIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const sendNotifications = input.sendNotifications !== false;
  const result = emptyResult();

  if (input.jobsiteIds && targetJobsiteIds.length === 0) {
    return result;
  }

  let jobsitesQuery = supabase
    .from("company_jobsites")
    .select("id, company_id, name, zip_code, project_manager, safety_lead, weather_latitude, weather_longitude")
    .eq("weather_enabled", true)
    .neq("status", "archived")
    .limit(maxJobsites);
  if (targetJobsiteIds.length > 0) {
    jobsitesQuery = jobsitesQuery.in("id", targetJobsiteIds);
  }

  const jobsitesResult = await jobsitesQuery;

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

  const weatherJobsiteIds = jobsites.map((jobsite) => jobsite.id);
  const subscriptionsByJobsite = new Map<string, WeatherSubscriptionRow[]>();
  if (sendNotifications && weatherJobsiteIds.length > 0) {
    let subscriptionsResult: { data?: unknown[] | null; error?: { message?: string | null } | null };
    let implicitSubscriptions: Map<string, WeatherSubscriptionRow[]>;
    try {
      [subscriptionsResult, implicitSubscriptions] = await Promise.all([
        supabase
          .from("jobsite_weather_subscriptions")
          .select("id, company_id, jobsite_id, user_id, enabled, channels, min_severity, event_allowlist, quiet_hours_start, quiet_hours_end")
          .in("jobsite_id", weatherJobsiteIds)
          .eq("enabled", true),
        loadPmAndSiteLeadSubscriptions({ supabase, jobsites }),
      ]);
    } catch (error) {
      return emptyResult({
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load weather notification recipients.",
      });
    }

    if (subscriptionsResult.error) {
      return emptyResult({ ok: false, error: subscriptionsResult.error.message || "Failed to load subscriptions." });
    }

    for (const subscription of ((subscriptionsResult.data ?? []) as WeatherSubscriptionRow[])) {
      const rows = subscriptionsByJobsite.get(subscription.jobsite_id) ?? [];
      rows.push(subscription);
      subscriptionsByJobsite.set(subscription.jobsite_id, rows);
    }
    for (const [jobsiteId, subscriptions] of implicitSubscriptions.entries()) {
      const rows = subscriptionsByJobsite.get(jobsiteId) ?? [];
      rows.push(...subscriptions);
      subscriptionsByJobsite.set(jobsiteId, rows);
    }
  }

  const userContactMap = sendNotifications
    ? await loadUserContactMap(
        supabase,
        [...subscriptionsByJobsite.values()].flat().map((subscription) => subscription.user_id)
      )
    : new Map<string, WeatherUserContact>();

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

      const relevantAlerts: Array<{ alert: WeatherAlert; alertEventId: string }> = [];
      for (const alert of alerts) {
        if (!isWeatherAlertRelevant({ alert, minSeverity: globalMinSeverity })) continue;

        try {
          const alertEventId = await upsertWeatherAlertEvent({ supabase, jobsite, alert });
          relevantAlerts.push({ alert, alertEventId });
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
      }

      const subscriptions = subscriptionsByJobsite.get(jobsite.id) ?? [];
      if (!sendNotifications || subscriptions.length === 0) continue;

      for (const { alert, alertEventId } of relevantAlerts) {
        const attemptedRecipientChannels = new Set<string>();
        for (const subscription of subscriptions) {
          if (isWithinQuietHours(subscription)) {
            result.deliveriesSkipped += 1;
            continue;
          }
          if (!isWeatherAlertRelevant({ alert, minSeverity: subscription.min_severity, eventAllowlist: subscription.event_allowlist })) {
            continue;
          }

          for (const channel of normalizeChannels(subscription.channels)) {
            const recipientChannelKey = `${subscription.user_id}:${channel}`;
            if (attemptedRecipientChannels.has(recipientChannelKey)) {
              result.deliveriesSkipped += 1;
              continue;
            }
            attemptedRecipientChannels.add(recipientChannelKey);
            const contact = userContactMap.get(subscription.user_id);
            const delivery = await deliverWeatherNotification({
              supabase,
              recipient: {
                userId: subscription.user_id,
                email: contact?.email ?? null,
                phone: contact?.phone ?? null,
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
            else if (delivery.skipped) result.deliveriesSkipped += 1;
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
