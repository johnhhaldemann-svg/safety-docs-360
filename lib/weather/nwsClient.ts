import { serverLog } from "@/lib/serverLog";
import type { WeatherAlert } from "@/lib/weather/alertFiltering";

export type NwsPointMetadata = {
  gridId: string | null;
  gridX: number | null;
  gridY: number | null;
  forecastUrl: string | null;
  forecastHourlyUrl: string | null;
  relativeLocation: string | null;
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
    "SafetyDocs360/1.0 support@safety360docs.com"
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
