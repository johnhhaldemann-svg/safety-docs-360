"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, CalendarDays, ClipboardCheck, Download, GraduationCap, MapPin, ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";
import {
  Card,
  ExportButton,
  ForecastTrendChart,
  MetricCard,
  MiniSparkline,
  PageHeader,
  RiskBadge,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  riskLabel,
  safePredictMitigations,
  type SafePredictForecastPoint,
} from "@/lib/safePredictMockData";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import { hasSafePredictForecastInputs, riskForecastForSite, summarizeSafePredictDataset, type SafePredictJobsiteRecord } from "@/lib/safePredictData";

function SourceStatCard({
  title,
  value,
  detail,
  href,
  accentClassName = "text-slate-950",
}: {
  title: string;
  value: string | number;
  detail: string;
  href: string;
  accentClassName?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      aria-label={`${title}: view source records`}
    >
      <p className="text-xs font-black text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className={cx("mt-1 text-xs font-semibold", accentClassName)}>{detail}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-blue-600">
        View source
      </p>
    </Link>
  );
}

function CompanyLogoPanel({
  companyName,
  logoDataUrl,
}: {
  companyName: string;
  logoDataUrl?: string | null;
}) {
  return (
    <Card className="mb-5 p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Company logo</p>
          <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950">{companyName}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            This dashboard uses the logo saved on the company profile.
          </p>
        </div>
        <div className="flex min-h-[150px] items-center justify-center rounded-lg border border-slate-200 bg-white p-6">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Company profile logos are stored as data URLs.
            <img
              src={logoDataUrl}
              alt={`${companyName} logo`}
              className="max-h-28 w-full max-w-[360px] object-contain"
            />
          ) : (
            <div className="max-w-md text-center">
              <p className="text-sm font-black text-slate-900">No company logo saved yet</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                Add a logo to the company profile so it appears here.
              </p>
              <Link
                href="/company-setup"
                className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-white"
              >
                Open company setup
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

type ForecastWindow = 30 | 60 | 90;

function monthIndex(label: string) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(label);
}

function formatForecastDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function extendForecastWindow(points: SafePredictForecastPoint[], windowDays: ForecastWindow) {
  if (windowDays === 30 || points.length === 0) return points;

  const last = points[points.length - 1];
  const [month = "Jun", day = "9"] = last.date.split(" ");
  const startMonth = Math.max(0, monthIndex(month));
  const cursor = new Date(2025, startMonth, Number(day) || 9);
  const extraPoints = windowDays === 60 ? 6 : 12;
  let risk = last.predictedRisk;

  return [
    ...points,
    ...Array.from({ length: extraPoints }, (_, index) => {
      cursor.setDate(cursor.getDate() + 5);
      const swing = index % 3 === 0 ? 8 : index % 3 === 1 ? -5 : 3;
      risk = Math.max(18, Math.min(92, risk + swing - Math.floor(index / 3)));
      return {
        date: formatForecastDate(cursor),
        predictedRisk: risk,
      };
    }),
  ];
}

function riskMapDotClass(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "bg-red-500";
  if (level === "high") return "bg-orange-500";
  if (level === "medium") return "bg-amber-400";
  return "bg-emerald-500";
}

function LiveDashboardRiskMap({ jobsites }: { jobsites: SafePredictJobsiteRecord[] }) {
  if (jobsites.length === 0) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
        <div>
          <p className="text-sm font-black text-slate-800">No live risk map data yet</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Add jobsites, inspections, observations, or incidents to populate this map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {jobsites.slice(0, 6).map((jobsite) => (
        <Link
          key={jobsite.id}
          href={`/safe-predict/jobsites/${encodeURIComponent(jobsite.id)}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-900">{jobsite.name}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">{jobsite.workforceCount} workers</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-slate-800">
            <span className={cx("h-2.5 w-2.5 rounded-full", riskMapDotClass(jobsite.riskLevel))} />
            {jobsite.riskScore}
          </span>
        </Link>
      ))}
    </div>
  );
}

type JobsiteMapPoint = {
  jobsite: SafePredictJobsiteRecord;
  coordinateBacked: boolean;
  source: "coordinates" | "zip" | "city" | "layout";
  latitude?: number;
  longitude?: number;
};

type ZipCoordinate = {
  latitude: number;
  longitude: number;
};

type RealMapTile = {
  key: string;
  url: string;
  left: number;
  top: number;
};

type RealMapViewport = {
  width: number;
  height: number;
  zoom: number;
  tiles: RealMapTile[];
  project: (point: JobsiteMapPoint) => { left: number; top: number };
};

const TILE_SIZE = 256;
const REAL_MAP_WIDTH = 820;
const REAL_MAP_HEIGHT = 500;

function riskPinClasses(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "border-red-200 bg-red-600 text-white shadow-red-200";
  if (level === "high") return "border-orange-200 bg-orange-500 text-white shadow-orange-200";
  if (level === "medium") return "border-amber-200 bg-amber-400 text-slate-950 shadow-amber-100";
  return "border-emerald-200 bg-emerald-500 text-white shadow-emerald-100";
}

function hasValidCoordinates(jobsite: SafePredictJobsiteRecord) {
  return (
    typeof jobsite.weatherLatitude === "number" &&
    Number.isFinite(jobsite.weatherLatitude) &&
    jobsite.weatherLatitude >= -90 &&
    jobsite.weatherLatitude <= 90 &&
    typeof jobsite.weatherLongitude === "number" &&
    Number.isFinite(jobsite.weatherLongitude) &&
    jobsite.weatherLongitude >= -180 &&
    jobsite.weatherLongitude <= 180
  );
}

function normalizeZipCode(value?: string | null) {
  const match = String(value ?? "").match(/\b\d{5}\b/);
  return match?.[0] ?? "";
}

function normalizeCityStateLookupKey(value?: string | null) {
  const match = String(value ?? "").match(/^\s*([^,]+?)\s*,\s*([A-Za-z]{2})\s*$/);
  if (!match) return "";
  return `${match[2].toLowerCase()}|${match[1].trim().toLowerCase().replace(/\s+/g, "-")}`;
}

async function resolveZipCoordinate(zipCode: string, signal: AbortSignal): Promise<ZipCoordinate | null> {
  const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zipCode)}`, { signal });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as
    | { places?: Array<{ latitude?: string; longitude?: string }> }
    | null;
  const place = payload?.places?.[0];
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function resolveCityStateCoordinate(cityStateKey: string, signal: AbortSignal): Promise<ZipCoordinate | null> {
  const [state, city] = cityStateKey.split("|");
  if (!state || !city) return null;
  const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(state)}/${encodeURIComponent(city)}`, { signal });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as
    | { places?: Array<{ latitude?: string; longitude?: string }> }
    | null;
  const places = payload?.places ?? [];
  if (places.length === 0) return null;
  const averaged = places.reduce(
    (total, place) => {
      const latitude = Number(place.latitude);
      const longitude = Number(place.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return total;
      return {
        latitude: total.latitude + latitude,
        longitude: total.longitude + longitude,
        count: total.count + 1,
      };
    },
    { latitude: 0, longitude: 0, count: 0 }
  );
  if (averaged.count === 0) return null;
  return {
    latitude: averaged.latitude / averaged.count,
    longitude: averaged.longitude / averaged.count,
  };
}

function coordinateForJobsite(
  jobsite: SafePredictJobsiteRecord,
  zipCoordinates: Record<string, ZipCoordinate | null>,
  cityCoordinates: Record<string, ZipCoordinate | null>
) {
  if (hasValidCoordinates(jobsite)) {
    return {
      latitude: jobsite.weatherLatitude as number,
      longitude: jobsite.weatherLongitude as number,
      source: "coordinates" as const,
    };
  }

  const zipCode = normalizeZipCode(jobsite.zipCode);
  const zipCoordinate = zipCode ? zipCoordinates[zipCode] : null;
  if (zipCoordinate) {
    return {
      ...zipCoordinate,
      source: "zip" as const,
    };
  }

  const cityStateKey = normalizeCityStateLookupKey(jobsite.cityState);
  const cityCoordinate = cityStateKey ? cityCoordinates[cityStateKey] : null;
  if (cityCoordinate) {
    return {
      ...cityCoordinate,
      source: "city" as const,
    };
  }

  return null;
}

function buildJobsiteMapPoints(
  jobsites: SafePredictJobsiteRecord[],
  zipCoordinates: Record<string, ZipCoordinate | null>,
  cityCoordinates: Record<string, ZipCoordinate | null>
): JobsiteMapPoint[] {
  if (jobsites.length === 0) return [];

  const coordinatesById = new Map(
    jobsites
      .map((jobsite) => [jobsite.id, coordinateForJobsite(jobsite, zipCoordinates, cityCoordinates)] as const)
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof coordinateForJobsite>>] => Boolean(entry[1]))
  );

  if (coordinatesById.size === 0) {
    return jobsites.map((jobsite) => ({
      jobsite,
      coordinateBacked: false,
      source: "layout",
    }));
  }

  return jobsites.map((jobsite) => {
    const coordinate = coordinatesById.get(jobsite.id);
    if (!coordinate) {
      return {
        jobsite,
        coordinateBacked: false,
        source: "layout",
      };
    }

    return {
      jobsite,
      coordinateBacked: true,
      source: coordinate.source,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  });
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const latitudeRadians = (clampNumber(latitude, -85.05112878, 85.05112878) * Math.PI) / 180;
  return (
    (1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) /
    2
  ) * 2 ** zoom;
}

function chooseMapZoom(points: JobsiteMapPoint[]) {
  const latitudes = points.map((point) => point.latitude as number);
  const longitudes = points.map((point) => point.longitude as number);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const span = Math.max(latitudeSpan, longitudeSpan);

  if (span > 18) return 5;
  if (span > 8) return 6;
  if (span > 3) return 7;
  if (span > 1.2) return 8;
  if (span > 0.45) return 9;
  if (span > 0.18) return 10;
  return 11;
}

function buildRealMapViewport(points: JobsiteMapPoint[]): RealMapViewport | null {
  const locatedPoints = points.filter(
    (point) =>
      point.coordinateBacked &&
      typeof point.latitude === "number" &&
      Number.isFinite(point.latitude) &&
      typeof point.longitude === "number" &&
      Number.isFinite(point.longitude)
  );

  if (locatedPoints.length === 0) return null;

  const latitudes = locatedPoints.map((point) => point.latitude as number);
  const longitudes = locatedPoints.map((point) => point.longitude as number);
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const centerLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const zoom = chooseMapZoom(locatedPoints);
  const tileCount = 2 ** zoom;
  const centerPixelX = longitudeToTileX(centerLongitude, zoom) * TILE_SIZE;
  const centerPixelY = latitudeToTileY(centerLatitude, zoom) * TILE_SIZE;
  const originX = centerPixelX - REAL_MAP_WIDTH / 2;
  const originY = centerPixelY - REAL_MAP_HEIGHT / 2;
  const startTileX = Math.floor(originX / TILE_SIZE);
  const endTileX = Math.floor((originX + REAL_MAP_WIDTH) / TILE_SIZE);
  const startTileY = Math.max(0, Math.floor(originY / TILE_SIZE));
  const endTileY = Math.min(tileCount - 1, Math.floor((originY + REAL_MAP_HEIGHT) / TILE_SIZE));
  const tiles: RealMapTile[] = [];

  for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
    for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`,
        left: tileX * TILE_SIZE - originX,
        top: tileY * TILE_SIZE - originY,
      });
    }
  }

  return {
    width: REAL_MAP_WIDTH,
    height: REAL_MAP_HEIGHT,
    zoom,
    tiles,
    project: (point) => ({
      left: longitudeToTileX(point.longitude as number, zoom) * TILE_SIZE - originX,
      top: latitudeToTileY(point.latitude as number, zoom) * TILE_SIZE - originY,
    }),
  };
}

function highestRiskJobsite(jobsites: SafePredictJobsiteRecord[]) {
  return jobsites.reduce<SafePredictJobsiteRecord | null>((highest, jobsite) => {
    if (!highest || jobsite.riskScore > highest.riskScore) return jobsite;
    return highest;
  }, null);
}

function JobsiteRiskMap({
  jobsites,
  selectedJobsiteId,
  onSelectJobsite,
}: {
  jobsites: SafePredictJobsiteRecord[];
  selectedJobsiteId: string;
  onSelectJobsite: (jobsiteId: string) => void;
}) {
  const [zipCoordinates, setZipCoordinates] = useState<Record<string, ZipCoordinate | null>>({});
  const [cityCoordinates, setCityCoordinates] = useState<Record<string, ZipCoordinate | null>>({});
  const zipCodes = useMemo(
    () => [...new Set(jobsites.map((jobsite) => normalizeZipCode(jobsite.zipCode)).filter(Boolean))],
    [jobsites]
  );
  const cityStateKeys = useMemo(
    () =>
      [
        ...new Set(
          jobsites
            .filter((jobsite) => !normalizeZipCode(jobsite.zipCode) && !hasValidCoordinates(jobsite))
            .map((jobsite) => normalizeCityStateLookupKey(jobsite.cityState))
            .filter(Boolean)
        ),
      ],
    [jobsites]
  );

  useEffect(() => {
    const unresolvedZipCodes = zipCodes.filter((zipCode) => !(zipCode in zipCoordinates));
    if (unresolvedZipCodes.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    void Promise.all(
      unresolvedZipCodes.map(async (zipCode) => {
        try {
          const coordinate = await resolveZipCoordinate(zipCode, controller.signal);
          return [zipCode, coordinate] as const;
        } catch {
          return [zipCode, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setZipCoordinates((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      }));
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [zipCodes, zipCoordinates]);

  useEffect(() => {
    const unresolvedCityKeys = cityStateKeys.filter((cityStateKey) => !(cityStateKey in cityCoordinates));
    if (unresolvedCityKeys.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    void Promise.all(
      unresolvedCityKeys.map(async (cityStateKey) => {
        try {
          const coordinate = await resolveCityStateCoordinate(cityStateKey, controller.signal);
          return [cityStateKey, coordinate] as const;
        } catch {
          return [cityStateKey, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setCityCoordinates((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      }));
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cityCoordinates, cityStateKeys]);

  const mapPoints = useMemo(() => buildJobsiteMapPoints(jobsites, zipCoordinates, cityCoordinates), [cityCoordinates, jobsites, zipCoordinates]);
  const selectedJobsite =
    jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ??
    (selectedJobsiteId === "all" ? highestRiskJobsite(jobsites) : null) ??
    jobsites[0];
  const locatedMapPoints = mapPoints.filter((point) => point.coordinateBacked);
  const unlocatedMapPoints = mapPoints.filter((point) => !point.coordinateBacked);
  const realMapViewport = useMemo(() => buildRealMapViewport(mapPoints), [mapPoints]);
  const coordinateBacked = mapPoints.length > 0 && unlocatedMapPoints.length === 0;
  const zipBackedCount = mapPoints.filter((point) => point.source === "zip").length;
  const cityBackedCount = mapPoints.filter((point) => point.source === "city").length;
  const missingLocationCount = unlocatedMapPoints.length;
  const mapSourceLabel = coordinateBacked
    ? zipBackedCount > 0
      ? "OpenStreetMap + ZIP"
      : cityBackedCount > 0
        ? "OpenStreetMap + city/state"
        : "OpenStreetMap + saved coordinates"
    : missingLocationCount < mapPoints.length
      ? "OpenStreetMap + partial locations"
      : "Add ZIP or coordinates";

  return (
    <Card id="jobsite-source-cards" className="mt-5 scroll-mt-24 p-5">
      <SectionTitle
        title="Jobsite Risk Map"
        hint="Shows active jobsites as clickable map pins. Select a pin to review the jobsite number, risk band, score, workers, and open actions before opening the full command center."
      />
      {jobsites.length === 0 ? (
        <div className="mt-5 grid min-h-[280px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
          <div>
            <p className="text-sm font-black text-slate-900">No jobsites to map yet</p>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
              Add active jobsites to populate the dashboard map with risk markers.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
            <div
              className="relative overflow-hidden bg-slate-100"
              style={{ width: REAL_MAP_WIDTH, height: REAL_MAP_HEIGHT }}
            >
              {realMapViewport ? (
                <>
                  {realMapViewport.tiles.map((tile) => (
                    // eslint-disable-next-line @next/next/no-img-element -- Real OpenStreetMap tiles are loaded directly and do not use Next image optimization.
                    <img
                      key={tile.key}
                      src={tile.url}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="absolute h-64 w-64 select-none"
                      style={{ left: tile.left, top: tile.top }}
                    />
                  ))}
                </>
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-slate-50 px-6 text-center">
                  <div>
                    <p className="text-sm font-black text-slate-900">No mapped locations yet</p>
                    <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
                      Add a ZIP code or saved latitude/longitude to each jobsite to place it on the real map.
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-slate-900/5" aria-hidden="true" />
              <div className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm">
                {mapSourceLabel}
              </div>
              <div className="absolute bottom-4 left-4 max-w-[360px] rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-xs font-bold leading-5 text-slate-600 shadow-sm">
                Real map tiles are shown from OpenStreetMap. Pins use saved coordinates first, then ZIP lookup, then city/state lookup.
              </div>
              <div className="absolute bottom-4 right-4 rounded bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm">
                (c) OpenStreetMap contributors
              </div>
              {realMapViewport && locatedMapPoints.map((point) => {
                const isSelected = selectedJobsite?.id === point.jobsite.id;
                const zipCode = normalizeZipCode(point.jobsite.zipCode);
                const projected = realMapViewport.project(point);
                return (
                  <button
                    key={point.jobsite.id}
                    type="button"
                    onClick={() => onSelectJobsite(point.jobsite.id)}
                    aria-pressed={isSelected}
                    aria-label={`${point.jobsite.name}, ${point.jobsite.code}, Risk ${riskLabel(point.jobsite.riskLevel)}`}
                    className={cx(
                      "group absolute z-10 -translate-x-1/2 -translate-y-full rounded-full border-2 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.22)] transition hover:-translate-y-[108%] hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
                      isSelected ? "z-30 border-blue-500 ring-4 ring-blue-100" : "border-white"
                    )}
                    style={{ left: projected.left, top: projected.top }}
                  >
                    <span className={cx("grid h-9 w-9 place-items-center rounded-full border shadow-lg", riskPinClasses(point.jobsite.riskLevel))}>
                      <MapPin className="h-5 w-5" />
                    </span>
                    <span
                      className={cx(
                        "pointer-events-none absolute left-1/2 top-full mt-2 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-[0_14px_30px_rgba(15,23,42,0.18)]",
                        isSelected ? "block" : "hidden group-hover:block"
                      )}
                    >
                      <span className="block truncate text-xs font-black text-slate-950">{point.jobsite.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{point.jobsite.code}</span>
                      <span className="mt-1 block text-[10px] font-black text-slate-700">
                        {zipCode ? `ZIP ${zipCode}` : `Risk ${riskLabel(point.jobsite.riskLevel)}`}
                      </span>
                    </span>
                  </button>
                );
              })}
              {missingLocationCount > 0 ? (
                <div className="absolute right-4 top-16 max-h-[310px] w-60 overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-3 shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Needs location</p>
                  <div className="mt-2 grid gap-2">
                    {unlocatedMapPoints.map((point) => (
                      <button
                        key={point.jobsite.id}
                        type="button"
                        onClick={() => onSelectJobsite(point.jobsite.id)}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                      >
                        <span className="block truncate text-xs font-black text-slate-900">{point.jobsite.name}</span>
                        <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{point.jobsite.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="grid gap-4 content-start">
            {selectedJobsite ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Selected jobsite</p>
                    <h3 className="mt-1 text-xl font-black leading-tight text-slate-950">{selectedJobsite.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{selectedJobsite.code}</p>
                  </div>
                  <RiskBadge level={selectedJobsite.riskLevel} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Score</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{selectedJobsite.riskScore}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Workers</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{selectedJobsite.workforceCount}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Actions</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{selectedJobsite.openActions}</p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="font-bold text-slate-500">ZIP code</dt>
                    <dd className="text-right font-semibold text-slate-800">{normalizeZipCode(selectedJobsite.zipCode) || "Not set"}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="font-bold text-slate-500">Location</dt>
                    <dd className="text-right font-semibold text-slate-800">{selectedJobsite.cityState}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="font-bold text-slate-500">Site lead</dt>
                    <dd className="text-right font-semibold text-slate-800">{selectedJobsite.siteLead}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="font-bold text-slate-500">Phase</dt>
                    <dd className="text-right font-semibold text-slate-800">{selectedJobsite.phase}</dd>
                  </div>
                </dl>
                <Link
                  href={`/safe-predict/jobsites/${encodeURIComponent(selectedJobsite.id)}`}
                  className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  Open command center
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-900">Risk Level</p>
              <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Low (0-39)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> Medium (40-69)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500" /> High (70-89)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600" /> Critical (90-100)</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </Card>
  );
}

function EmptySafePredictPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-4 grid min-h-[260px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
      <div>
        <p className="text-sm font-black text-slate-900">{title}</p>
        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export default function SafePredictDashboardPage() {
  const { dataset, selectedJobsiteId, setSelectedJobsiteId } = useSafePredictData();
  const [forecastWindow, setForecastWindow] = useState<ForecastWindow>(30);
  const totals = summarizeSafePredictDataset(dataset);
  const selectedSiteId = selectedJobsiteId === "all" ? dataset.jobsites[0]?.id ?? "riverside" : selectedJobsiteId;
  const forecast = riskForecastForSite(dataset, selectedSiteId);
  const hasForecastInputs = hasSafePredictForecastInputs(dataset, selectedSiteId);
  const displayedForecast = useMemo(
    () => extendForecastWindow(forecast, forecastWindow),
    [forecast, forecastWindow]
  );
  const hasForecast = hasForecastInputs && displayedForecast.length > 0;
  const completedInspections = dataset.inspections.filter((inspection) => inspection.status === "Completed").length;
  const complianceRate = totals.workforce.compliantPercent;
  const liveWithoutRiskData = dataset.mode === "live" && totals.riskScore === 0 && !hasForecastInputs;
  const liveWithoutForecast = dataset.mode === "live" && !hasForecast;
  const liveWithoutOpenActions = dataset.mode === "live" && totals.openActions === 0;
  const liveWithoutCompletedInspections = dataset.mode === "live" && completedInspections === 0;

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Dashboard"
        subtitle="Executive Overview"
        actions={
          <>
            <SelectShell
              value={selectedJobsiteId}
              onChange={setSelectedJobsiteId}
              options={[
                { label: "All Sites", value: "all" },
                ...dataset.jobsites.map((site) => ({ label: site.name, value: site.id })),
              ]}
            />
            <ExportButton
              fileName="safe-predict-dashboard.json"
              label="Export dashboard snapshot"
              payload={{ company: dataset.company, jobsites: dataset.jobsites, employees: dataset.employees, alerts: dataset.alerts, mitigations: safePredictMitigations, actions: dataset.actions, permits: dataset.permits }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
              Export
            </ExportButton>
            <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">
              <CalendarDays className="h-4 w-4" aria-hidden />
              May 11 - May 17, 2025
            </span>
          </>
        }
      />

      <div className="mb-5">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Welcome back.</h2>
        <p className="mt-1 text-slate-600">Here&apos;s what&apos;s happening across your projects today.</p>
      </div>

      <Card className="mb-5 p-5">
        <div className="grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Company Account</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{dataset.company.name}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {dataset.company.industry} tenant based in {dataset.company.headquarters}. Safety lead: {dataset.company.safetyLead}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{dataset.mode === "live" ? "Live data" : "Workspace data"}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{totals.jobsites} active jobsites</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{totals.employees} workers</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <SourceStatCard
              title="Workforce"
              value={totals.employees}
              detail={`${totals.overdueEmployees} overdue`}
              href="/safe-predict/workforce#employee-roster"
              accentClassName="text-red-600"
            />
            <SourceStatCard
              title="Open Actions"
              value={totals.openActions}
              detail="Across all jobsites"
              href="/safe-predict/risk-mitigation#corrective-action-tracker"
              accentClassName="text-slate-600"
            />
            <SourceStatCard
              title="Avg. Site Risk"
              value={totals.riskScore}
              detail={dataset.mode === "live" ? "Live score" : "Elevated"}
              href="/safe-predict/risk-mitigation#prioritized-risk-queue"
              accentClassName="text-orange-600"
            />
          </div>
        </div>
      </Card>

      <CompanyLogoPanel companyName={dataset.company.name} logoDataUrl={dataset.company.logoDataUrl} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard
          title="Overall Site Risk Score"
          value={totals.riskScore}
          suffix="/100"
          detail={liveWithoutRiskData ? "No Data" : "High Risk"}
          trend={liveWithoutRiskData ? "Add jobsites and safety records to calculate a live score" : "Up 8 pts vs. last 7 days"}
          tone={liveWithoutRiskData ? "blue" : "red"}
          icon={<ShieldAlert className="h-7 w-7" />}
          sparkline={liveWithoutRiskData ? undefined : <MiniSparkline data={[42, 47, 58, 44, 46, 56, 54]} />}
          href="/safe-predict/risk-mitigation#prioritized-risk-queue"
          sourceLabel="Open risk queue"
        />
        <MetricCard
          title="Predicted Incident Risk"
          value={liveWithoutForecast ? "No Data" : "24%"}
          detail={liveWithoutForecast ? "Waiting for forecast" : "High"}
          trend={liveWithoutForecast ? "Predictive risk appears after live inspections, observations, actions, permits, or workforce records exist" : "Up 6% vs. last 30 days"}
          tone={liveWithoutForecast ? "blue" : "orange"}
          icon={<TrendingUp className="h-7 w-7" />}
          sparkline={liveWithoutForecast ? undefined : <MiniSparkline data={[20, 22, 31, 28, 35, 38, 47]} color="#f97316" />}
          href="/safe-predict/predictive-risk#forecast-drivers"
          sourceLabel="Open forecast"
        />
        <MetricCard
          title="Open Corrective Actions"
          value={totals.openActions}
          detail={liveWithoutOpenActions ? "None Open" : "High Priority"}
          trend={liveWithoutOpenActions ? "No corrective actions are currently open" : "Up 5 vs. last 7 days"}
          tone={liveWithoutOpenActions ? "blue" : "red"}
          icon={<ClipboardCheck className="h-7 w-7" />}
          href="/safe-predict/risk-mitigation#corrective-action-tracker"
          sourceLabel="Open action tracker"
        />
        <MetricCard
          title="Completed Inspections"
          value={completedInspections}
          detail={liveWithoutCompletedInspections ? "None Completed" : "This Week"}
          trend={liveWithoutCompletedInspections ? "Completed inspections will appear after field audits are logged" : "Up 18 vs. last 7 days"}
          tone={liveWithoutCompletedInspections ? "blue" : "green"}
          icon={<ShieldCheck className="h-7 w-7" />}
          href="/safe-predict/inspections"
          sourceLabel="Open inspection rows"
        />
        <MetricCard
          title="Training Compliance Rate"
          value={`${complianceRate}%`}
          detail={dataset.mode === "live" && totals.employees === 0 ? "No workers" : "Compliant"}
          trend={dataset.mode === "live" && totals.employees === 0 ? "Add workforce records to calculate compliance" : "Up 4% vs. last 7 days"}
          tone="green"
          icon={<GraduationCap className="h-7 w-7" />}
          href="/safe-predict/workforce#training-matrix"
          sourceLabel="Open training matrix"
        />
      </div>

      <JobsiteRiskMap
        jobsites={dataset.jobsites}
        selectedJobsiteId={selectedJobsiteId}
        onSelectJobsite={setSelectedJobsiteId}
      />

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.25fr_1fr]">
        <Card className="p-5">
          <SectionTitle
            title="Predictive Risk Trend"
            action={
              <div className="hidden rounded-lg border border-slate-200 bg-white p-1 sm:flex">
                {([30, 60, 90] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setForecastWindow(days)}
                    aria-pressed={forecastWindow === days}
                    className={cx(
                      "rounded-md px-3 py-1.5 text-xs font-bold",
                      forecastWindow === days ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            }
          />
          {hasForecast ? (
            <>
              <div className="mt-4 inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                AI models indicate risk levels will remain elevated over the next {forecastWindow} days.
              </div>
              <ForecastTrendChart data={displayedForecast} />
              <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-red-500" /> Historical Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-orange-500" /> Predicted Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-200" /> High Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-200" /> Medium Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-200" /> Low Risk</span>
              </div>
            </>
          ) : (
            <EmptySafePredictPanel
              title="No live forecast yet"
              detail="Add a jobsite plus inspections, observations, incidents, corrective actions, permits, or workforce records before SafetyDoc360 shows a predictive trend."
            />
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Risk Heat Map by Trade / Area"
            action={<Link href="/safe-predict/risk-mitigation" className="text-sm font-bold text-blue-600">View Full Map</Link>}
          />
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_168px]">
            {dataset.mode === "live" ? <LiveDashboardRiskMap jobsites={dataset.jobsites} /> : <RiskHeatMap />}
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">Risk Level</p>
              <div className="mt-4 space-y-4 text-sm font-semibold text-slate-600">
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> High (70-100)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500" /> Medium (40-69)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Low (0-39)</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="p-5 pb-2">
            <SectionTitle title="Top Recommended Mitigations" />
          </div>
          <div className="space-y-3 p-4 pt-2 md:hidden">
            {safePredictMitigations.map((item) => (
              <article key={`${item.id}-mobile`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-black leading-snug text-slate-950">{item.recommendation}</p>
                  <RiskBadge level={item.priority} />
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{item.detail}</p>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-500">Drivers</dt>
                    <dd className="text-right font-semibold text-slate-800">{item.drivers.join(", ")}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-500">Impact</dt>
                    <dd className="font-semibold text-slate-800">{item.impact}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-500">Timeline</dt>
                    <dd className="font-semibold text-slate-800">{item.timeline}</dd>
                  </div>
                </dl>
                <Link href={`/safe-predict/risk-mitigation#${item.id}`} className="mt-4 inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">
                  View Details
                </Link>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs font-bold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Recommendation</th>
                  <th className="px-5 py-3">Risk Drivers</th>
                  <th className="px-5 py-3">Impact</th>
                  <th className="px-5 py-3">Timeline</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {safePredictMitigations.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4"><RiskBadge level={item.priority} /></td>
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-900">{item.recommendation}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.drivers.join(", ")}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <span className="h-3 w-3 rounded-sm bg-red-500" />
                        <span className="h-3 w-3 rounded-sm bg-red-500" />
                        <span className="h-3 w-3 rounded-sm bg-red-500" />
                        {item.impact}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.timeline}</td>
                    <td className="px-5 py-4">
                      <Link href={`/safe-predict/risk-mitigation#${item.id}`} className="inline-flex rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-5">
            <Link href="/safe-predict/risk-mitigation" className="font-bold text-blue-600">View All Recommendations</Link>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Recent Alerts" action={<Link href="/safe-predict/risk-mitigation" className="text-sm font-bold text-blue-600">View All Alerts</Link>} />
          <div className="mt-5 divide-y divide-slate-100">
            {dataset.alerts.slice(0, 3).map((alert) => (
              <Link key={alert.id} href={`/safe-predict/risk-mitigation#${alert.id}`} className="flex items-start gap-4 py-4 first:pt-0 hover:bg-slate-50">
                <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", alert.riskLevel === "critical" || alert.riskLevel === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
                </div>
                <span className="text-sm text-slate-500">{alert.timeAgo}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
