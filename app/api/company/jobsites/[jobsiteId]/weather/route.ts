import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { isAdminRole, normalizeAppRole, authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeZipCode, resolveWeatherLocationWithNwsPoint, type WeatherLocationInput } from "@/lib/weather/locationResolver";
import { NwsClient, type NwsForecastDay } from "@/lib/weather/nwsClient";
import { checkJobsiteWeatherAlerts } from "@/lib/weather/checkJobsiteWeatherAlerts";
import { normalizeWeatherEventAllowlist, normalizeWeatherSeverityThreshold } from "@/lib/weather/alertFiltering";

export const runtime = "nodejs";

type Params = { jobsiteId: string };

type WeatherSubscriptionPayload = {
  userId?: string | null;
  enabled?: boolean;
  channels?: unknown;
  minSeverity?: string | null;
  eventAllowlist?: unknown;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

type WeatherSettingsPayload = {
  weatherEnabled?: boolean;
  zipCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  manualLatitude?: number | string | null;
  manualLongitude?: number | string | null;
  subscriptions?: WeatherSubscriptionPayload[];
};

const WEATHER_JOBSITE_SELECT = [
  "id",
  "company_id",
  "name",
  "zip_code",
  "weather_address_line_1",
  "weather_address_line_2",
  "weather_city",
  "weather_state",
  "weather_country",
  "weather_latitude",
  "weather_longitude",
  "weather_location_source",
  "weather_location_confidence",
  "nws_grid_id",
  "nws_grid_x",
  "nws_grid_y",
  "nws_forecast_url",
  "nws_forecast_hourly_url",
  "weather_enabled",
  "weather_last_checked_at",
].join(", ");

function isWeatherManagerRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  );
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeChannels(value: unknown) {
  if (!Array.isArray(value)) return ["in_app"];
  const allowed = new Set(["in_app", "email", "sms", "push"]);
  const channels = value
    .map((item) => String(item ?? "").trim())
    .filter((item) => allowed.has(item));
  return channels.length > 0 ? [...new Set(channels)] : ["in_app"];
}

function normalizeQuietHour(value: unknown) {
  const raw = cleanString(value);
  return /^\d{2}:\d{2}$/.test(raw) ? raw : null;
}

function hasWeatherCoordinate(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function weatherCoordinateInput(value: unknown) {
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function numericWeatherCoordinate(value: unknown) {
  if (!hasWeatherCoordinate(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicNwsForecastUrl(jobsite: Record<string, unknown>) {
  const latitude = numericWeatherCoordinate(jobsite.weather_latitude);
  const longitude = numericWeatherCoordinate(jobsite.weather_longitude);
  if (latitude === null || longitude === null) return null;
  const url = new URL("https://forecast.weather.gov/MapClick.php");
  url.searchParams.set("lat", latitude.toFixed(4));
  url.searchParams.set("lon", longitude.toFixed(4));
  return url.toString();
}

function addressFromJobsite(jobsite: Record<string, unknown>): WeatherLocationInput {
  return {
    zipCode: normalizeZipCode(String(jobsite.zip_code ?? "")),
    addressLine1: cleanString(jobsite.weather_address_line_1) || null,
    addressLine2: cleanString(jobsite.weather_address_line_2) || null,
    city: cleanString(jobsite.weather_city) || null,
    state: cleanString(jobsite.weather_state).toUpperCase() || null,
    country: cleanString(jobsite.weather_country).toUpperCase() || "US",
    manualLatitude: weatherCoordinateInput(jobsite.weather_latitude),
    manualLongitude: weatherCoordinateInput(jobsite.weather_longitude),
  };
}

async function resolveScopedJobsite(request: Request, params: Promise<Params>) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_jobsites",
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return { authError: auth.error } as const;

  const { jobsiteId } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) {
    return { authError: NextResponse.json({ error: "No company scope found for user." }, { status: 400 }) } as const;
  }

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select(WEATHER_JOBSITE_SELECT)
    .eq("id", jobsiteId)
    .eq("company_id", scope.companyId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return {
      authError: NextResponse.json(
        { error: jobsiteResult.error.message || "Failed to load jobsite weather settings." },
        { status: 500 }
      ),
    } as const;
  }
  if (!jobsiteResult.data) {
    return { authError: NextResponse.json({ error: "Jobsite not found." }, { status: 404 }) } as const;
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: scope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return { authError: NextResponse.json({ error: "Jobsite not found." }, { status: 404 }) } as const;
  }

  return { auth, scope, jobsiteId, jobsite: jobsiteResult.data as unknown as Record<string, unknown> } as const;
}

async function loadWeatherOverviewPayload(
  supabase: SupabaseClient,
  jobsiteId: string,
  jobsite: Record<string, unknown>,
  nwsClient = new NwsClient()
) {
  const [subscriptions, alerts, deliveries, forecast] = await Promise.all([
    supabase
      .from("jobsite_weather_subscriptions")
      .select("id, jobsite_id, user_id, enabled, channels, min_severity, event_allowlist, quiet_hours_start, quiet_hours_end, created_at, updated_at")
      .eq("jobsite_id", jobsiteId)
      .order("created_at", { ascending: true }),
    supabase
      .from("weather_alert_events")
      .select("id, nws_alert_id, event_name, severity, urgency, certainty, headline, description, instruction, effective_at, expires_at, status, first_seen_at, last_seen_at")
      .eq("jobsite_id", jobsiteId)
      .order("last_seen_at", { ascending: false })
      .limit(12),
    supabase
      .from("weather_notification_deliveries")
      .select("id, weather_alert_event_id, user_id, channel, status, sent_at, error_message, created_at")
      .eq("jobsite_id", jobsiteId)
      .order("created_at", { ascending: false })
      .limit(20),
    loadForecastForJobsite(jobsite, nwsClient),
  ]);

  if (subscriptions.error || alerts.error || deliveries.error) {
    return {
      error:
        subscriptions.error?.message ||
        alerts.error?.message ||
        deliveries.error?.message ||
        "Failed to load jobsite weather settings.",
    } as const;
  }

  return {
    payload: {
      jobsite,
      forecast,
      subscriptions: subscriptions.data ?? [],
      alerts: alerts.data ?? [],
      deliveries: deliveries.data ?? [],
    },
  } as const;
}

async function loadForecastForJobsite(
  jobsite: Record<string, unknown>,
  nwsClient: NwsClient
): Promise<{ days: NwsForecastDay[]; sourceUrl: string | null; publicUrl: string | null; error: string | null }> {
  const savedForecastUrl = cleanString(jobsite.nws_forecast_url);
  let forecastUrl = savedForecastUrl || null;
  const publicUrl = publicNwsForecastUrl(jobsite);

  if (!forecastUrl) {
    const latitude = numericWeatherCoordinate(jobsite.weather_latitude);
    const longitude = numericWeatherCoordinate(jobsite.weather_longitude);
    if (latitude !== null && longitude !== null) {
      try {
        const point = await nwsClient.getPointMetadata(latitude, longitude);
        forecastUrl = point.forecastUrl;
      } catch {
        return { days: [], sourceUrl: null, publicUrl, error: "Forecast location could not be resolved with NWS." };
      }
    }
  }

  if (!forecastUrl) {
    return { days: [], sourceUrl: null, publicUrl, error: null };
  }

  try {
    return {
      days: await nwsClient.getForecast(forecastUrl, 5),
      sourceUrl: forecastUrl,
      publicUrl,
      error: null,
    };
  } catch {
    return { days: [], sourceUrl: forecastUrl, publicUrl, error: "NWS forecast is temporarily unavailable." };
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const resolved = await resolveScopedJobsite(request, params);
  if ("authError" in resolved) return resolved.authError;

  const overview = await loadWeatherOverviewPayload(resolved.auth.supabase, resolved.jobsiteId, resolved.jobsite);
  if ("error" in overview) return NextResponse.json({ error: overview.error }, { status: 500 });

  return NextResponse.json(overview.payload);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const resolved = await resolveScopedJobsite(request, params);
  if ("authError" in resolved) return resolved.authError;

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration for manual weather refresh." },
      { status: 500 }
    );
  }

  let jobsite = resolved.jobsite;
  if (!jobsite.weather_enabled) {
    if (!isWeatherManagerRole(resolved.auth.role)) {
      return NextResponse.json(
        { error: "Only company weather managers can turn on weather monitoring before refreshing." },
        { status: 403 }
      );
    }

    const updateValues: Record<string, unknown> = { weather_enabled: true };
    if (!hasWeatherCoordinate(jobsite.weather_latitude) || !hasWeatherCoordinate(jobsite.weather_longitude) || !jobsite.nws_grid_id) {
      const resolvedLocation = await resolveWeatherLocationWithNwsPoint(addressFromJobsite(jobsite), new NwsClient()).catch(() => null);
      if (!resolvedLocation) {
        return NextResponse.json(
          { error: "Could not resolve this jobsite weather location. Add a valid ZIP, full address, or manual coordinates before refreshing." },
          { status: 400 }
        );
      }
      updateValues.weather_latitude = resolvedLocation.latitude;
      updateValues.weather_longitude = resolvedLocation.longitude;
      updateValues.weather_location_source = resolvedLocation.source;
      updateValues.weather_location_confidence = resolvedLocation.confidence;
      updateValues.nws_grid_id = resolvedLocation.nwsPoint.gridId;
      updateValues.nws_grid_x = resolvedLocation.nwsPoint.gridX;
      updateValues.nws_grid_y = resolvedLocation.nwsPoint.gridY;
      updateValues.nws_forecast_url = resolvedLocation.nwsPoint.forecastUrl;
      updateValues.nws_forecast_hourly_url = resolvedLocation.nwsPoint.forecastHourlyUrl;
    }

    const enabledJobsite = await adminClient
      .from("company_jobsites")
      .update(updateValues)
      .eq("id", resolved.jobsiteId)
      .eq("company_id", resolved.scope.companyId)
      .select(WEATHER_JOBSITE_SELECT)
      .single();
    if (enabledJobsite.error) {
      return NextResponse.json(
        { error: enabledJobsite.error.message || "Failed to turn on jobsite weather monitoring." },
        { status: 500 }
      );
    }
    jobsite = enabledJobsite.data as unknown as Record<string, unknown>;
  }

  if (!hasWeatherCoordinate(jobsite.weather_latitude) || !hasWeatherCoordinate(jobsite.weather_longitude)) {
    return NextResponse.json(
      { error: "The jobsite weather location has not been resolved yet. Save a ZIP, full address, or manual coordinates first." },
      { status: 400 }
    );
  }

  const result = await checkJobsiteWeatherAlerts({
    supabase: adminClient,
    jobsiteIds: [resolved.jobsiteId],
    maxJobsites: 1,
    requireFeatureFlag: false,
    sendNotifications: false,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Jobsite weather refresh failed.", result },
      { status: 500 }
    );
  }
  if (result.jobsitesSeen === 0) {
    return NextResponse.json(
      { error: "No enabled weather jobsite was available to refresh.", result },
      { status: 400 }
    );
  }
  if (result.locationsFailed > 0) {
    return NextResponse.json(
      { error: "NWS weather refresh failed for this jobsite location.", result },
      { status: 502 }
    );
  }

  const refreshedJobsite = await resolved.auth.supabase
    .from("company_jobsites")
    .select(WEATHER_JOBSITE_SELECT)
    .eq("id", resolved.jobsiteId)
    .eq("company_id", resolved.scope.companyId)
    .maybeSingle();
  if (refreshedJobsite.error) {
    return NextResponse.json(
      { error: refreshedJobsite.error.message || "Weather refreshed, but the jobsite summary could not be reloaded." },
      { status: 500 }
    );
  }

  const overview = await loadWeatherOverviewPayload(
    resolved.auth.supabase,
    resolved.jobsiteId,
    (refreshedJobsite.data ?? jobsite) as unknown as Record<string, unknown>
  );
  if ("error" in overview) return NextResponse.json({ error: overview.error }, { status: 500 });

  return NextResponse.json({
    ...overview.payload,
    refresh: result,
    message: "Jobsite weather refreshed.",
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const resolved = await resolveScopedJobsite(request, params);
  if ("authError" in resolved) return resolved.authError;

  const canManageWeather = isWeatherManagerRole(resolved.auth.role);
  const body = (await request.json().catch(() => null)) as WeatherSettingsPayload | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid weather settings payload." }, { status: 400 });
  }

  const updateValues: Record<string, unknown> = {};
  const weatherEnabled =
    typeof body.weatherEnabled === "boolean"
      ? body.weatherEnabled
      : Boolean(resolved.jobsite.weather_enabled);

  if (Object.prototype.hasOwnProperty.call(body, "weatherEnabled")) {
    if (!canManageWeather) {
      return NextResponse.json({ error: "Only company weather managers can change jobsite weather settings." }, { status: 403 });
    }
    updateValues.weather_enabled = weatherEnabled;
  }

  const addressTouched = [
    "zipCode",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "country",
    "manualLatitude",
    "manualLongitude",
  ].some((key) => Object.prototype.hasOwnProperty.call(body, key));

  if (addressTouched && !canManageWeather) {
    return NextResponse.json({ error: "Only company weather managers can change jobsite weather location." }, { status: 403 });
  }

  const nextZip = Object.prototype.hasOwnProperty.call(body, "zipCode")
    ? normalizeZipCode(body.zipCode)
    : normalizeZipCode(String(resolved.jobsite.zip_code ?? ""));
  if (Object.prototype.hasOwnProperty.call(body, "zipCode") && body.zipCode && !nextZip) {
    return NextResponse.json({ error: "Enter a valid 5-digit ZIP code or ZIP+4." }, { status: 400 });
  }

  const nextAddress = {
    zipCode: nextZip,
    addressLine1: Object.prototype.hasOwnProperty.call(body, "addressLine1")
      ? cleanString(body.addressLine1) || null
      : String(resolved.jobsite.weather_address_line_1 ?? "") || null,
    addressLine2: Object.prototype.hasOwnProperty.call(body, "addressLine2")
      ? cleanString(body.addressLine2) || null
      : String(resolved.jobsite.weather_address_line_2 ?? "") || null,
    city: Object.prototype.hasOwnProperty.call(body, "city")
      ? cleanString(body.city) || null
      : String(resolved.jobsite.weather_city ?? "") || null,
    state: Object.prototype.hasOwnProperty.call(body, "state")
      ? cleanString(body.state).toUpperCase() || null
      : String(resolved.jobsite.weather_state ?? "") || null,
    country: Object.prototype.hasOwnProperty.call(body, "country")
      ? cleanString(body.country).toUpperCase() || "US"
      : String(resolved.jobsite.weather_country ?? "US") || "US",
    manualLatitude: body.manualLatitude ?? null,
    manualLongitude: body.manualLongitude ?? null,
  };

  if (addressTouched) {
    updateValues.zip_code = nextZip;
    updateValues.weather_address_line_1 = nextAddress.addressLine1;
    updateValues.weather_address_line_2 = nextAddress.addressLine2;
    updateValues.weather_city = nextAddress.city;
    updateValues.weather_state = nextAddress.state;
    updateValues.weather_country = nextAddress.country;
  }

  if (weatherEnabled && (addressTouched || !resolved.jobsite.weather_latitude || !resolved.jobsite.nws_grid_id)) {
    const resolvedLocation = await resolveWeatherLocationWithNwsPoint(nextAddress, new NwsClient()).catch(() => null);
    if (!resolvedLocation) {
      return NextResponse.json(
        { error: "Could not resolve that jobsite weather location. Add a full address, valid ZIP, or manual coordinates." },
        { status: 400 }
      );
    }
    updateValues.weather_latitude = resolvedLocation.latitude;
    updateValues.weather_longitude = resolvedLocation.longitude;
    updateValues.weather_location_source = resolvedLocation.source;
    updateValues.weather_location_confidence = resolvedLocation.confidence;
    updateValues.nws_grid_id = resolvedLocation.nwsPoint.gridId;
    updateValues.nws_grid_x = resolvedLocation.nwsPoint.gridX;
    updateValues.nws_grid_y = resolvedLocation.nwsPoint.gridY;
    updateValues.nws_forecast_url = resolvedLocation.nwsPoint.forecastUrl;
    updateValues.nws_forecast_hourly_url = resolvedLocation.nwsPoint.forecastHourlyUrl;
  }

  let jobsite = resolved.jobsite;
  if (Object.keys(updateValues).length > 0) {
    const updateResult = await resolved.auth.supabase
      .from("company_jobsites")
      .update(updateValues)
      .eq("id", resolved.jobsiteId)
      .eq("company_id", resolved.scope.companyId)
      .select(WEATHER_JOBSITE_SELECT)
      .single();
    if (updateResult.error) {
      return NextResponse.json(
        { error: updateResult.error.message || "Failed to save jobsite weather settings." },
        { status: 500 }
      );
    }
    jobsite = updateResult.data as unknown as Record<string, unknown>;
  }

  if (Array.isArray(body.subscriptions)) {
    for (const subscription of body.subscriptions) {
      const userId = cleanString(subscription.userId);
      const targetUserId = userId || resolved.auth.user.id;
      if (!canManageWeather && targetUserId !== resolved.auth.user.id) {
        return NextResponse.json({ error: "You can only update your own weather subscription." }, { status: 403 });
      }

      const upsertResult = await resolved.auth.supabase
        .from("jobsite_weather_subscriptions")
        .upsert(
          {
            company_id: resolved.scope.companyId,
            jobsite_id: resolved.jobsiteId,
            user_id: targetUserId,
            enabled: subscription.enabled !== false,
            channels: normalizeChannels(subscription.channels),
            min_severity: normalizeWeatherSeverityThreshold(subscription.minSeverity),
            event_allowlist: normalizeWeatherEventAllowlist(subscription.eventAllowlist),
            quiet_hours_start: normalizeQuietHour(subscription.quietHoursStart),
            quiet_hours_end: normalizeQuietHour(subscription.quietHoursEnd),
          },
          { onConflict: "jobsite_id,user_id" }
        );

      if (upsertResult.error) {
        return NextResponse.json(
          { error: upsertResult.error.message || "Failed to save weather subscription." },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    jobsite,
    message: "Weather settings saved.",
  });
}
