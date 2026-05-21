import type { NwsClient, NwsPointMetadata } from "@/lib/weather/nwsClient";

export type WeatherLocationSource = "address" | "zip_centroid" | "manual";
export type WeatherLocationConfidence = "high" | "medium" | "low";

export type WeatherLocationResult = {
  latitude: number;
  longitude: number;
  source: WeatherLocationSource;
  confidence: WeatherLocationConfidence;
  label: string | null;
};

export type WeatherLocationInput = {
  zipCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  manualLatitude?: number | string | null;
  manualLongitude?: number | string | null;
};

export type WeatherLocationResolverOptions = {
  fetcher?: typeof fetch;
  geocodioApiKey?: string | null;
  timeoutMs?: number;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
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

function joinAddress(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

async function fetchJsonWithTimeout(
  fetcher: typeof fetch,
  url: string,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Geocoding request failed (${response.status}): ${body.slice(0, 160)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeZipCode(value?: string | null) {
  const raw = (value ?? "").trim();
  const match = raw.match(/^(\d{5})(?:-?(\d{4}))?$/);
  if (!match) return null;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

function baseZipCode(value: string) {
  return value.slice(0, 5);
}

export function buildWeatherAddress(input: WeatherLocationInput) {
  return joinAddress([
    input.addressLine1,
    input.addressLine2,
    input.city,
    input.state,
    normalizeZipCode(input.zipCode),
    input.country?.trim() || "US",
  ]);
}

export async function resolveWeatherLocation(
  input: WeatherLocationInput,
  options: WeatherLocationResolverOptions = {}
): Promise<WeatherLocationResult | null> {
  const manualLatitude = asNumber(input.manualLatitude);
  const manualLongitude = asNumber(input.manualLongitude);
  if (
    manualLatitude !== null &&
    manualLongitude !== null &&
    manualLatitude >= -90 &&
    manualLatitude <= 90 &&
    manualLongitude >= -180 &&
    manualLongitude <= 180
  ) {
    return {
      latitude: manualLatitude,
      longitude: manualLongitude,
      source: "manual",
      confidence: "high",
      label: "Manual coordinates",
    };
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12000;
  const zip = normalizeZipCode(input.zipCode);
  if (zip) {
    const geocodioLocation = await geocodeZipWithGeocodio(zip, {
      fetcher,
      timeoutMs,
      geocodioApiKey: options.geocodioApiKey ?? readEnv("GEOCODIO_API_KEY"),
    }).catch(() => null);
    if (geocodioLocation) return geocodioLocation;

    const publicZipLocation = await geocodeZipWithZippopotam(zip, {
      fetcher,
      timeoutMs,
    }).catch(() => null);
    if (publicZipLocation) return publicZipLocation;

    return null;
  }

  const address = buildWeatherAddress(input);
  const hasStreetAddress = Boolean(input.addressLine1?.trim());
  if (hasStreetAddress && address) {
    return geocodeAddressWithCensus(address, { fetcher, timeoutMs }).catch(() => null);
  }

  return null;
}

export async function geocodeAddressWithCensus(
  address: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {}
): Promise<WeatherLocationResult | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const json = await fetchJsonWithTimeout(options.fetcher ?? fetch, url.toString(), options.timeoutMs ?? 12000);
  const matches = asRecord(asRecord(json)?.result)?.addressMatches;
  const first = Array.isArray(matches) ? asRecord(matches[0]) : null;
  const coordinates = asRecord(first?.coordinates);
  const longitude = asNumber(coordinates?.x);
  const latitude = asNumber(coordinates?.y);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    source: "address",
    confidence: "high",
    label: asString(first?.matchedAddress),
  };
}

export async function geocodeZipWithGeocodio(
  zipCode: string,
  options: WeatherLocationResolverOptions = {}
): Promise<WeatherLocationResult | null> {
  const apiKey = options.geocodioApiKey?.trim();
  if (!apiKey) return null;

  const url = new URL("https://api.geocod.io/v1.12/geocode");
  url.searchParams.set("q", zipCode);
  url.searchParams.set("api_key", apiKey);
  const json = await fetchJsonWithTimeout(options.fetcher ?? fetch, url.toString(), options.timeoutMs ?? 12000);
  const results = asRecord(json)?.results;
  const first = Array.isArray(results) ? asRecord(results[0]) : null;
  const location = asRecord(first?.location);
  const latitude = asNumber(location?.lat);
  const longitude = asNumber(location?.lng);
  if (latitude === null || longitude === null) return null;

  const components = asRecord(first?.address_components);
  const city = asString(components?.city);
  const state = asString(components?.state);
  const label = [city, state, normalizeZipCode(zipCode)].filter(Boolean).join(", ") || null;

  return {
    latitude,
    longitude,
    source: "zip_centroid",
    confidence: "low",
    label,
  };
}

export async function geocodeZipWithZippopotam(
  zipCode: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {}
): Promise<WeatherLocationResult | null> {
  const zip = normalizeZipCode(zipCode);
  if (!zip) return null;

  const url = `https://api.zippopotam.us/us/${encodeURIComponent(baseZipCode(zip))}`;
  const json = await fetchJsonWithTimeout(options.fetcher ?? fetch, url, options.timeoutMs ?? 12000);
  const places = asRecord(json)?.places;
  const first = Array.isArray(places) ? asRecord(places[0]) : null;
  const latitude = asNumber(first?.latitude);
  const longitude = asNumber(first?.longitude);
  if (latitude === null || longitude === null) return null;

  const city = asString(first?.["place name"]);
  const state = asString(first?.["state abbreviation"]) ?? asString(first?.state);
  const label = [city, state, zip].filter(Boolean).join(", ") || null;

  return {
    latitude,
    longitude,
    source: "zip_centroid",
    confidence: "low",
    label,
  };
}

export async function resolveWeatherLocationWithNwsPoint(
  input: WeatherLocationInput,
  nwsClient: NwsClient,
  options: WeatherLocationResolverOptions = {}
): Promise<(WeatherLocationResult & { nwsPoint: NwsPointMetadata }) | null> {
  const location = await resolveWeatherLocation(input, options);
  if (!location) return null;
  const nwsPoint = await nwsClient.getPointMetadata(location.latitude, location.longitude);
  return { ...location, nwsPoint };
}
