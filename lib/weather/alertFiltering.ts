export type WeatherSeverityThreshold = "advisory" | "watch" | "warning";

export type WeatherAlert = {
  id: string;
  eventName: string;
  severity: string | null;
  urgency: string | null;
  certainty: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  status: string | null;
  rawPayload: unknown;
};

export const DEFAULT_WEATHER_ALERT_EVENTS = [
  "Tornado Warning",
  "Tornado Watch",
  "Severe Thunderstorm Warning",
  "Severe Thunderstorm Watch",
  "Flash Flood Warning",
  "Flood Warning",
  "Winter Storm Warning",
  "High Wind Warning",
  "Excessive Heat Warning",
  "Heat Advisory",
] as const;

export const OPTIONAL_WEATHER_ALERT_EVENTS = ["Special Weather Statement"] as const;

const SEVERITY_RANK: Record<WeatherSeverityThreshold, number> = {
  advisory: 1,
  watch: 2,
  warning: 3,
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeWeatherSeverityThreshold(value?: string | null): WeatherSeverityThreshold {
  const normalized = normalizeText(value ?? "");
  if (normalized === "warning") return "warning";
  if (normalized === "watch") return "watch";
  return "advisory";
}

export function classifyWeatherAlertSeverity(eventName?: string | null): WeatherSeverityThreshold {
  const normalized = normalizeText(eventName ?? "");
  if (normalized.endsWith("warning")) return "warning";
  if (normalized.endsWith("watch")) return "watch";
  return "advisory";
}

export function weatherAlertMeetsSeverity(
  eventName: string,
  minSeverity?: string | null
) {
  const threshold = normalizeWeatherSeverityThreshold(minSeverity);
  const severity = classifyWeatherAlertSeverity(eventName);
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[threshold];
}

export function normalizeWeatherEventAllowlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const eventName = String(item ?? "").trim().replace(/\s+/g, " ");
    if (!eventName || seen.has(normalizeText(eventName))) continue;
    seen.add(normalizeText(eventName));
    out.push(eventName);
  }
  return out;
}

export function isDefaultWeatherAlertEvent(eventName: string) {
  const normalized = normalizeText(eventName);
  return DEFAULT_WEATHER_ALERT_EVENTS.some((allowed) => normalizeText(allowed) === normalized);
}

export function isOptionalWeatherAlertEvent(eventName: string) {
  const normalized = normalizeText(eventName);
  return OPTIONAL_WEATHER_ALERT_EVENTS.some((allowed) => normalizeText(allowed) === normalized);
}

export function isWeatherAlertRelevant(params: {
  alert: Pick<WeatherAlert, "eventName">;
  minSeverity?: string | null;
  eventAllowlist?: unknown;
}) {
  const eventName = params.alert.eventName.trim();
  if (!eventName) return false;

  const allowlist = normalizeWeatherEventAllowlist(params.eventAllowlist);
  const allowlistSet = new Set(allowlist.map(normalizeText));
  const eventAllowed =
    allowlistSet.size > 0
      ? allowlistSet.has(normalizeText(eventName))
      : isDefaultWeatherAlertEvent(eventName);

  return eventAllowed && weatherAlertMeetsSeverity(eventName, params.minSeverity);
}

export function getDefaultWeatherAlertMinSeverity() {
  return normalizeWeatherSeverityThreshold(process.env.WEATHER_ALERT_MIN_SEVERITY ?? "watch");
}
