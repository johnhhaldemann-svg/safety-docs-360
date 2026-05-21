"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardCheck, Crosshair, Download, Expand, GraduationCap, Layers, MapPin, Minus, Plus, RotateCcw, Shield, ShieldAlert, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";
import {
  Card,
  ExportButton,
  RiskBadge,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  riskLevelForScore,
  riskLabel,
  safePredictMitigations,
  type SafePredictForecastPoint,
} from "@/lib/safePredictMockData";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import {
  forecastReasonsForSite,
  hasSafePredictForecastInputs,
  riskForecastForSite,
  summarizeSafePredictDataset,
  type SafePredictDataset,
  type SafePredictForecastReason,
  type SafePredictJobsiteRecord,
} from "@/lib/safePredictData";

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
  const relativeMatch = /^\+(\d+)d$/.exec(last.date);
  if (relativeMatch) {
    const startOffset = Number(relativeMatch[1]);
    const extraPoints = windowDays === 60 ? 6 : 12;
    let risk = last.predictedRisk;

    return [
      ...points,
      ...Array.from({ length: extraPoints }, (_, index) => {
        const swing = index % 3 === 0 ? 8 : index % 3 === 1 ? -5 : 3;
        risk = Math.max(18, Math.min(92, risk + swing - Math.floor(index / 3)));
        return {
          date: `+${startOffset + (index + 1) * 5}d`,
          predictedRisk: risk,
        };
      }),
    ];
  }

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

function commandRiskToneClass(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "text-red-400";
  if (level === "high") return "text-orange-400";
  if (level === "medium") return "text-amber-300";
  return "text-emerald-400";
}

function commandRiskSparklineColor(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "#f87171";
  if (level === "high") return "#fb923c";
  if (level === "medium") return "#fbbf24";
  return "#34d399";
}

function highestForecastRiskIndex(points: SafePredictForecastPoint[]) {
  if (points.length === 0) return 0;
  return points.reduce(
    (highestIndex, point, index) => (point.predictedRisk > (points[highestIndex]?.predictedRisk ?? -1) ? index : highestIndex),
    0
  );
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

type MapPanOffset = {
  x: number;
  y: number;
};

type MapStateCluster = {
  stateCode: string;
  latitude: number;
  longitude: number;
  jobsiteCount: number;
  workforceCount: number;
  highestRiskScore: number;
  highestRiskLevel: SafePredictJobsiteRecord["riskLevel"];
  points: JobsiteMapPoint[];
};

const TILE_SIZE = 256;
const REAL_MAP_WIDTH = 1080;
const REAL_MAP_HEIGHT = 560;
const REAL_MAP_FIT_PADDING = 96;
const MIN_REAL_MAP_ZOOM = 4;
const MAX_REAL_MAP_ZOOM = 14;

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
  return `${match[2].toLowerCase()}|${match[1].trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function stateCodeForJobsite(jobsite: SafePredictJobsiteRecord) {
  const explicitState = String(jobsite.state ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(explicitState)) return explicitState.toUpperCase();

  const cityStateMatch = String(jobsite.cityState ?? "").match(/,\s*([A-Za-z]{2})\s*$/);
  if (cityStateMatch) return cityStateMatch[1].toUpperCase();

  return "";
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
  if (points.length <= 1) return 11;

  const fitWidth = REAL_MAP_WIDTH - REAL_MAP_FIT_PADDING * 2;
  const fitHeight = REAL_MAP_HEIGHT - REAL_MAP_FIT_PADDING * 2;

  for (let zoom = MAX_REAL_MAP_ZOOM; zoom >= MIN_REAL_MAP_ZOOM; zoom -= 1) {
    const xs = points.map((point) => longitudeToTileX(point.longitude as number, zoom) * TILE_SIZE);
    const ys = points.map((point) => latitudeToTileY(point.latitude as number, zoom) * TILE_SIZE);
    const pointWidth = Math.max(...xs) - Math.min(...xs);
    const pointHeight = Math.max(...ys) - Math.min(...ys);

    if (pointWidth <= fitWidth && pointHeight <= fitHeight) return zoom;
  }

  return MIN_REAL_MAP_ZOOM;
}

function mapPointsPixelCenter(points: JobsiteMapPoint[], zoom: number) {
  const xs = points.map((point) => longitudeToTileX(point.longitude as number, zoom) * TILE_SIZE);
  const ys = points.map((point) => latitudeToTileY(point.latitude as number, zoom) * TILE_SIZE);

  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function buildMapStateClusters(points: JobsiteMapPoint[]) {
  const byState = new Map<string, JobsiteMapPoint[]>();

  points.forEach((point) => {
    if (
      !point.coordinateBacked ||
      typeof point.latitude !== "number" ||
      !Number.isFinite(point.latitude) ||
      typeof point.longitude !== "number" ||
      !Number.isFinite(point.longitude)
    ) {
      return;
    }

    const stateCode = stateCodeForJobsite(point.jobsite);
    if (!stateCode) return;

    byState.set(stateCode, [...(byState.get(stateCode) ?? []), point]);
  });

  return [...byState.entries()]
    .map(([stateCode, statePoints]): MapStateCluster => {
      const highestRiskPoint = statePoints.reduce((highest, point) =>
        point.jobsite.riskScore > highest.jobsite.riskScore ? point : highest
      );

      return {
        stateCode,
        latitude: statePoints.reduce((total, point) => total + (point.latitude as number), 0) / statePoints.length,
        longitude: statePoints.reduce((total, point) => total + (point.longitude as number), 0) / statePoints.length,
        jobsiteCount: statePoints.length,
        workforceCount: statePoints.reduce((total, point) => total + point.jobsite.workforceCount, 0),
        highestRiskScore: highestRiskPoint.jobsite.riskScore,
        highestRiskLevel: highestRiskPoint.jobsite.riskLevel,
        points: statePoints,
      };
    })
    .sort((left, right) => right.highestRiskScore - left.highestRiskScore || left.stateCode.localeCompare(right.stateCode));
}

function buildRealMapViewport(points: JobsiteMapPoint[], zoomAdjustment: number, panOffset: MapPanOffset): RealMapViewport | null {
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
  const zoom = clampNumber(chooseMapZoom(locatedPoints) + zoomAdjustment, MIN_REAL_MAP_ZOOM, MAX_REAL_MAP_ZOOM);
  const tileCount = 2 ** zoom;
  const centerPixelX = longitudeToTileX(centerLongitude, zoom) * TILE_SIZE;
  const centerPixelY = latitudeToTileY(centerLatitude, zoom) * TILE_SIZE;
  const originX = centerPixelX - REAL_MAP_WIDTH / 2 - panOffset.x;
  const originY = centerPixelY - REAL_MAP_HEIGHT / 2 - panOffset.y;
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
        url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${wrappedTileX}`,
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
  const [mapZoomAdjustment, setMapZoomAdjustment] = useState(0);
  const [mapPanOffset, setMapPanOffset] = useState<MapPanOffset>({ x: 0, y: 0 });
  const [focusedStateCode, setFocusedStateCode] = useState<string | null>(null);
  const [isMapDragging, setIsMapDragging] = useState(false);
  const mapWheelTargetRef = useRef<HTMLDivElement | null>(null);
  const mapDragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPanOffset: MapPanOffset;
  } | null>(null);
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
  const stateClusters = useMemo(() => buildMapStateClusters(mapPoints), [mapPoints]);
  const realMapViewport = useMemo(() => buildRealMapViewport(mapPoints, mapZoomAdjustment, mapPanOffset), [mapPanOffset, mapPoints, mapZoomAdjustment]);
  const baseMapZoom = locatedMapPoints.length > 0 ? chooseMapZoom(locatedMapPoints) : MIN_REAL_MAP_ZOOM;
  const currentMapZoom = clampNumber(baseMapZoom + mapZoomAdjustment, MIN_REAL_MAP_ZOOM, MAX_REAL_MAP_ZOOM);
  const canZoomOut = currentMapZoom > MIN_REAL_MAP_ZOOM;
  const canZoomIn = currentMapZoom < MAX_REAL_MAP_ZOOM;
  const coordinateBacked = mapPoints.length > 0 && unlocatedMapPoints.length === 0;
  const zipBackedCount = mapPoints.filter((point) => point.source === "zip").length;
  const cityBackedCount = mapPoints.filter((point) => point.source === "city").length;
  const missingLocationCount = unlocatedMapPoints.length;
  const mapSourceLabel = coordinateBacked
    ? zipBackedCount > 0
      ? "Satellite + ZIP"
      : cityBackedCount > 0
        ? "Satellite + city/state"
        : "Satellite + saved coordinates"
    : missingLocationCount < mapPoints.length
      ? "Satellite + partial locations"
      : "Add ZIP or coordinates";

  function updateMapZoom(delta: number) {
    setFocusedStateCode(null);
    setMapZoomAdjustment((value) =>
      clampNumber(value + delta, MIN_REAL_MAP_ZOOM - baseMapZoom, MAX_REAL_MAP_ZOOM - baseMapZoom)
    );
  }

  function resetMapView() {
    setFocusedStateCode(null);
    setMapZoomAdjustment(0);
    setMapPanOffset({ x: 0, y: 0 });
  }

  function focusMapOnState(cluster: MapStateCluster) {
    if (locatedMapPoints.length === 0 || cluster.points.length === 0) return;

    const fitStateZoom = chooseMapZoom(cluster.points);
    const targetZoom = clampNumber(
      Math.max(fitStateZoom, cluster.points.length === locatedMapPoints.length ? baseMapZoom + 1 : fitStateZoom),
      MIN_REAL_MAP_ZOOM,
      MAX_REAL_MAP_ZOOM
    );
    const nextZoomAdjustment = targetZoom - baseMapZoom;
    const allCenter = mapPointsPixelCenter(locatedMapPoints, targetZoom);
    const stateCenter = mapPointsPixelCenter(cluster.points, targetZoom);

    setFocusedStateCode(cluster.stateCode);
    setMapZoomAdjustment(nextZoomAdjustment);
    setMapPanOffset({
      x: allCenter.x - stateCenter.x,
      y: allCenter.y - stateCenter.y,
    });
  }

  useEffect(() => {
    const element = mapWheelTargetRef.current;
    if (!element || !realMapViewport) return;

    function handleWheel(event: WheelEvent) {
      if (event.deltaY === 0) return;

      event.preventDefault();
      setFocusedStateCode(null);
      setMapZoomAdjustment((value) =>
        clampNumber(value + (event.deltaY < 0 ? 1 : -1), MIN_REAL_MAP_ZOOM - baseMapZoom, MAX_REAL_MAP_ZOOM - baseMapZoom)
      );
    }

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [baseMapZoom, realMapViewport]);

  function endMapDrag(event: PointerEvent<HTMLDivElement>) {
    if (mapDragState.current?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mapDragState.current = null;
    setIsMapDragging(false);
  }

  function handleMapPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!realMapViewport || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button,a,input,select,textarea,[data-map-control='true']")) return;

    mapDragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanOffset: mapPanOffset,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setFocusedStateCode(null);
    setIsMapDragging(true);
  }

  function handleMapPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = mapDragState.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    setMapPanOffset({
      x: dragState.startPanOffset.x + event.clientX - dragState.startX,
      y: dragState.startPanOffset.y + event.clientY - dragState.startY,
    });
  }

  return (
    <section className="relative h-[560px] min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
      <div
        ref={mapWheelTargetRef}
        className={cx(
          "relative h-full overflow-hidden bg-slate-950 select-none",
          realMapViewport ? (isMapDragging ? "cursor-grabbing" : "cursor-grab") : ""
        )}
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={endMapDrag}
        onPointerCancel={endMapDrag}
        style={{ touchAction: "none" }}
      >
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[1080px] -translate-x-1/2 -translate-y-1/2">
          {realMapViewport ? (
            realMapViewport.tiles.map((tile) => (
              // eslint-disable-next-line @next/next/no-img-element -- Esri satellite tiles are loaded directly and do not use Next image optimization.
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute h-64 w-64 select-none"
                style={{ left: tile.left, top: tile.top }}
              />
            ))
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-slate-900 px-6 text-center">
              <div>
                <p className="text-sm font-black text-white">No mapped locations yet</p>
                <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-300">
                  Add a ZIP code or saved latitude/longitude to each jobsite to place it on the satellite command map.
                </p>
              </div>
            </div>
          )}
          {realMapViewport && stateClusters.map((cluster) => {
            const anchorPoint = cluster.points[0];
            if (!anchorPoint) return null;

            const isFocused = focusedStateCode === cluster.stateCode;
            const projected = realMapViewport.project({
              jobsite: anchorPoint.jobsite,
              coordinateBacked: true,
              source: "coordinates",
              latitude: cluster.latitude,
              longitude: cluster.longitude,
            });

            return (
              <button
                key={cluster.stateCode}
                type="button"
                onClick={() => focusMapOnState(cluster)}
                aria-pressed={isFocused}
                aria-label={`${cluster.stateCode} state view, ${cluster.jobsiteCount} jobsites, highest risk ${cluster.highestRiskScore}`}
                className={cx(
                  "absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-md border px-3 py-2 text-left shadow-[0_18px_36px_rgba(0,0,0,0.38)] backdrop-blur transition hover:-translate-y-[55%] hover:bg-white/18 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300",
                  isFocused ? "border-blue-300 bg-blue-600/80 text-white ring-4 ring-blue-400/25" : "border-white/20 bg-slate-950/72 text-white"
                )}
                style={{ left: projected.left, top: projected.top }}
              >
                <span className="block text-xs font-black leading-none">{cluster.stateCode}</span>
                <span className="mt-1 block text-[10px] font-bold text-slate-200">{cluster.jobsiteCount} sites / {riskLabel(cluster.highestRiskLevel)}</span>
              </button>
            );
          })}
          {realMapViewport && locatedMapPoints.map((point) => {
            const isSelected = selectedJobsite?.id === point.jobsite.id;
            const projected = realMapViewport.project(point);
            return (
              <button
                key={point.jobsite.id}
                type="button"
                onClick={() => onSelectJobsite(point.jobsite.id)}
                aria-pressed={isSelected}
                aria-label={`${point.jobsite.name}, ${point.jobsite.code}, Risk ${riskLabel(point.jobsite.riskLevel)}`}
                className={cx(
                  "group absolute z-20 -translate-x-1/2 -translate-y-full rounded-full border-2 bg-slate-950/80 p-1 shadow-[0_18px_32px_rgba(0,0,0,0.45)] transition hover:-translate-y-[108%] hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300",
                  isSelected ? "border-white ring-4 ring-red-500/30" : "border-white/80"
                )}
                style={{ left: projected.left, top: projected.top }}
              >
                {isSelected ? (
                  <span className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-400/55 bg-red-500/10 shadow-[0_0_42px_rgba(239,68,68,0.55)]" aria-hidden>
                    <span className="absolute inset-4 rounded-full border border-red-300/45" />
                    <span className="absolute inset-8 rounded-full border border-white/35" />
                    <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" />
                    <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/45" />
                  </span>
                ) : null}
                <span className={cx("relative z-10 grid h-12 w-12 place-items-center rounded-full border shadow-lg", riskPinClasses(point.jobsite.riskLevel))}>
                  <MapPin className="h-6 w-6" />
                </span>
                <span
                  className={cx(
                    "pointer-events-none absolute left-1/2 top-full mt-3 w-52 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-950/92 px-3 py-2 text-left text-white shadow-[0_18px_36px_rgba(0,0,0,0.45)] backdrop-blur",
                    isSelected ? "block" : "hidden group-hover:block"
                  )}
                >
                  <span className="block truncate text-xs font-black">{point.jobsite.name}</span>
                  <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-300">{point.jobsite.code}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(248,113,113,0.24),transparent_20%),linear-gradient(90deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.2)_28%,rgba(2,6,23,0.2)_68%,rgba(2,6,23,0.76)_100%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.07)_1px,transparent_1px)] bg-[length:44px_44px]" aria-hidden />

        <div data-map-control="true" className="absolute left-4 top-4 z-40 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg">
            Jobsite Risk Map
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/35 bg-emerald-400/14 px-3 py-2 text-xs font-black text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live
          </span>
          <span className="rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-200 backdrop-blur">
            {mapSourceLabel}
          </span>
        </div>

        {realMapViewport && stateClusters.length > 0 ? (
          <div data-map-control="true" className="absolute left-4 top-16 z-40 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 xl:max-w-[600px]">
            <button
              type="button"
              onClick={resetMapView}
              className={cx(
                "min-h-9 rounded-md border px-3 text-xs font-black uppercase tracking-wide shadow-lg backdrop-blur transition hover:bg-white/12",
                focusedStateCode ? "border-white/15 bg-slate-950/76 text-slate-200" : "border-white bg-white text-slate-950"
              )}
            >
              All states
            </button>
            {stateClusters.map((cluster) => {
              const isFocused = focusedStateCode === cluster.stateCode;

              return (
                <button
                  key={cluster.stateCode}
                  type="button"
                  onClick={() => focusMapOnState(cluster)}
                  aria-pressed={isFocused}
                  className={cx(
                    "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-black uppercase tracking-wide shadow-lg backdrop-blur transition hover:bg-white/12",
                    isFocused ? "border-blue-300 bg-blue-600/88 text-white" : "border-white/15 bg-slate-950/76 text-slate-200"
                  )}
                >
                  <span>{cluster.stateCode}</span>
                  <span className="rounded bg-white/12 px-1.5 py-0.5 text-[10px]">{cluster.jobsiteCount}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {realMapViewport ? (
          <div data-map-control="true" className="absolute right-4 top-4 z-40 flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-white/15 bg-slate-950/76 text-white shadow-[0_18px_36px_rgba(0,0,0,0.3)] backdrop-blur">
              <button type="button" onClick={() => updateMapZoom(-1)} disabled={!canZoomOut} className="grid h-10 w-10 place-items-center transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500" aria-label="Zoom out" title="Zoom out">
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <div className="grid h-10 min-w-12 place-items-center border-x border-white/10 px-2 text-xs font-black text-slate-200">Z{currentMapZoom}</div>
              <button type="button" onClick={() => updateMapZoom(1)} disabled={!canZoomIn} className="grid h-10 w-10 place-items-center transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500" aria-label="Zoom in" title="Zoom in">
                <Plus className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={resetMapView}
                disabled={mapZoomAdjustment === 0 && mapPanOffset.x === 0 && mapPanOffset.y === 0 && !focusedStateCode}
                className="grid h-10 w-10 place-items-center border-l border-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
                aria-label="Center map between all jobsites"
                title="Center between all jobsites"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <span className="hidden h-10 w-10 place-items-center rounded-lg border border-white/15 bg-slate-950/76 text-white backdrop-blur sm:grid">
              <Layers className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden h-10 w-10 place-items-center rounded-lg border border-white/15 bg-slate-950/76 text-white backdrop-blur sm:grid">
              <Crosshair className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden h-10 w-10 place-items-center rounded-lg border border-white/15 bg-slate-950/76 text-white backdrop-blur sm:grid">
              <Expand className="h-4 w-4" aria-hidden />
            </span>
          </div>
        ) : null}

        {selectedJobsite ? (
          <div data-map-control="true" className="absolute bottom-4 right-4 top-20 z-30 hidden w-[300px] rounded-lg border border-white/15 bg-slate-950/78 p-4 text-white shadow-[0_24px_56px_rgba(0,0,0,0.48)] backdrop-blur-md xl:block">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-md border border-red-400/50 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-100">
                {riskLabel(selectedJobsite.riskLevel)}
              </span>
              <div className="flex gap-2 text-slate-400">
                <Target className="h-4 w-4" aria-hidden />
                <Shield className="h-4 w-4" aria-hidden />
              </div>
            </div>
            <h3 className="mt-5 text-2xl font-black leading-tight">{selectedJobsite.name}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-300">
              {selectedJobsite.workforceCount} workers / ZIP {normalizeZipCode(selectedJobsite.zipCode) || "Not set"}
            </p>
            <div className="relative mx-auto mt-5 grid h-44 w-44 place-items-center rounded-full border border-sky-200/35 bg-[radial-gradient(circle,rgba(239,68,68,0.24)_0%,rgba(14,165,233,0.12)_52%,transparent_70%)]">
              <span className="absolute inset-3 rounded-full border border-white/20" />
              <span className="absolute inset-8 rounded-full border border-red-300/55" />
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/25" />
              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/25" />
              <span className="grid h-20 w-20 place-items-center rounded-[1.4rem] border-2 border-red-400 bg-slate-950/84 text-center shadow-[0_0_30px_rgba(239,68,68,0.55)]">
                <span>
                  <span className="block text-4xl font-black text-red-400">{selectedJobsite.riskScore}</span>
                  <span className="text-xs font-black text-white">/100</span>
                </span>
              </span>
            </div>
            <p className="mt-3 text-center text-xl font-black text-red-400">{riskLabel(selectedJobsite.riskLevel)} Risk</p>
            <p className="text-center text-xs font-semibold text-slate-300">Live site risk score</p>
            <Link href={`/safe-predict/jobsites/${encodeURIComponent(selectedJobsite.id)}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-500">
              Open command center
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <dl className="mt-4 grid gap-2 text-xs">
              <div className="flex justify-between gap-3 border-t border-white/10 pt-2"><dt className="text-slate-400">Location</dt><dd className="text-right font-semibold">{selectedJobsite.cityState}</dd></div>
              <div className="flex justify-between gap-3 border-t border-white/10 pt-2"><dt className="text-slate-400">Site lead</dt><dd className="text-right font-semibold">{selectedJobsite.siteLead}</dd></div>
              <div className="flex justify-between gap-3 border-t border-white/10 pt-2"><dt className="text-slate-400">Phase</dt><dd className="text-right font-semibold">{selectedJobsite.phase}</dd></div>
            </dl>
          </div>
        ) : null}

        {missingLocationCount > 0 ? (
          <div data-map-control="true" className="absolute left-4 top-32 z-40 max-h-[220px] w-60 overflow-y-auto rounded-lg border border-white/15 bg-slate-950/80 p-3 text-white shadow-[0_18px_36px_rgba(0,0,0,0.42)] backdrop-blur">
            <p className="text-xs font-black uppercase tracking-wide text-slate-300">Needs location</p>
            <div className="mt-2 grid gap-2">
              {unlocatedMapPoints.map((point) => (
                <button key={point.jobsite.id} type="button" onClick={() => onSelectJobsite(point.jobsite.id)} className="rounded-md border border-white/10 bg-white/6 px-3 py-2 text-left transition hover:bg-white/10">
                  <span className="block truncate text-xs font-black">{point.jobsite.name}</span>
                  <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{point.jobsite.code}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div data-map-control="true" className="absolute bottom-4 left-4 z-30 max-w-[360px] rounded-lg border border-white/15 bg-slate-950/78 px-3 py-2 text-xs font-bold leading-5 text-slate-200 shadow-lg backdrop-blur">
          Drag to move the map. Use the mouse wheel to zoom. Satellite tiles from Esri World Imagery; pins use saved coordinates first, then ZIP and city/state lookup.
        </div>
        <div data-map-control="true" className="absolute bottom-4 right-4 z-30 rounded bg-slate-950/78 px-2 py-1 text-[10px] font-bold text-slate-300 shadow-sm backdrop-blur xl:right-[328px]">
          Imagery (c) Esri, Maxar, Earthstar Geographics, and GIS community
        </div>
      </div>
    </section>
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

function CommandStatRow({
  icon,
  label,
  value,
  detail,
  tone = "text-white",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 py-3 last:border-b-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/6 text-slate-100">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <div className="mt-1 flex items-end gap-3">
          <p className="text-2xl font-black leading-none text-white">{value}</p>
          <p className={cx("pb-0.5 text-xs font-black", tone)}>{detail}</p>
        </div>
      </div>
    </div>
  );
}

function CompanyCommandPanel({
  dataset,
  totals,
  loading,
}: {
  dataset: SafePredictDataset;
  totals: ReturnType<typeof summarizeSafePredictDataset>;
  loading: boolean;
}) {
  const isEmptyWorkspace = dataset.mode === "live" && totals.jobsites === 0 && totals.employees === 0 && totals.openActions === 0;
  const companyName = loading && isEmptyWorkspace ? "Loading workspace" : dataset.company.name;
  const companyDetail = loading && isEmptyWorkspace
    ? "Loading live company, jobsite, workforce, action, and risk data..."
    : isEmptyWorkspace
      ? "Connect jobsites, workers, permits, and actions to populate this command center."
      : `Live safety command center for ${dataset.company.name}. Safety lead: ${dataset.company.safetyLead}.`;

  return (
    <section className="rounded-lg border border-slate-800 bg-[linear-gradient(180deg,#071d34_0%,#06172a_100%)] p-4 text-white shadow-[0_24px_60px_rgba(2,6,23,0.28)]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Company Account</p>
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-white/12 bg-white p-3 shadow-xl">
          {dataset.company.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Company logos are stored as data URLs in the workspace profile.
            <img src={dataset.company.logoDataUrl} alt={`${dataset.company.name} logo`} className="max-h-full max-w-full object-contain" />
          ) : (
            <ShieldCheck className="h-12 w-12 text-blue-700" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black leading-tight">{companyName}</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
            {companyDetail}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-400/14 px-3 py-2 text-xs font-black text-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {loading && isEmptyWorkspace ? "Loading data" : dataset.mode === "live" ? "Live data" : "Workspace data"}
        </span>
        <span className="rounded-md bg-blue-600 px-3 py-2 text-xs font-black text-white">{totals.jobsites} jobsites</span>
        <span className="rounded-md bg-emerald-500/18 px-3 py-2 text-xs font-black text-emerald-100">{totals.employees} workers</span>
      </div>

      <div className="mt-5 rounded-lg border border-white/12 bg-white/5 px-4">
        <CommandStatRow icon={<Users className="h-6 w-6" />} label="Workforce" value={totals.employees} detail={`${totals.overdueEmployees} overdue`} tone="text-red-400" />
        <CommandStatRow icon={<ClipboardCheck className="h-6 w-6" />} label="Open Actions" value={totals.openActions} detail="Across all jobsites" tone="text-slate-300" />
        <CommandStatRow icon={<Shield className="h-6 w-6" />} label="Avg. Site Risk" value={totals.riskScore} detail={dataset.mode === "live" ? "Live score" : "Elevated"} tone="text-red-400" />
      </div>

      <Link href="/safe-predict/risk-mitigation#prioritized-risk-queue" className="mt-5 inline-flex items-center gap-2 px-2 text-sm font-black uppercase tracking-wide text-blue-300 hover:text-blue-100">
        View Source
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function ActionPriorityRail({ actions }: { actions: SafePredictDataset["actions"] }) {
  const openActions = actions.filter((action) => action.status !== "Closed");
  const counts = {
    high: openActions.filter((action) => action.priority === "critical" || action.priority === "high").length,
    medium: openActions.filter((action) => action.priority === "medium").length,
    low: 0,
  };
  const rows = [
    { label: "High Priority", value: counts.high, className: "border-red-300/25 bg-red-500/8 text-red-300", icon: "text-red-400" },
    { label: "Medium Priority", value: counts.medium, className: "border-orange-300/25 bg-orange-500/8 text-orange-300", icon: "text-orange-400" },
    { label: "Low Priority", value: counts.low, className: "border-emerald-300/25 bg-emerald-500/8 text-emerald-300", icon: "text-emerald-400" },
  ];

  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-800 bg-[linear-gradient(180deg,#071d34_0%,#041426_100%)] p-4 pr-6 text-white shadow-[0_24px_60px_rgba(2,6,23,0.28)]">
      <div className="absolute right-0 top-0 h-full w-4 bg-[repeating-linear-gradient(135deg,rgba(245,158,11,0.8)_0_5px,transparent_5px_11px)] opacity-70" aria-hidden />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Open Actions</p>
      <p className="mt-2 text-4xl font-black text-red-400">{openActions.length}</p>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <Link key={row.label} href="/safe-predict/risk-mitigation#corrective-action-tracker" className={cx("group flex min-h-[74px] items-center gap-2 rounded-lg border px-3 py-3 transition hover:bg-white/10", row.className)}>
            <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-current/25 bg-slate-950/36", row.icon)}>
              <ShieldAlert className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[13px] font-black leading-tight text-slate-200">{row.label}</span>
              <span className="mt-1 block text-xl font-black">{row.value}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
          </Link>
        ))}
      </div>
      <Link href="/safe-predict/risk-mitigation#corrective-action-tracker" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-300 hover:text-blue-100">
        View all actions
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function CommandSparkline({ data, color = "#ef4444" }: { data: number[]; color?: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const spread = Math.max(1, max - min);
  const points = data
    .map((value, index) => {
      const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
      const y = 34 - ((value - min) / spread) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 38" className="h-full w-full" role="img" aria-label="Recent trend sparkline" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CommandForecastChart({
  data,
  selectedIndex,
  onSelectIndex,
}: {
  data: SafePredictForecastPoint[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}) {
  const chartPoints = data.map((point, index) => ({
    point,
    index,
    x: data.length <= 1 ? 36 : 36 + (index / (data.length - 1)) * 520,
    y: 235 - (point.predictedRisk / 100) * 190,
  }));
  const plot = (key: "predictedRisk" | "historicalRisk") =>
    data
      .map((point, index) => {
        const value = point[key];
        if (typeof value !== "number") return null;
        const x = data.length <= 1 ? 36 : 36 + (index / (data.length - 1)) * 520;
        const y = 235 - (value / 100) * 190;
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");
  const predicted = plot("predictedRisk");
  const historical = plot("historicalRisk");
  const area = predicted ? `36,235 ${predicted} 556,235` : "";
  const selectedPoint = chartPoints[selectedIndex];
  const handlePointKeyDown = (event: KeyboardEvent<SVGGElement>, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectIndex(index);
    }
  };

  return (
    <div className="relative mt-3 h-[285px] w-full">
      <svg viewBox="0 0 590 270" className="h-full w-full overflow-visible" role="img" aria-label="Predictive risk trend chart">
        <defs>
          <linearGradient id="commandForecastRiskBand" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fecaca" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.34" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = 235 - (tick / 100) * 190;
          return (
            <g key={tick}>
              <line x1="36" x2="556" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="5 5" />
              <text x="10" y={y + 4} fill="#64748b" fontSize="11" fontWeight="700">{tick}</text>
            </g>
          );
        })}
        {area ? <polygon points={area} fill="url(#commandForecastRiskBand)" /> : null}
        {historical ? <polyline points={historical} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {predicted ? <polyline points={predicted} fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {selectedPoint ? (
          <g aria-hidden>
            <line x1={selectedPoint.x} x2={selectedPoint.x} y1="45" y2="235" stroke="#2563eb" strokeDasharray="4 4" />
            <circle cx={selectedPoint.x} cy={selectedPoint.y} r="16" fill="#2563eb" opacity="0.14" />
          </g>
        ) : null}
        {chartPoints.map(({ point, index, x, y }) => {
          const isSelected = selectedIndex === index;
          return (
            <g
              key={`${point.date}-${index}-point`}
              role="button"
              tabIndex={0}
              data-testid="forecast-risk-point"
              onClick={() => onSelectIndex(index)}
              onKeyDown={(event) => handlePointKeyDown(event, index)}
              aria-pressed={isSelected}
              aria-label={`Show why risk is elevated on ${point.date}: ${point.predictedRisk} risk score`}
              className="cursor-pointer focus:outline-none"
            >
              <circle cx={x} cy={y} r="13" fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={isSelected ? "6.5" : "5"}
                fill={isSelected ? "#2563eb" : "#f97316"}
                stroke="#ffffff"
                strokeWidth={isSelected ? "3" : "2"}
              />
            </g>
          );
        })}
        {data.map((point, index) => {
          const x = data.length <= 1 ? 36 : 36 + (index / (data.length - 1)) * 520;
          const label = index === 0 ? "Now" : index % 2 === 0 ? point.date : "";
          return label ? <text key={`${point.date}-${index}`} x={x} y="258" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="700">{label}</text> : null;
        })}
      </svg>
    </div>
  );
}

function ForecastReasonPanel({ reason }: { reason: SafePredictForecastReason }) {
  return (
    <div data-testid="forecast-risk-reason-panel" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Why risk is elevated</p>
          <p className="mt-1 text-xs font-black uppercase tracking-wide text-blue-700">Selected point: {reason.date}</p>
          <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{reason.headline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RiskBadge level={reason.riskLevel} />
          <span className="text-sm font-black text-slate-900">{reason.score}/100</span>
        </div>
      </div>
      {reason.topDrivers.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {reason.topDrivers.map((driver) => (
            <div key={driver.id} className="rounded-md border border-white bg-white px-3 py-2 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{driver.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{driver.evidence}</p>
                </div>
                <span className="shrink-0 text-xs font-black text-slate-500">{driver.score}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
          {reason.missingDataNote}
        </p>
      )}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{reason.nextAction}</span>
      </div>
    </div>
  );
}

function CommandKpiStrip({
  totals,
  completedInspections,
  complianceRate,
  liveWithoutRiskData,
  liveWithoutForecast,
  liveWithoutOpenActions,
  liveWithoutCompletedInspections,
}: {
  totals: ReturnType<typeof summarizeSafePredictDataset>;
  completedInspections: number;
  complianceRate: number;
  liveWithoutRiskData: boolean;
  liveWithoutForecast: boolean;
  liveWithoutOpenActions: boolean;
  liveWithoutCompletedInspections: boolean;
}) {
  const overallRiskLevel = riskLevelForScore(totals.riskScore);
  const overallRiskTone = liveWithoutRiskData ? "text-slate-300" : commandRiskToneClass(overallRiskLevel);
  const overallRiskSparklineColor = commandRiskSparklineColor(overallRiskLevel);
  const kpis = [
    {
      title: "Overall Site Risk Score",
      value: totals.riskScore,
      suffix: "/100",
      detail: liveWithoutRiskData ? "No Data" : `${riskLabel(overallRiskLevel)} Risk`,
      tone: overallRiskTone,
      icon: <ShieldAlert className="h-7 w-7" />,
      sparkline: liveWithoutRiskData ? undefined : <CommandSparkline data={[42, 47, 58, 44, 46, 56, 54]} color={overallRiskSparklineColor} />,
      href: "/safe-predict/risk-mitigation#prioritized-risk-queue",
      sourceLabel: "Open risk guide",
    },
    {
      title: "Predicted Incident Risk",
      value: liveWithoutForecast ? "No Data" : "24%",
      detail: liveWithoutForecast ? "Waiting for forecast" : "High",
      tone: "text-orange-400",
      icon: <TrendingUp className="h-7 w-7" />,
      sparkline: liveWithoutForecast ? undefined : <CommandSparkline data={[20, 22, 31, 28, 35, 38, 47]} color="#f97316" />,
      href: "/safe-predict/predictive-risk#forecast-drivers",
      sourceLabel: "Open forecast",
    },
    {
      title: "Open Corrective Actions",
      value: totals.openActions,
      detail: liveWithoutOpenActions ? "None Open" : "High Priority",
      tone: "text-red-400",
      icon: <ClipboardCheck className="h-7 w-7" />,
      href: "/safe-predict/risk-mitigation#corrective-action-tracker",
      sourceLabel: "Open action tracker",
    },
    {
      title: "Completed Inspections",
      value: completedInspections,
      detail: liveWithoutCompletedInspections ? "None Completed" : "This Week",
      tone: "text-emerald-400",
      icon: <ShieldCheck className="h-7 w-7" />,
      href: "/safe-predict/inspections",
      sourceLabel: "Open inspection rows",
    },
    {
      title: "Training Compliance Rate",
      value: `${complianceRate}%`,
      detail: "Compliant",
      tone: "text-emerald-400",
      icon: <GraduationCap className="h-7 w-7" />,
      href: "/safe-predict/workforce#training-matrix",
      sourceLabel: "Open training matrix",
    },
  ];

  return (
    <section className="mt-5 grid overflow-hidden rounded-lg border border-slate-800 bg-[linear-gradient(90deg,#071d34_0%,#031426_100%)] shadow-[0_24px_60px_rgba(2,6,23,0.24)] md:grid-cols-2 2xl:grid-cols-[repeat(5,minmax(0,1fr))_260px]">
      {kpis.map((item) => (
        <Link key={item.title} href={item.href} className="group min-w-0 border-b border-white/10 p-5 text-white transition hover:bg-white/5 md:border-r 2xl:border-b-0">
          <div className="flex items-start gap-4">
            <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/15 bg-white/6", item.tone)}>
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{item.title}</p>
              <div className="mt-3 flex items-end gap-2">
                <p className={cx("text-4xl font-black leading-none", item.tone)}>{item.value}</p>
                {"suffix" in item && item.suffix ? <p className="pb-1 text-sm font-bold text-slate-300">{item.suffix}</p> : null}
              </div>
              <p className={cx("mt-2 text-sm font-black", item.tone)}>{item.detail}</p>
            </div>
          </div>
          {item.sparkline ? <div className="mt-4 h-[44px]">{item.sparkline}</div> : <div className="mt-4 h-[44px]" />}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-blue-300">
            {item.sourceLabel}
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
      <div className="hidden items-center justify-center border-l border-white/10 p-4 2xl:flex">
        <div className="relative h-full min-h-[150px] w-full overflow-hidden rounded-lg border border-blue-300/15 bg-[linear-gradient(135deg,rgba(59,130,246,0.22),rgba(3,7,18,0.82))] p-5">
          <p className="relative z-10 mt-8 text-lg font-black text-white">Work safe today.<br />Go home safe.</p>
          <p className="relative z-10 mt-4 text-xs font-semibold leading-5 text-slate-300">Every action. Every worker. Every day.</p>
          <div className="absolute bottom-4 right-4 h-24 w-28 border border-blue-300/30 opacity-70" />
          <div className="absolute bottom-8 right-10 h-24 w-px bg-blue-200/30" />
          <div className="absolute bottom-8 right-16 h-20 w-px bg-blue-200/30" />
        </div>
      </div>
    </section>
  );
}

export default function SafePredictDashboardPage() {
  const { dataset, selectedJobsiteId, setSelectedJobsiteId, loading } = useSafePredictData();
  const [forecastWindow, setForecastWindow] = useState<ForecastWindow>(30);
  const [selectedForecastPoint, setSelectedForecastPoint] = useState<{ key: string; index: number } | null>(null);
  const totals = summarizeSafePredictDataset(dataset);
  const selectedSiteId = selectedJobsiteId || "all";
  const forecast = useMemo(() => riskForecastForSite(dataset, selectedSiteId), [dataset, selectedSiteId]);
  const hasForecastInputs = hasSafePredictForecastInputs(dataset, selectedSiteId);
  const displayedForecast = useMemo(
    () => extendForecastWindow(forecast, forecastWindow),
    [forecast, forecastWindow]
  );
  const forecastReasons = useMemo(
    () => forecastReasonsForSite(dataset, selectedSiteId, displayedForecast),
    [dataset, displayedForecast, selectedSiteId]
  );
  const defaultForecastIndex = useMemo(
    () => highestForecastRiskIndex(displayedForecast),
    [displayedForecast]
  );
  const forecastSelectionKey = `${selectedSiteId}:${forecastWindow}:${displayedForecast.map((point) => `${point.date}-${point.predictedRisk}`).join("|")}`;
  const activeForecastIndex =
    selectedForecastPoint?.key === forecastSelectionKey && selectedForecastPoint.index >= 0 && selectedForecastPoint.index < displayedForecast.length
      ? selectedForecastPoint.index
      : defaultForecastIndex;
  const activeForecastReason = forecastReasons[activeForecastIndex] ?? forecastReasons[0] ?? null;
  const hasForecast = hasForecastInputs && displayedForecast.length > 0;
  const completedInspections = dataset.inspections.filter((inspection) => inspection.status === "Completed").length;
  const complianceRate = totals.workforce.compliantPercent;
  const liveWithoutRiskData = dataset.mode === "live" && totals.riskScore === 0 && !hasForecastInputs;
  const liveWithoutForecast = dataset.mode === "live" && !hasForecast;
  const liveWithoutOpenActions = dataset.mode === "live" && totals.openActions === 0;
  const liveWithoutCompletedInspections = dataset.mode === "live" && completedInspections === 0;
  const selectedCommandSite =
    dataset.jobsites.find((site) => site.id === selectedSiteId) ?? (selectedSiteId === "all" ? highestRiskJobsite(dataset.jobsites) : null) ?? dataset.jobsites[0] ?? null;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[linear-gradient(180deg,#f5f9ff_0%,#eef4fb_58%,#f8fbff_100%)] px-4 pb-8 sm:px-7">
      <div className="flex flex-col gap-4 py-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0">
          <h1 className="font-app-display text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
          <p className="mt-2 text-base text-slate-600">Executive Overview</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 2xl:w-auto 2xl:justify-end">
          <SelectShell
            value={selectedJobsiteId}
            onChange={setSelectedJobsiteId}
            options={[
              { label: "All Sites", value: "all" },
              ...dataset.jobsites.map((site) => ({ label: site.name, value: site.id })),
            ]}
            className="2xl:min-w-[360px]"
          />
          <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">
            <CalendarDays className="h-4 w-4" aria-hidden />
            May 11 - May 17, 2025
          </span>
          <ExportButton
            fileName="safe-predict-dashboard.json"
            label="Export dashboard snapshot"
            payload={{ company: dataset.company, jobsites: dataset.jobsites, employees: dataset.employees, alerts: dataset.alerts, mitigations: safePredictMitigations, actions: dataset.actions, permits: dataset.permits }}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            <Download className="h-4 w-4" />
            Export
          </ExportButton>
        </div>
      </div>

      <section className="grid gap-3 2xl:grid-cols-[320px_minmax(0,1fr)_280px]">
        <CompanyCommandPanel dataset={dataset} totals={totals} loading={loading} />
        <div className="min-w-0">
          <JobsiteRiskMap jobsites={dataset.jobsites} selectedJobsiteId={selectedJobsiteId} onSelectJobsite={setSelectedJobsiteId} />
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 shadow-sm xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Selected focus</span>
                <span className="mt-1 block truncate text-base font-black text-slate-950">{selectedCommandSite?.name ?? "No jobsite selected"}</span>
              </span>
              {selectedCommandSite ? <RiskBadge level={selectedCommandSite.riskLevel} /> : null}
            </div>
          </div>
        </div>
        <ActionPriorityRail actions={dataset.actions} />
      </section>

      <CommandKpiStrip
        totals={totals}
        completedInspections={completedInspections}
        complianceRate={complianceRate}
        liveWithoutRiskData={liveWithoutRiskData}
        liveWithoutForecast={liveWithoutForecast}
        liveWithoutOpenActions={liveWithoutOpenActions}
        liveWithoutCompletedInspections={liveWithoutCompletedInspections}
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-2 min-[1900px]:grid-cols-[1.18fr_0.9fr_1.05fr_0.78fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Predictive Risk Trend" />
            <div className="hidden rounded-lg border border-slate-200 bg-white p-1 sm:flex">
              {([30, 60, 90] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setForecastWindow(days)}
                  aria-pressed={forecastWindow === days}
                  className={cx("rounded-md px-3 py-1.5 text-xs font-bold", forecastWindow === days ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50")}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>
          {hasForecast ? (
            <>
              <div className="mt-4 inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                AI models indicate risk levels will remain elevated over the next {forecastWindow} days.
              </div>
              <CommandForecastChart
                data={displayedForecast}
                selectedIndex={activeForecastIndex}
                onSelectIndex={(index) => setSelectedForecastPoint({ key: forecastSelectionKey, index })}
              />
              {activeForecastReason ? <ForecastReasonPanel reason={activeForecastReason} /> : null}
              <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-red-500" /> Historical Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-orange-500" /> Predicted Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-200" /> High Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-200" /> Medium Risk</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-200" /> Low Risk</span>
              </div>
            </>
          ) : (
            <EmptySafePredictPanel title="No live forecast yet" detail="Add a jobsite plus inspections, observations, incidents, corrective actions, permits, or workforce records before SafetyDoc360 shows a predictive trend." />
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Risk Heat Map by Trade / Area" action={<Link href="/safe-predict/risk-mitigation" className="text-sm font-bold text-blue-600">View Full Map</Link>} />
          <div className="mt-4 grid gap-3">
            {dataset.mode === "live" ? <LiveDashboardRiskMap jobsites={dataset.jobsites} /> : <RiskHeatMap />}
            <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Low</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Medium</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High</span>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-5 pb-2">
            <SectionTitle title="Top Recommended Mitigations" />
          </div>
          <div className="px-5 pb-2">
            <div className="grid grid-cols-[82px_minmax(0,1fr)_92px_72px] gap-3 border-b border-slate-200 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">
              <span>Priority</span>
              <span>Recommendation</span>
              <span>Impact</span>
              <span />
            </div>
            <div className="divide-y divide-slate-100">
              {safePredictMitigations.slice(0, 3).map((item) => (
                <div key={item.id} className="grid grid-cols-[82px_minmax(0,1fr)_92px_72px] items-center gap-3 py-4 text-xs">
                  <RiskBadge level={item.priority} />
                  <span className="min-w-0">
                    <span className="block font-black leading-snug text-slate-900">{item.recommendation}</span>
                    <span className="mt-1 block text-slate-500">{item.drivers.join(", ")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    <span className="truncate">{item.impact}</span>
                  </span>
                  <Link href={`/safe-predict/risk-mitigation#${item.id}`} className="inline-flex min-h-9 items-center justify-center rounded-md border border-blue-500 px-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
                    Details
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-100 p-5">
            <Link href="/safe-predict/risk-mitigation" className="inline-flex items-center gap-2 font-bold text-blue-600">
              View All Recommendations
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Recent Alerts" action={<Link href="/safe-predict/risk-mitigation" className="text-sm font-bold text-blue-600">View All Alerts</Link>} />
          <div className="mt-4 divide-y divide-slate-100">
            {dataset.alerts.slice(0, 4).map((alert) => (
              <Link key={alert.id} href={`/safe-predict/risk-mitigation#${alert.id}`} className="flex items-start gap-3 py-4 first:pt-0 hover:bg-slate-50">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", alert.riskLevel === "critical" || alert.riskLevel === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-800")}>
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-slate-900">{alert.title}</span>
                  <span className="mt-1 block truncate text-sm text-slate-600">{alert.site}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{alert.timeAgo}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
