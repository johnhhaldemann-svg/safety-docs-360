"use client";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Box,
  Clock,
  Crosshair,
  FileImage,
  Layers3,
  MapPin,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  isFailedSiteVisualJobStatus,
  isFinishedSiteVisualJobStatus,
  mergeSiteVisualZoneSavePayload,
  nextSelectedSiteVisualZoneId,
  siteVisualPollTimeoutMessage,
} from "@/lib/jobsiteSiteVisualClientState";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";

type Vector3 = { x: number; y: number; z: number };
type RiskLevel = "low" | "medium" | "high" | "critical";
type ViewMode = "isometric" | "top";
type VisualSurfaceMode = "detailed" | "schematic";
type VisualOverlap = { id: string; zoneIds: [string, string]; severity: "medium" | "high" | "critical"; label: string; reason: string };
type BlueprintBounds = { x: number; y: number; width: number; height: number };
type BlueprintTransform = { x: number; z: number; scale: number; rotationY: number; opacity: number; width: number; height: number };

type SiteVisualBlueprint = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  pageNumber: number;
  processingStatus: "pending" | "uploaded" | "processing" | "ready" | "failed" | "archived" | string;
  previewImagePath: string | null;
  signedPreviewUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  transform: BlueprintTransform;
  processingError: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type RenderOverlayActivity = {
  id: string;
  zoneId: string;
  number: number;
  label: string;
  subtitle: string;
  riskLevel: RiskLevel;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type SiteVisualRender = {
  id: string;
  siteMapId: string | null;
  blueprintId: string | null;
  renderStatus: string;
  promptHash: string | null;
  imagePath: string | null;
  thumbnailPath: string | null;
  signedImageUrl: string | null;
  signedThumbnailUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  overlay: {
    version: 1;
    imageAspect: "16:9";
    disclaimer: string;
    activities: RenderOverlayActivity[];
    overlaps: Array<{ id: string; zoneIds: [string, string]; severity: VisualOverlap["severity"]; label: string; reason: string; x: number; y: number }>;
  } | null;
  aiMeta?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SiteVisualRenderJob = {
  id: string;
  status: "queued" | "running" | "ready" | "failed" | "fallback_ready" | string;
  progress: number;
  stage: string;
  statusUrl?: string;
  errorType?: string | null;
  errorMessage?: string | null;
  renderId?: string | null;
};

type SiteVisualMapJob = SiteVisualRenderJob & {
  siteMapId?: string | null;
};

type VisualZone = {
  id: string;
  label: string;
  sourceType: string;
  sourceId: string | null;
  scheduleItemId: string | null;
  trade: string | null;
  workArea: string | null;
  startsAt: string | null;
  endsAt: string | null;
  riskLevel: RiskLevel;
  controls: string[];
  position: Vector3;
  size: Vector3;
  color: string;
  blueprintBounds?: BlueprintBounds | null;
};

type VisualScene = {
  version: 1;
  levels: Array<{ id: string; label: string; elevation: number; height: number }>;
  areas: Array<{ id: string; label: string; levelId: string; position: Vector3; size: Vector3; color: string; blueprintBounds?: BlueprintBounds | null }>;
  zones: VisualZone[];
  overlaps: VisualOverlap[];
  camera: { position: Vector3; target: Vector3 };
  blueprint: { id: string | null; imageWidth: number; imageHeight: number; transform: BlueprintTransform } | null;
};

type SiteVisualPayload = {
  jobsite?: { name?: string | null; location?: string | null; project_number?: string | null; jobsite_number?: string | null };
  siteMap?: { id: string; blueprintId?: string | null; generationStatus?: string | null; aiMeta?: Record<string, unknown> | null; updatedAt?: string | null } | null;
  scene?: VisualScene | null;
  zones?: VisualZone[];
  blueprint?: SiteVisualBlueprint | null;
  blueprints?: SiteVisualBlueprint[];
  render?: SiteVisualRender | null;
  canGenerate?: boolean;
  canEditZones?: boolean;
  canUploadBlueprints?: boolean;
  warning?: string;
  error?: string;
};

const EMPTY_VISUAL_ZONES: VisualZone[] = [];

function formatDateTime(value?: string | null) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed);
}

function riskTone(level: RiskLevel): "neutral" | "success" | "warning" | "info" {
  if (level === "critical" || level === "high") return "warning";
  if (level === "low") return "success";
  return "info";
}

function severityTone(level: VisualOverlap["severity"]): "neutral" | "success" | "warning" | "info" {
  return level === "medium" ? "info" : "warning";
}

function overlapZoneIds(scene: VisualScene | null) {
  return new Set((scene?.overlaps ?? []).flatMap((overlap) => overlap.zoneIds));
}

function riskColor(level: RiskLevel) {
  if (level === "critical") return "#ef4444";
  if (level === "high") return "#f97316";
  if (level === "medium") return "#f59e0b";
  return "#10b981";
}

function severityColor(level: VisualOverlap["severity"]) {
  if (level === "critical") return "#ef4444";
  if (level === "high") return "#f97316";
  return "#f59e0b";
}

function sourceLabel(sourceType?: string | null) {
  if (!sourceType) return "Task";
  return sourceType
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function zoneImpactText(zone: VisualZone, impactCount: number) {
  const area = zone.workArea ?? "the mapped work area";
  const trade = zone.trade ?? sourceLabel(zone.sourceType).toLowerCase();
  if (impactCount > 0) {
    return `${zone.label} places ${trade} work in ${area} during the same window as ${impactCount} nearby zone${impactCount === 1 ? "" : "s"}. Review sequencing, access routes, barricades, and crew separation before work starts.`;
  }
  return `${zone.label} is mapped in ${area}. No current geometry-and-schedule overlap is flagged, but the zone should still be checked against access paths, permits, and daily field conditions.`;
}

function zoneImpacts(scene: VisualScene | null, zoneId: string | null) {
  if (!scene || !zoneId) return [];
  return scene.overlaps
    .filter((overlap) => overlap.zoneIds.includes(zoneId))
    .map((overlap) => {
      const otherZoneId = overlap.zoneIds.find((id) => id !== zoneId) ?? overlap.zoneIds[0];
      return {
        overlap,
        otherZone: scene.zones.find((zone) => zone.id === otherZoneId) ?? null,
      };
    });
}

function clampVisual(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function activityCalloutPosition(activity: RenderOverlayActivity, index: number) {
  const rightSide = activity.x < 0.56;
  const offsetX = 0.1 + (index % 2) * 0.025;
  const labelX = clampVisual(activity.x + (rightSide ? offsetX : -offsetX), 0.16, 0.84);
  const labelY = clampVisual(activity.y - 0.045 + (index % 3) * 0.024, 0.12, 0.84);
  return { labelX, labelY };
}

function getMeshMaterial(color: string, selected: boolean, overlapped: boolean) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: selected ? 0.94 : overlapped ? 0.88 : 0.82,
    roughness: 0.55,
    metalness: 0.02,
    emissive: selected ? new THREE.Color("#dbeafe") : overlapped ? new THREE.Color("#451a03") : new THREE.Color("#000000"),
    emissiveIntensity: selected ? 0.25 : overlapped ? 0.18 : 0,
  });
}

function makeLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(15,23,42,0.32)";
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 34px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(text.slice(0, 34), 28, 73);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(7.8, 1.75, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function sceneBounds(scene: VisualScene) {
  const points = [...scene.areas, ...scene.zones].flatMap((item) => {
    const halfX = Math.max(1, item.size.x / 2);
    const halfZ = Math.max(1, item.size.z / 2);
    return [
      { x: item.position.x - halfX, z: item.position.z - halfZ },
      { x: item.position.x + halfX, z: item.position.z + halfZ },
    ];
  });
  if (!points.length) {
    const center = new THREE.Vector3(scene.camera.target.x, 0, scene.camera.target.z);
    return { center, span: 48, minX: -24, maxX: 24, minZ: -24, maxZ: 24 };
  }
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const span = Math.max(34, maxX - minX, maxZ - minZ) + 18;
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  return { center, span, minX, maxX, minZ, maxZ };
}

function SiteVisualRenderer({
  scene,
  selectedZoneId,
  showOverlapsOnly,
  viewMode,
  onSelectZone,
}: {
  scene: VisualScene;
  selectedZoneId: string | null;
  showOverlapsOnly: boolean;
  viewMode: ViewMode;
  onSelectZone: (zoneId: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 560;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0xf8fbff, 1);
    renderer.domElement.style.cursor = "pointer";
    mount.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0xf8fbff);
    threeScene.fog = new THREE.Fog(0xf8fbff, 95, 180);
    const bounds = sceneBounds(scene);
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      (-bounds.span * aspect) / 2,
      (bounds.span * aspect) / 2,
      bounds.span / 2,
      -bounds.span / 2,
      0.1,
      500
    );
    const cameraOffset =
      viewMode === "top" ? new THREE.Vector3(0, 96, 0.1) : new THREE.Vector3(42, 56, 42);
    camera.position.copy(bounds.center).add(cameraOffset);
    camera.lookAt(bounds.center.x, 0, bounds.center.z);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(bounds.center);
    controls.enableDamping = true;
    controls.enableRotate = viewMode !== "top";
    controls.enablePan = true;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minZoom = 0.55;
    controls.maxZoom = 2.9;

    threeScene.add(new THREE.HemisphereLight(0xffffff, 0x8ea0b8, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(20, 36, 18);
    threeScene.add(keyLight);
    const grid = new THREE.GridHelper(bounds.span + 14, Math.max(18, Math.round(bounds.span / 3)), 0x93a4ba, 0xdbe3ef);
    grid.position.set(bounds.center.x, 0, bounds.center.z);
    threeScene.add(grid);

    const overlapIds = overlapZoneIds(scene);
    const zoneMeshes = new Map<string, THREE.Mesh>();
    const clickable: THREE.Mesh[] = [];

    for (const area of scene.areas) {
      const geometry = new THREE.BoxGeometry(area.size.x, 0.18, area.size.z);
      const material = new THREE.MeshStandardMaterial({ color: area.color, transparent: true, opacity: 0.38, roughness: 0.9 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(area.position.x, 0.08, area.position.z);
      threeScene.add(mesh);
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x94a3b8 })
      );
      outline.position.copy(mesh.position);
      threeScene.add(outline);
      const label = makeLabelSprite(area.label);
      label.position.set(area.position.x, 1.4, area.position.z - area.size.z / 2 - 1.35);
      threeScene.add(label);
    }

    for (const zone of scene.zones) {
      const isOverlapped = overlapIds.has(zone.id);
      if (showOverlapsOnly && !isOverlapped) continue;
      const zoneColor = riskColor(zone.riskLevel);
      const geometry = new THREE.BoxGeometry(zone.size.x, zone.size.y, zone.size.z);
      const mesh = new THREE.Mesh(geometry, getMeshMaterial(zoneColor, zone.id === selectedZoneId, isOverlapped));
      mesh.position.set(zone.position.x, zone.position.y, zone.position.z);
      mesh.userData.zoneId = zone.id;
      threeScene.add(mesh);
      zoneMeshes.set(zone.id, mesh);
      clickable.push(mesh);

      if (zone.id === selectedZoneId) {
        const shellGeometry = new THREE.BoxGeometry(zone.size.x + 0.9, zone.size.y + 0.9, zone.size.z + 0.9);
        const shell = new THREE.Mesh(
          shellGeometry,
          new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.16, depthWrite: false })
        );
        shell.position.copy(mesh.position);
        threeScene.add(shell);
      }

      if (isOverlapped) {
        const baseGeometry = new THREE.BoxGeometry(zone.size.x + 0.35, 0.24, zone.size.z + 0.35);
        const base = new THREE.Mesh(
          baseGeometry,
          new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.86 })
        );
        base.position.set(zone.position.x, 0.14, zone.position.z);
        threeScene.add(base);
      }

      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: zone.id === selectedZoneId ? 0x0f172a : isOverlapped ? 0x111827 : 0xffffff })
      );
      line.position.copy(mesh.position);
      threeScene.add(line);

      const label = makeLabelSprite(zone.label);
      label.position.set(zone.position.x, zone.position.y + zone.size.y / 2 + 1.1, zone.position.z);
      threeScene.add(label);
    }

    for (const overlap of scene.overlaps) {
      const [firstZoneId, secondZoneId] = overlap.zoneIds;
      const firstZone = scene.zones.find((zone) => zone.id === firstZoneId);
      const secondZone = scene.zones.find((zone) => zone.id === secondZoneId);
      if (!firstZone || !secondZone || !zoneMeshes.has(firstZone.id) || !zoneMeshes.has(secondZone.id)) continue;
      const isSelectedImpact = selectedZoneId ? overlap.zoneIds.includes(selectedZoneId) : false;
      const points = [
        new THREE.Vector3(firstZone.position.x, firstZone.position.y + firstZone.size.y / 2 + 0.7, firstZone.position.z),
        new THREE.Vector3(secondZone.position.x, secondZone.position.y + secondZone.size.y / 2 + 0.7, secondZone.position.z),
      ];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: isSelectedImpact ? 0x111827 : 0xf59e0b,
          transparent: true,
          opacity: isSelectedImpact ? 0.95 : 0.42,
        })
      );
      threeScene.add(line);
      if (isSelectedImpact) {
        const midpoint = new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5);
        const label = makeLabelSprite(`${overlap.severity.toUpperCase()} overlap`);
        label.position.set(midpoint.x, midpoint.y + 1.05, midpoint.z);
        threeScene.add(label);
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0];
      const zoneId = hit?.object.userData.zoneId;
      if (typeof zoneId === "string") onSelectZone(zoneId);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      for (const [zoneId, mesh] of zoneMeshes) {
        if (overlapIds.has(zoneId)) mesh.rotation.y += 0.002;
      }
      renderer.render(threeScene, camera);
    };
    animate();

    const handleResize = () => {
      const nextWidth = mount.clientWidth || width;
      const nextHeight = mount.clientHeight || height;
      renderer.setSize(nextWidth, nextHeight);
      const nextAspect = nextWidth / nextHeight;
      camera.left = (-bounds.span * nextAspect) / 2;
      camera.right = (bounds.span * nextAspect) / 2;
      camera.top = bounds.span / 2;
      camera.bottom = -bounds.span / 2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.dispose();
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [scene, selectedZoneId, showOverlapsOnly, viewMode, onSelectZone]);

  return (
    <div className="relative h-[640px] min-h-[460px] w-full overflow-hidden rounded-xl border border-[var(--app-border)] bg-[#f8fbff]">
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 grid gap-2 rounded-xl border border-white/80 bg-white/95 p-3 text-xs font-bold text-slate-700 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-3 w-6 rounded-sm border border-slate-300 bg-sky-100" />
          Work area plate
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-6 rounded-sm bg-red-500" />
          Critical task zone
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-6 rounded-sm bg-orange-500" />
          High-risk task zone
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-6 rounded-sm bg-slate-950" />
          Overlap flagged
        </div>
      </div>
    </div>
  );
}

function DetailedVisualRenderer({
  render,
  scene,
  selectedZoneId,
  onSelectZone,
}: {
  render: SiteVisualRender;
  scene: VisualScene | null;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}) {
  const activities = render.overlay?.activities ?? [];
  const overlaps = render.overlay?.overlaps ?? [];
  const selectedActivity = activities.find((activity) => activity.zoneId === selectedZoneId) ?? activities[0] ?? null;
  const zoneMap = new Map((scene?.zones ?? []).map((zone) => [zone.id, zone]));
  const activityByZone = new Map(activities.map((activity) => [activity.zoneId, activity]));
  const selectedOverlapZoneIds = new Set(
    overlaps
      .filter((overlap) => (selectedZoneId ? overlap.zoneIds.includes(selectedZoneId) : false))
      .flatMap((overlap) => overlap.zoneIds)
  );
  const callouts = activities.map((activity, index) => ({ activity, ...activityCalloutPosition(activity, index) }));
  const overlapPaths = overlaps.map((overlap, index) => {
    const first = activityByZone.get(overlap.zoneIds[0]);
    const second = activityByZone.get(overlap.zoneIds[1]);
    return {
      overlap,
      index,
      first,
      second,
      x: overlap.x * 100,
      y: overlap.y * 56.25,
      color: severityColor(overlap.severity),
      selected: selectedZoneId ? overlap.zoneIds.includes(selectedZoneId) : false,
    };
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
      <div className="relative aspect-video min-h-[360px] bg-slate-900">
        {render.signedImageUrl ? (
          <img src={render.signedImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-sm font-semibold text-slate-300">
            Detailed visual is not available.
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/24 via-transparent to-slate-950/24" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
          {overlapPaths.map(({ overlap, index, first, second, x, y, color, selected }) => (
            <g key={`path-${overlap.id}`}>
              {first && second ? (
                <>
                  <line
                    x1={first.x * 100}
                    y1={first.y * 56.25}
                    x2={second.x * 100}
                    y2={second.y * 56.25}
                    stroke={color}
                    strokeWidth={selected ? 0.95 : 0.6}
                    strokeLinecap="round"
                    opacity={selected ? 0.95 : 0.74}
                  />
                  <line
                    x1={first.x * 100}
                    y1={first.y * 56.25}
                    x2={second.x * 100}
                    y2={second.y * 56.25}
                    stroke="#ffffff"
                    strokeWidth={0.16}
                    strokeDasharray="1 1"
                    strokeLinecap="round"
                    opacity={0.78}
                  />
                </>
              ) : null}
              <ellipse
                cx={x}
                cy={y}
                rx={selected ? 5.8 : 4.5}
                ry={selected ? 2.4 : 1.85}
                fill={color}
                fillOpacity={selected ? 0.42 : 0.3}
                stroke={color}
                strokeWidth={selected ? 0.55 : 0.36}
              />
              <rect
                x={clampVisual(x - 6.2, 1, 86)}
                y={clampVisual(y - 2.2, 1, 52)}
                width="12.4"
                height="4.4"
                rx="0.8"
                fill="#111827"
                stroke={color}
                strokeWidth="0.24"
                opacity="0.94"
              />
              <text
                x={clampVisual(x, 7.2, 92.8)}
                y={clampVisual(y + 0.25, 3.2, 54)}
                textAnchor="middle"
                fontSize="1.25"
                fontWeight="900"
                fill="#ffffff"
              >
                {`OVERLAP ${index + 1}`}
              </text>
            </g>
          ))}
          {callouts.map(({ activity, labelX, labelY }) => {
            const isSelected = activity.zoneId === selectedZoneId;
            const isAffected = selectedOverlapZoneIds.has(activity.zoneId);
            const strokeWidth = isSelected ? 0.34 : isAffected ? 0.28 : 0.18;
            return (
              <g key={activity.id}>
                <line
                  x1={activity.x * 100}
                  y1={activity.y * 56.25}
                  x2={labelX * 100}
                  y2={labelY * 56.25}
                  stroke={activity.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isAffected && !isSelected ? "1 1" : undefined}
                />
                <ellipse
                  cx={activity.x * 100}
                  cy={activity.y * 56.25}
                  rx={isSelected ? 3.2 : isAffected ? 2.7 : 2.15}
                  ry={isSelected ? 1.35 : isAffected ? 1.15 : 0.9}
                  fill={activity.color}
                  fillOpacity={isSelected ? 0.36 : isAffected ? 0.28 : 0.18}
                  stroke={activity.color}
                  strokeWidth={isSelected ? 0.35 : 0.2}
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute left-3 top-3 hidden w-56 rounded-lg border border-white/20 bg-slate-950/88 p-3 text-white shadow-2xl backdrop-blur md:block">
          <div className="text-sm font-black uppercase tracking-[0.08em]">Work Activities</div>
          <div className="mt-3 space-y-2">
            {activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                  activity.zoneId === selectedZoneId ? "bg-white/18" : "bg-white/7 hover:bg-white/12"
                }`}
                style={{ borderColor: activity.color }}
                onClick={() => onSelectZone(activity.zoneId)}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-base font-black text-white" style={{ backgroundColor: activity.color }}>
                  {activity.number}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black uppercase">{activity.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-200">{activity.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="absolute right-3 top-3 hidden w-56 rounded-lg border border-white/20 bg-slate-950/88 p-4 text-white shadow-2xl backdrop-blur lg:block">
          <div className="text-sm font-black uppercase tracking-[0.08em]">Overlapping Work</div>
          <p className="mt-2 text-xs leading-5 text-slate-200">
            Multiple crews working in stacked or intersecting zones are highlighted by the app overlay.
          </p>
          <div className="mt-4 border-t border-white/20 pt-4">
            <div className="text-xs font-black uppercase tracking-[0.08em]">Overlap / hazard areas</div>
            <div className="mt-3 space-y-2">
              {overlaps.slice(0, 5).map((overlap, index) => (
                <button
                  key={overlap.id}
                  type="button"
                  className="flex w-full items-start gap-2 rounded-lg border border-white/15 bg-white/8 px-2 py-2 text-left transition hover:bg-white/14"
                  style={{ borderColor: selectedZoneId && overlap.zoneIds.includes(selectedZoneId) ? severityColor(overlap.severity) : undefined }}
                  title={overlap.label}
                  onClick={() => onSelectZone(overlap.zoneIds[0])}
                >
                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: severityColor(overlap.severity) }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-black uppercase text-white">
                      {index + 1}. {overlap.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: severityColor(overlap.severity) }}>
                      {overlap.severity}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {callouts.map(({ activity, labelX, labelY }) => {
          const isSelected = activity.zoneId === selectedZoneId;
          const isAffected = selectedOverlapZoneIds.has(activity.zoneId);
          return (
            <div key={activity.id}>
              <button
                type="button"
                className={`absolute grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-black text-white shadow-[0_0_24px_rgba(255,255,255,0.28)] transition hover:scale-110 ${
                  isSelected ? "ring-4 ring-white/55" : isAffected ? "ring-4 ring-amber-300/45" : ""
                }`}
                style={{
                  backgroundColor: activity.color,
                  borderColor: "#ffffff",
                  left: `${activity.x * 100}%`,
                  top: `${activity.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                title={activity.label}
                onClick={() => onSelectZone(activity.zoneId)}
              >
                {activity.number}
              </button>
              {(isSelected || isAffected) && (
                <button
                  type="button"
                  className={`absolute max-w-[220px] rounded-lg border-2 px-3 py-2 text-left text-white shadow-2xl backdrop-blur transition hover:scale-[1.02] ${
                    isSelected ? "bg-slate-950/92 ring-4 ring-white/45" : "bg-amber-950/86 ring-4 ring-amber-300/30"
                  }`}
                  style={{
                    borderColor: activity.color,
                    left: `${labelX * 100}%`,
                    top: `${labelY * 100}%`,
                    width: `${Math.max(13, activity.width * 100)}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onClick={() => onSelectZone(activity.zoneId)}
                >
                  <span className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-black" style={{ backgroundColor: activity.color }}>
                      {activity.number}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black uppercase">{activity.label}</span>
                      <span className="block truncate text-[11px] text-slate-200">{activity.subtitle}</span>
                    </span>
                  </span>
                </button>
              )}
            </div>
          );
        })}

        {overlaps.map((overlap) => (
          <button
            key={overlap.id}
            type="button"
            className={`absolute h-6 w-6 rounded-full border-2 border-white bg-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.95)] transition hover:scale-110 ${
              selectedZoneId && overlap.zoneIds.includes(selectedZoneId) ? "ring-4 ring-white/55" : ""
            }`}
            style={{ left: `${overlap.x * 100}%`, top: `${overlap.y * 100}%`, transform: "translate(-50%, -50%)" }}
            title={overlap.reason}
            onClick={() => onSelectZone(overlap.zoneIds[0])}
          />
        ))}

        <div className="absolute bottom-3 right-3 hidden max-w-sm rounded-lg border border-white/20 bg-slate-950/88 p-3 text-white shadow-2xl backdrop-blur md:block">
          <div className="flex items-start gap-2">
            <Layers3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-xs font-black uppercase tracking-[0.08em]">Safety Insight</div>
              <p className="mt-1 text-xs leading-5 text-slate-200">
                {selectedActivity
                  ? zoneImpactText(zoneMap.get(selectedActivity.zoneId) ?? {
                      id: selectedActivity.zoneId,
                      label: selectedActivity.label,
                      sourceType: "manual",
                      sourceId: null,
                      scheduleItemId: null,
                      trade: selectedActivity.subtitle,
                      workArea: null,
                      startsAt: null,
                      endsAt: null,
                      riskLevel: selectedActivity.riskLevel,
                      controls: [],
                      position: { x: 0, y: 0, z: 0 },
                      size: { x: 1, y: 1, z: 1 },
                      color: selectedActivity.color,
                    }, overlaps.filter((overlap) => overlap.zoneIds.includes(selectedActivity.zoneId)).length)
                  : "Click a numbered activity to review task impact and nearby overlaps."}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-3 left-3 rounded-md bg-slate-950/82 px-3 py-2 text-[11px] font-semibold text-slate-200 backdrop-blur">
          {render.overlay?.disclaimer ?? "Operational visual aid, not engineering drawing."}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.5,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
      />
    </label>
  );
}

export function JobsiteSiteVisualClient({
  jobsiteId,
  embedded = false,
}: {
  jobsiteId: string;
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renderingDetailed, setRenderingDetailed] = useState(false);
  const [renderJob, setRenderJob] = useState<SiteVisualRenderJob | null>(null);
  const [mapJob, setMapJob] = useState<SiteVisualMapJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [payload, setPayload] = useState<SiteVisualPayload | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showOverlapsOnly, setShowOverlapsOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("isometric");
  const [visualSurfaceMode, setVisualSurfaceMode] = useState<VisualSurfaceMode>("schematic");
  const [draft, setDraft] = useState<VisualZone | null>(null);
  const [blueprintFile, setBlueprintFile] = useState<File | null>(null);
  const [blueprintPage, setBlueprintPage] = useState(1);
  const [uploadingBlueprint, setUploadingBlueprint] = useState(false);
  const [deletingBlueprint, setDeletingBlueprint] = useState(false);

  async function getAuthHeaders() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Missing auth token.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual`, { headers });
      const data = (await response.json().catch(() => null)) as SiteVisualPayload | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load site visual.");
      setPayload(data ?? {});
      setSelectedZoneId((current) => nextSelectedSiteVisualZoneId(current, data?.scene?.zones ?? []));
      if (data?.warning) {
        setMessage(data.warning);
        setMessageTone("warning");
      }
    } catch (error) {
      setPayload(null);
      setMessage(error instanceof Error ? error.message : "Failed to load site visual.");
      setMessageTone("error");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsiteId]);

  const scene = payload?.scene ?? null;
  const zones = scene?.zones ?? EMPTY_VISUAL_ZONES;
  const overlaps = scene?.overlaps ?? [];
  const activeBlueprint = payload?.blueprint ?? payload?.blueprints?.find((item) => item.processingStatus === "ready") ?? payload?.blueprints?.[0] ?? null;
  const activeRender = payload?.render?.renderStatus === "ready" && payload.render.signedImageUrl ? payload.render : null;
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [selectedZoneId, zones]
  );
  const selectedImpacts = useMemo(
    () => zoneImpacts(scene, selectedZoneId),
    [scene, selectedZoneId]
  );

  useEffect(() => {
    setDraft(selectedZone ? structuredClone(selectedZone) : null);
  }, [selectedZone]);

  useEffect(() => {
    if (activeBlueprint?.processingStatus === "ready") setViewMode("top");
  }, [activeBlueprint?.id, activeBlueprint?.processingStatus]);

  useEffect(() => {
    if (activeRender) setVisualSurfaceMode("detailed");
  }, [activeRender?.id]);

  useEffect(() => {
    setSelectedZoneId((current) => nextSelectedSiteVisualZoneId(current, zones));
  }, [zones]);

  function updatePayloadBlueprint(blueprint: SiteVisualBlueprint) {
    setPayload((current) => {
      if (!current) return current;
      const blueprints = current.blueprints ?? [];
      const nextBlueprints = blueprints.some((item) => item.id === blueprint.id)
        ? blueprints.map((item) => (item.id === blueprint.id ? blueprint : item))
        : [blueprint, ...blueprints];
      return { ...current, blueprint, blueprints: nextBlueprints };
    });
  }

  async function uploadBlueprint() {
    if (!blueprintFile) {
      setMessage("Choose a PDF or image blueprint first.");
      setMessageTone("warning");
      return;
    }
    setUploadingBlueprint(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const uploadResponse = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/blueprints/upload-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          fileName: blueprintFile.name,
          mimeType: blueprintFile.type,
          fileSize: blueprintFile.size,
          pageNumber: blueprintPage,
        }),
      });
      const uploadData = (await uploadResponse.json().catch(() => null)) as
        | { error?: string; bucket?: string; path?: string; token?: string; blueprint?: SiteVisualBlueprint }
        | null;
      if (!uploadResponse.ok || !uploadData?.bucket || !uploadData.path || !uploadData.token) {
        throw new Error(uploadData?.error || "Failed to create blueprint upload URL.");
      }

      const supabase = getSupabaseBrowserClient();
      const upload = await supabase.storage
        .from(uploadData.bucket)
        .uploadToSignedUrl(uploadData.path, uploadData.token, blueprintFile, {
          contentType: blueprintFile.type,
        });
      if (upload.error) throw new Error(upload.error.message);

      const blueprintId = uploadData.blueprint?.id;
      if (!blueprintId) throw new Error("Blueprint record was not returned.");
      const processResponse = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/blueprints/${blueprintId}`, {
        method: "POST",
        headers,
      });
      const processData = (await processResponse.json().catch(() => null)) as { error?: string; blueprint?: SiteVisualBlueprint } | null;
      if (!processResponse.ok || !processData?.blueprint) {
        throw new Error(processData?.error || "Blueprint uploaded, but processing failed.");
      }
      updatePayloadBlueprint(processData.blueprint);
      setBlueprintFile(null);
      setMessage("Plan reference processed. Generate the 3D map so AI can draw from the uploaded layout.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Blueprint upload failed.");
      setMessageTone("error");
    }
    setUploadingBlueprint(false);
  }

  async function generateMap(): Promise<SiteVisualPayload | null> {
    setGenerating(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ blueprintId: activeBlueprint?.processingStatus === "ready" ? activeBlueprint.id : null }),
      });
      const data = (await response.json().catch(() => null)) as (SiteVisualPayload & { job?: SiteVisualMapJob }) | null;
      if (response.status === 202 && data?.job) {
        setMapJob(data.job);
        setMessage("Site visual generation queued. You can keep working while the map finishes.");
        setMessageTone("neutral");
        const completed = await pollSiteVisualJob(data.job);
        if (completed) {
          setPayload(completed);
          setSelectedZoneId(completed.scene?.zones?.[0]?.id ?? null);
          setMessage(
            completed.siteMap?.generationStatus === "fallback"
              ? "Generated a deterministic fallback map."
              : completed.siteMap?.blueprintId
                ? "AI site visual generated from the blueprint."
                : "AI site visual generated."
          );
          setMessageTone(completed.siteMap?.generationStatus === "fallback" ? "warning" : "success");
          setGenerating(false);
          return completed;
        }
        setGenerating(false);
        return null;
      }
      if (!response.ok) throw new Error(data?.error || "Failed to generate site visual.");
      setPayload(data ?? {});
      setSelectedZoneId(data?.scene?.zones?.[0]?.id ?? null);
      setMessage(
        data?.siteMap?.generationStatus === "fallback"
          ? "Generated a deterministic fallback map."
          : data?.siteMap?.blueprintId
            ? "AI site visual generated from the blueprint."
            : "AI site visual generated."
      );
      setMessageTone(data?.siteMap?.generationStatus === "fallback" ? "warning" : "success");
      setGenerating(false);
      return data ?? null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate site visual.");
      setMessageTone("error");
    }
    setGenerating(false);
    return null;
  }

  async function pollSiteVisualJob(job: SiteVisualMapJob) {
    const statusUrl = job.statusUrl ?? `/api/company/jobsites/${jobsiteId}/site-visual/jobs/${job.id}`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 1500 : 3000));
      const headers = await getAuthHeaders();
      const response = await fetch(statusUrl, { headers, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; job?: SiteVisualMapJob; payload?: SiteVisualPayload | null }
        | null;
      if (!response.ok) throw new Error(data?.error || "Failed to check site visual status.");
      if (data?.job) {
        setMapJob(data.job);
        setMessage(`Site visual ${data.job.stage.replaceAll("_", " ")} (${Math.round(data.job.progress)}%).`);
        setMessageTone("neutral");
        if (isFinishedSiteVisualJobStatus(data.job.status)) {
          return data.payload ?? null;
        }
        if (isFailedSiteVisualJobStatus(data.job.status)) {
          throw new Error(data.job.errorMessage || "Site visual generation failed.");
        }
      }
    }
    throw new Error(siteVisualPollTimeoutMessage("site visual"));
  }

  async function generateDetailedVisual() {
    if (!activeBlueprint || activeBlueprint.processingStatus !== "ready") {
      setMessage("Upload and process a blueprint before generating the detailed visual.");
      setMessageTone("warning");
      return;
    }
    setRenderingDetailed(true);
    setMessage(null);
    try {
      let currentPayload = payload;
      if (!currentPayload?.scene) {
        currentPayload = await generateMap();
      }
      if (!currentPayload?.scene) throw new Error("Generate the editable site map before creating a detailed visual.");
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/render/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          blueprintId: activeBlueprint.id,
          siteMapId: currentPayload.siteMap?.id ?? null,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            warning?: string | null;
            render?: SiteVisualRender;
            scene?: VisualScene | null;
            zones?: VisualZone[];
            job?: SiteVisualRenderJob;
          }
        | null;
      if (response.status === 202 && data?.job) {
        setRenderJob(data.job);
        setMessage("Detailed visual queued. You can keep working while the render finishes.");
        setMessageTone("neutral");
        const completed = await pollDetailedVisualJob(data.job);
        if (completed) {
          setPayload((current) => ({
            ...(current ?? {}),
            render: completed.render ?? null,
          }));
          setVisualSurfaceMode(completed.render ? "detailed" : "schematic");
          setMessage(
            completed.render
              ? "Detailed isometric visual generated. Click a numbered activity to inspect task impact."
              : "Detailed visual is still processing."
          );
          setMessageTone(completed.render ? "success" : "neutral");
        }
        return;
      }
      if (!response.ok || !data?.render) throw new Error(data?.error || "Failed to generate detailed visual.");
      setPayload((current) => ({
        ...(current ?? {}),
        scene: data.scene ?? current?.scene ?? currentPayload?.scene ?? null,
        zones: data.zones ?? current?.zones,
        render: data.render,
      }));
      setVisualSurfaceMode("detailed");
      setMessage(data.warning ?? "Detailed isometric visual generated. Click a numbered activity to inspect task impact.");
      setMessageTone(data.warning ? "warning" : "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate detailed visual.");
      setMessageTone("error");
      setVisualSurfaceMode("schematic");
    } finally {
      setRenderingDetailed(false);
    }
  }

  async function pollDetailedVisualJob(job: SiteVisualRenderJob) {
    const statusUrl = job.statusUrl ?? `/api/company/jobsites/${jobsiteId}/site-visual/render/jobs/${job.id}`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 1500 : 3000));
      const headers = await getAuthHeaders();
      const response = await fetch(statusUrl, { headers, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; job?: SiteVisualRenderJob; render?: SiteVisualRender | null }
        | null;
      if (!response.ok) throw new Error(data?.error || "Failed to check detailed visual status.");
      if (data?.job) {
        setRenderJob(data.job);
        setMessage(`Detailed visual ${data.job.stage.replaceAll("_", " ")} (${Math.round(data.job.progress)}%).`);
        setMessageTone("neutral");
        if (isFinishedSiteVisualJobStatus(data.job.status)) {
          return { job: data.job, render: data.render ?? null };
        }
        if (isFailedSiteVisualJobStatus(data.job.status)) {
          throw new Error(data.job.errorMessage || "Detailed visual generation failed.");
        }
      }
    }
    throw new Error(siteVisualPollTimeoutMessage("detailed visual"));
  }

  async function removeBlueprint() {
    if (!activeBlueprint) return;
    const confirmed = window.confirm("Remove this plan reference from the jobsite visual?");
    if (!confirmed) return;
    setDeletingBlueprint(true);
    setMessage(null);
    try {
      const blueprintId = activeBlueprint.id;
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/blueprints/${blueprintId}`, {
        method: "DELETE",
        headers,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to remove blueprint.");
      setPayload((current) => {
        if (!current) return current;
        const nextBlueprints = (current.blueprints ?? []).filter((item) => item.id !== blueprintId);
        const nextBlueprint = nextBlueprints.find((item) => item.processingStatus === "ready") ?? nextBlueprints[0] ?? null;
        const nextScene =
          current.scene?.blueprint?.id === blueprintId
            ? { ...current.scene, blueprint: null }
            : current.scene;
        return {
          ...current,
          blueprint: nextBlueprint,
          blueprints: nextBlueprints,
          render: current.render?.blueprintId === blueprintId ? null : current.render,
          scene: nextScene,
          siteMap: current.siteMap?.blueprintId === blueprintId ? { ...current.siteMap, blueprintId: null } : current.siteMap,
        };
      });
      setVisualSurfaceMode("schematic");
      setBlueprintFile(null);
      setMessage("Plan reference removed from this jobsite visual.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove blueprint.");
      setMessageTone("error");
    }
    setDeletingBlueprint(false);
  }

  async function saveZone() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/zones`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          zoneId: draft.id,
          label: draft.label,
          position: draft.position,
          size: draft.size,
          color: draft.color,
          riskLevel: draft.riskLevel,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; scene?: VisualScene | null; zones?: VisualZone[] }
        | null;
      if (!response.ok) throw new Error(data?.error || "Failed to save visual zone.");
      setPayload((current) => {
        if (!current) return current;
        return mergeSiteVisualZoneSavePayload(current, {
          scene: data?.scene,
          zones: data?.zones,
        });
      });
      setSelectedZoneId((current) => nextSelectedSiteVisualZoneId(current, data?.scene?.zones ?? data?.zones ?? []));
      setVisualSurfaceMode("schematic");
      setMessage("Work zone updated. The detailed visual was cleared so it does not show stale task overlays.");
      setMessageTone("warning");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save visual zone.");
      setMessageTone("error");
    }
    setSaving(false);
  }

  function updateDraftVector(key: "position" | "size", axis: keyof Vector3, value: number) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: {
              ...current[key],
              [axis]: value,
            },
          }
        : current
    );
  }

  const visualActions = (
    <>
      <button type="button" className={appButtonSecondaryClassName} onClick={() => void load()} disabled={loading || generating}>
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Refresh
      </button>
      {payload?.canGenerate ? (
        <button type="button" className={appButtonPrimaryClassName} onClick={() => void generateMap()} disabled={generating}>
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {generating ? "Generating..." : scene ? "Regenerate map" : "Generate map"}
        </button>
      ) : null}
      {payload?.canGenerate && activeBlueprint?.processingStatus === "ready" ? (
        <button type="button" className={appButtonPrimaryClassName} onClick={() => void generateDetailedVisual()} disabled={renderingDetailed || generating}>
          <FileImage aria-hidden="true" className="h-4 w-4" />
          {renderingDetailed ? "Rendering..." : activeRender ? "Regenerate detailed visual" : "Generate detailed visual"}
        </button>
      ) : null}
    </>
  );

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                Jobsite visual
              </div>
              <h3 className="mt-1 text-xl font-black tracking-tight text-[var(--app-text-strong)]">
                AI 3D Site Visual
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-muted)]">
                AI-generated schematic map for seeing work areas, task zones, and overlapping work. This is an operational visual aid, not an engineering or BIM drawing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">{visualActions}</div>
          </div>
        </div>
      ) : (
        <PageHero
          eyebrow="Jobsite Workspace"
          title="AI 3D Site Visual"
          description="AI-generated schematic map for seeing work areas, task zones, and overlapping work. This is an operational visual aid, not an engineering or BIM drawing."
          actions={visualActions}
        />
      )}

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      {mapJob && ["queued", "running"].includes(mapJob.status) ? (
        <InlineMessage tone="neutral">
          Site visual job {mapJob.stage.replaceAll("_", " ")} - {Math.round(mapJob.progress)}%
        </InlineMessage>
      ) : null}
      {renderJob && ["queued", "running"].includes(renderJob.status) ? (
        <InlineMessage tone="neutral">
          Detailed visual job {renderJob.stage.replaceAll("_", " ")} - {Math.round(renderJob.progress)}%
        </InlineMessage>
      ) : null}

      <SectionCard
        title="Plan Reference"
        description="Attach a PDF or image plan so AI can draw a new 3D visual from the uploaded layout. The original file is not shown on the map."
        actions={
          activeBlueprint?.processingStatus === "ready" && payload?.canGenerate ? (
            <button type="button" className={appButtonPrimaryClassName} onClick={() => void generateDetailedVisual()} disabled={renderingDetailed || generating}>
              <FileImage aria-hidden="true" className="h-4 w-4" />
              {renderingDetailed ? "Rendering..." : "Generate detailed visual"}
            </button>
          ) : null
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <label className="flex-1 space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Reference plan file</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                  disabled={!payload?.canUploadBlueprints || uploadingBlueprint}
                  onChange={(event) => setBlueprintFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-accent-primary-soft)] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[var(--app-accent-primary)]"
                />
              </label>
              <label className="w-full space-y-2 md:w-28">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">PDF page</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={blueprintPage}
                  disabled={!payload?.canUploadBlueprints || uploadingBlueprint}
                  onChange={(event) => setBlueprintPage(Math.max(1, Math.min(200, Math.trunc(Number(event.target.value) || 1))))}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                />
              </label>
              <button
                type="button"
                className={appButtonSecondaryClassName}
                disabled={!payload?.canUploadBlueprints || uploadingBlueprint || !blueprintFile}
                onClick={() => void uploadBlueprint()}
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                {uploadingBlueprint ? "Processing..." : "Upload plan"}
              </button>
            </div>
            {blueprintFile ? (
              <div className="mt-3 text-xs font-semibold text-[var(--app-muted)]">
                Selected: {blueprintFile.name} ({Math.ceil(blueprintFile.size / 1024)} KB)
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
            {activeBlueprint ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                    <FileImage aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-[var(--app-text-strong)]">{activeBlueprint.fileName}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-[var(--app-muted)]">
                      <span>Page {activeBlueprint.pageNumber}</span>
                      <span>{activeBlueprint.imageWidth && activeBlueprint.imageHeight ? `${activeBlueprint.imageWidth} x ${activeBlueprint.imageHeight}` : "Awaiting preview"}</span>
                    </div>
                  </div>
                  <StatusBadge
                    label={activeBlueprint.processingStatus}
                    tone={activeBlueprint.processingStatus === "ready" ? "success" : activeBlueprint.processingStatus === "failed" ? "warning" : "info"}
                  />
                </div>
                <button
                  type="button"
                  className={`${appButtonSecondaryClassName} w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
                  disabled={!payload?.canUploadBlueprints || deletingBlueprint}
                  onClick={() => void removeBlueprint()}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  {deletingBlueprint ? "Removing..." : "Remove blueprint"}
                </button>
                {activeBlueprint.processingError ? <InlineMessage tone="warning">{activeBlueprint.processingError}</InlineMessage> : null}
                {activeBlueprint.signedPreviewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-slate-50">
                    <div className="border-b border-[var(--app-border)] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                      Source preview for verification
                    </div>
                    <img src={activeBlueprint.signedPreviewUrl} alt="" className="h-40 w-full object-contain" />
                  </div>
                ) : null}
                {activeBlueprint.processingStatus === "ready" ? (
                  <InlineMessage tone="neutral">
                    AI uses this upload as a layout reference only. The editable map and detailed visual are drawn separately from the source file.
                  </InlineMessage>
                ) : null}
              </div>
            ) : (
              <InlineMessage>Upload a plan reference so AI can draw a 3D jobsite visual from the actual layout.</InlineMessage>
            )}
          </div>
        </div>
      </SectionCard>

      {!loading && !scene ? (
        <EmptyState
          icon={Layers3}
          eyebrow="Site Visual"
          title="No schematic map generated yet"
          description="Generate a 3D map from this jobsite's work areas, tasks, permits, observations, and optional plan reference."
          primaryAction={payload?.canGenerate ? { label: generating ? "Generating..." : "Generate AI map", onClick: () => void generateMap() } : undefined}
        />
      ) : null}

      {loading ? <InlineMessage>Loading site visual...</InlineMessage> : null}

      {scene ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
          <SectionCard
            title={visualSurfaceMode === "detailed" ? "Detailed Work Visual" : "3D Work Map"}
            description={
              visualSurfaceMode === "detailed"
                ? "AI-generated operational visual with app-owned clickable task and overlap overlays. Not an engineering drawing."
                : "Task boxes are colored by risk. Dark base marks overlapping work that also shares a schedule window."
            }
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={visualSurfaceMode === "detailed" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setVisualSurfaceMode("detailed")}
                  disabled={!activeRender}
                >
                  <FileImage aria-hidden="true" className="h-4 w-4" />
                  Detailed visual
                </button>
                <button
                  type="button"
                  className={visualSurfaceMode === "schematic" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setVisualSurfaceMode("schematic")}
                >
                  <Layers3 aria-hidden="true" className="h-4 w-4" />
                  Editable schematic
                </button>
                <button
                  type="button"
                  className={viewMode === "isometric" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setViewMode("isometric")}
                  hidden={visualSurfaceMode === "detailed"}
                >
                  Isometric
                </button>
                <button
                  type="button"
                  className={viewMode === "top" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setViewMode("top")}
                  hidden={visualSurfaceMode === "detailed"}
                >
                  Top view
                </button>
                <button
                  type="button"
                  className={showOverlapsOnly ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setShowOverlapsOnly((value) => !value)}
                  hidden={visualSurfaceMode === "detailed"}
                >
                  <Crosshair aria-hidden="true" className="h-4 w-4" />
                  {showOverlapsOnly ? "Show all zones" : "Show overlaps"}
                </button>
              </div>
            }
          >
            {visualSurfaceMode === "detailed" && activeRender ? (
              <DetailedVisualRenderer
                render={activeRender}
                scene={scene}
                selectedZoneId={selectedZoneId}
                onSelectZone={setSelectedZoneId}
              />
            ) : (
              <SiteVisualRenderer
                scene={scene}
                selectedZoneId={selectedZoneId}
                showOverlapsOnly={showOverlapsOnly}
                viewMode={viewMode}
                onSelectZone={setSelectedZoneId}
              />
            )}
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Map Summary" description={payload?.jobsite?.name ?? "Current jobsite"}>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Areas" value={scene.areas.length} />
                <Metric label="Zones" value={zones.length} />
                <Metric label="Overlaps" value={overlaps.length} tone={overlaps.length ? "warning" : "success"} />
                <Metric label="Levels" value={scene.levels.length} />
              </div>
              {activeBlueprint?.processingStatus === "ready" ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs font-semibold leading-5 text-blue-900">
                  Plan reference active: {activeBlueprint.fileName}
                </div>
              ) : null}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-xs leading-5 text-[var(--app-muted)]">
                AI suggests the layout. Safety teams should adjust zones to match the actual site plan before relying on the overlap view.
              </div>
            </SectionCard>

            <SectionCard title="Task Impact" description={draft ? "Click any work zone to understand its task, timing, and surrounding conflicts." : "Select a work zone in the map or list."}>
              {draft ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: riskColor(draft.riskLevel) }}
                          />
                          <div className="truncate text-base font-black text-[var(--app-text-strong)]">{draft.label}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[var(--app-muted)]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-panel-soft)] px-2 py-1">
                            <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                            {draft.workArea ?? "General area"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-panel-soft)] px-2 py-1">
                            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                            {formatDateTime(draft.startsAt)}
                          </span>
                        </div>
                      </div>
                      <StatusBadge label={draft.riskLevel} tone={riskTone(draft.riskLevel)} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--app-muted)]">
                      {zoneImpactText(draft, selectedImpacts.length)}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                        <div className="font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Trade / source</div>
                        <div className="mt-1 font-semibold text-[var(--app-text-strong)]">{draft.trade ?? sourceLabel(draft.sourceType)}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                        <div className="font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Schedule window</div>
                        <div className="mt-1 font-semibold text-[var(--app-text-strong)]">{formatDateTime(draft.startsAt)} to {formatDateTime(draft.endsAt)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">How this affects nearby work</div>
                    {selectedImpacts.length === 0 ? (
                      <InlineMessage tone="success">No active overlap is flagged for this selected task.</InlineMessage>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {selectedImpacts.map(({ overlap, otherZone }) => (
                          <button
                            key={overlap.id}
                            type="button"
                            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                            onClick={() => otherZone?.id && setSelectedZoneId(otherZone.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-amber-950">{otherZone?.label ?? overlap.label}</div>
                                <div className="mt-1 text-xs leading-5 text-amber-800">{overlap.reason}</div>
                              </div>
                              <StatusBadge label={overlap.severity} tone={severityTone(overlap.severity)} />
                            </div>
                            {otherZone ? (
                              <div className="mt-2 text-xs font-semibold text-[var(--app-muted)]">
                                {otherZone.workArea ?? "General area"} / {formatDateTime(otherZone.startsAt)}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Controls / notes</div>
                    {draft.controls.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {draft.controls.map((control) => (
                          <span key={control} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                            {control}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--app-muted)]">No controls are attached to this schematic zone yet.</p>
                    )}
                  </div>

                  <details className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
                    <summary className="cursor-pointer text-sm font-bold text-[var(--app-text-strong)]">
                      Adjust schematic placement
                    </summary>
                    <div className="mt-4 space-y-4">
                      <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        <span>Label</span>
                        <input
                          value={draft.label}
                          onChange={(event) => setDraft((current) => (current ? { ...current, label: event.target.value } : current))}
                          className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                        />
                      </label>
                      <select
                        className={appNativeSelectClassName}
                        value={draft.riskLevel}
                        onChange={(event) => setDraft((current) => (current ? { ...current, riskLevel: event.target.value as RiskLevel } : current))}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <NumberField label="X" value={draft.position.x} onChange={(value) => updateDraftVector("position", "x", value)} />
                        <NumberField label="Y" value={draft.position.y} onChange={(value) => updateDraftVector("position", "y", value)} />
                        <NumberField label="Z" value={draft.position.z} onChange={(value) => updateDraftVector("position", "z", value)} />
                        <NumberField label="Wide" value={draft.size.x} onChange={(value) => updateDraftVector("size", "x", value)} />
                        <NumberField label="Tall" value={draft.size.y} onChange={(value) => updateDraftVector("size", "y", value)} />
                        <NumberField label="Deep" value={draft.size.z} onChange={(value) => updateDraftVector("size", "z", value)} />
                      </div>
                      <button type="button" className={appButtonPrimaryClassName} onClick={() => void saveZone()} disabled={!payload?.canEditZones || saving}>
                        <Save aria-hidden="true" className="h-4 w-4" />
                        {saving ? "Saving..." : "Save zone"}
                      </button>
                    </div>
                  </details>
                </div>
              ) : (
                <InlineMessage>Select a zone to see the task, schedule, controls, and overlap impact.</InlineMessage>
              )}
            </SectionCard>

            <SectionCard title="Overlapping Work" description="Deterministic zone/time intersections from the current schematic.">
              {overlaps.length === 0 ? (
                <InlineMessage tone="success">No overlapping work zones are currently flagged.</InlineMessage>
              ) : (
                <div className="space-y-2">
                  {overlaps.map((overlap) => (
                    <button
                      key={overlap.id}
                      type="button"
                      className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm text-amber-950 transition hover:border-amber-300 hover:bg-amber-100"
                      onClick={() => setSelectedZoneId(overlap.zoneIds[0])}
                    >
                      <div className="font-semibold">{overlap.label}</div>
                      <div className="mt-1 text-xs leading-5 text-amber-800">{overlap.reason}</div>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Work Zones" description="Schedule-linked and field-signal zones in the current visual.">
              <div className="space-y-2">
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      zone.id === selectedZoneId
                        ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)]"
                        : "border-[var(--app-border)] bg-white hover:bg-[var(--app-panel-soft)]"
                    }`}
                    onClick={() => setSelectedZoneId(zone.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{zone.label}</div>
                        <div className="mt-1 text-xs text-[var(--app-muted)]">{zone.workArea ?? "General area"} / {zone.trade ?? zone.sourceType}</div>
                        <div className="mt-1 text-xs text-[var(--app-muted)]">{formatDateTime(zone.startsAt)} to {formatDateTime(zone.endsAt)}</div>
                      </div>
                      <StatusBadge label={zone.riskLevel} tone={riskTone(zone.riskLevel)} />
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone = "info" }: { label: string; value: number; tone?: "info" | "warning" | "success" }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-blue-100 bg-blue-50 text-blue-900";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
        <Box aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
