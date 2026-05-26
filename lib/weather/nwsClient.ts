import { serverLog } from "@/lib/serverLog";
import type { WeatherAlert } from "@/lib/weather/alertFiltering";
import { defaultNwsUserAgent } from "@/lib/appBrand";

export type NwsPointMetadata = {
  gridId: string | null;
  gridX: number | null;
  gridY: number | null;
  forecastUrl: string | null;
  forecastHourlyUrl: string | null;
  relativeLocation: string | null;
};

export type NwsForecastDay = {
  date: string;
  name: string;
  highTemperature: number | null;
  lowTemperature: number | null;
  temperatureUnit: string | null;
  precipitationChance: number | null;
  precipitationTypes: string[];
  shortForecast: string | null;
  detailedForecast: string | null;
  windSpeed: string | null;
  windDirection: string | null;
};

export type NwsClientOptions = {
  fetcher?: typeof fetch;
  userAgent?: string | null;
  timeoutMs?: number;
  retries?: number;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function getNwsUserAgent(explicit?: string | null) {
  return (
    explicit?.trim() ||
    readEnv("NWS_USER_AGENT") ||
    defaultNwsUserAgent()
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnlyFromNwsTime(value: unknown) {
  const text = asString(value);
  if (!text) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1] ?? null;
}

function probabilityValue(value: unknown) {
  const record = asRecord(value);
  if (!record || record.value === null || record.value === undefined || record.value === "") return null;
  const parsed = asNumber(record?.value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function detectNwsForecastPrecipitationTypes(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  const types: string[] = [];
  if (/\b(thunderstorms?|thunder|t-?storms?|lightning)\b/.test(text)) types.push("storm");
  if (/\b(freezing rain|ice|icy|glaze)\b/.test(text)) types.push("ice");
  if (/\b(sleet|wintry mix)\b/.test(text)) types.push("sleet");
  if (/\b(snow|flurries|blizzard)\b/.test(text)) types.push("snow");
  if (/\b(rain|showers|drizzle)\b/.test(text)) types.push("rain");
  if (/\b(hail)\b/.test(text)) types.push("hail");
  return [...new Set(types)];
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class NwsClient {
  private readonly fetcher: typeof fetch;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(options: NwsClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.userAgent = getNwsUserAgent(options.userAgent);
    this.timeoutMs = options.timeoutMs ?? 12000;
    this.retries = Math.max(0, options.retries ?? 2);
  }

  async getPointMetadata(latitude: number, longitude: number): Promise<NwsPointMetadata> {
    const json = await this.fetchJson(
      `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`
    );
    const properties = asRecord(asRecord(json)?.properties) ?? {};
    const relative = asRecord(properties.relativeLocation);
    const relativeProps = asRecord(relative?.properties);
    const city = asString(relativeProps?.city);
    const state = asString(relativeProps?.state);
    return {
      gridId: asString(properties.gridId),
      gridX: asNumber(properties.gridX),
      gridY: asNumber(properties.gridY),
      forecastUrl: asString(properties.forecast),
      forecastHourlyUrl: asString(properties.forecastHourly),
      relativeLocation: [city, state].filter(Boolean).join(", ") || null,
    };
  }

  async getActiveAlerts(latitude: number, longitude: number): Promise<WeatherAlert[]> {
    const url = new URL("https://api.weather.gov/alerts/active");
    url.searchParams.set("point", `${latitude.toFixed(4)},${longitude.toFixed(4)}`);
    const json = await this.fetchJson(url.toString());
    const features = Array.isArray(asRecord(json)?.features) ? (asRecord(json)?.features as unknown[]) : [];
    return features.map(parseNwsAlertFeature).filter((alert): alert is WeatherAlert => Boolean(alert));
  }

  async getForecast(forecastUrl: string, days = 5): Promise<NwsForecastDay[]> {
    const json = await this.fetchJson(forecastUrl);
    return parseNwsForecast(json, days);
  }

  private async fetchJson(url: string): Promise<unknown> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, {
          headers: {
            Accept: "application/geo+json, application/json",
            "User-Agent": this.userAgent,
          },
          signal: controller.signal,
        });
        if (response.ok) return await response.json();
        const retryable = response.status === 429 || response.status >= 500;
        const body = await response.text().catch(() => "");
        lastError = new Error(`NWS request failed (${response.status}): ${body.slice(0, 160)}`);
        if (!retryable || attempt >= this.retries) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("NWS request failed.");
        if (attempt >= this.retries) break;
      } finally {
        clearTimeout(timeoutId);
      }
      await sleep(250 * 2 ** attempt);
    }

    serverLog("warn", "nws_request_failed", {
      url,
      message: lastError?.message.slice(0, 180) ?? "unknown",
    });
    throw lastError ?? new Error("NWS request failed.");
  }
}

type ForecastPeriod = {
  date: string;
  name: string | null;
  isDaytime: boolean;
  temperature: number | null;
  temperatureUnit: string | null;
  precipitationChance: number | null;
  shortForecast: string | null;
  detailedForecast: string | null;
  windSpeed: string | null;
  windDirection: string | null;
};

function parseForecastPeriod(period: unknown): ForecastPeriod | null {
  const record = asRecord(period);
  if (!record) return null;
  const date = dateOnlyFromNwsTime(record.startTime);
  if (!date) return null;
  return {
    date,
    name: asString(record.name),
    isDaytime: Boolean(record.isDaytime),
    temperature: asNumber(record.temperature),
    temperatureUnit: asString(record.temperatureUnit),
    precipitationChance: probabilityValue(record.probabilityOfPrecipitation),
    shortForecast: asString(record.shortForecast),
    detailedForecast: asString(record.detailedForecast),
    windSpeed: asString(record.windSpeed),
    windDirection: asString(record.windDirection),
  };
}

function betterForecastText(current: string | null, candidate: string | null) {
  if (!current) return candidate;
  if (!candidate) return current;
  return candidate.length > current.length ? candidate : current;
}

export function parseNwsForecast(payload: unknown, days = 5): NwsForecastDay[] {
  const properties = asRecord(asRecord(payload)?.properties) ?? {};
  const periods = Array.isArray(properties.periods) ? properties.periods.map(parseForecastPeriod).filter(Boolean) as ForecastPeriod[] : [];
  const grouped = new Map<string, ForecastPeriod[]>();

  for (const period of periods) {
    const rows = grouped.get(period.date) ?? [];
    rows.push(period);
    grouped.set(period.date, rows);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, Math.max(1, days))
    .map(([date, rows]) => {
      const daytime = rows.find((row) => row.isDaytime) ?? rows[0];
      const temperatures = rows.map((row) => row.temperature).filter((value): value is number => value !== null);
      const daytimeTemperatures = rows
        .filter((row) => row.isDaytime)
        .map((row) => row.temperature)
        .filter((value): value is number => value !== null);
      const nighttimeTemperatures = rows
        .filter((row) => !row.isDaytime)
        .map((row) => row.temperature)
        .filter((value): value is number => value !== null);
      const precipitationChances = rows
        .map((row) => row.precipitationChance)
        .filter((value): value is number => value !== null);
      const shortForecast = daytime?.shortForecast ?? rows.find((row) => row.shortForecast)?.shortForecast ?? null;
      const detailedForecast = rows.reduce<string | null>(
        (current, row) => betterForecastText(current, row.detailedForecast),
        null
      );

      return {
        date,
        name: daytime?.name ?? rows[0]?.name ?? date,
        highTemperature:
          daytimeTemperatures.length > 0
            ? Math.max(...daytimeTemperatures)
            : temperatures.length > 0
              ? Math.max(...temperatures)
              : null,
        lowTemperature:
          nighttimeTemperatures.length > 0
            ? Math.min(...nighttimeTemperatures)
            : temperatures.length > 0
              ? Math.min(...temperatures)
              : null,
        temperatureUnit: rows.find((row) => row.temperatureUnit)?.temperatureUnit ?? null,
        precipitationChance: precipitationChances.length > 0 ? Math.max(...precipitationChances) : null,
        precipitationTypes: detectNwsForecastPrecipitationTypes(
          ...rows.flatMap((row) => [row.shortForecast, row.detailedForecast])
        ),
        shortForecast,
        detailedForecast,
        windSpeed: daytime?.windSpeed ?? rows.find((row) => row.windSpeed)?.windSpeed ?? null,
        windDirection: daytime?.windDirection ?? rows.find((row) => row.windDirection)?.windDirection ?? null,
      };
    });
}

export function parseNwsAlertFeature(feature: unknown): WeatherAlert | null {
  const record = asRecord(feature);
  const properties = asRecord(record?.properties);
  if (!properties) return null;

  const id =
    asString(properties.id) ??
    asString(record?.id) ??
    asString(properties["@id"]) ??
    asString(properties.uri);
  const eventName = asString(properties.event);
  if (!id || !eventName) return null;

  return {
    id,
    eventName,
    severity: asString(properties.severity),
    urgency: asString(properties.urgency),
    certainty: asString(properties.certainty),
    headline: asString(properties.headline),
    description: asString(properties.description),
    instruction: asString(properties.instruction),
    effectiveAt: asString(properties.effective),
    expiresAt: asString(properties.expires),
    status: asString(properties.status),
    rawPayload: feature,
  };
}
