"use client";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Clock, Crosshair, Layers3, MapPin, RefreshCw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
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
type VisualOverlap = { id: string; zoneIds: [string, string]; severity: "medium" | "high" | "critical"; label: string; reason: string };

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
};

type VisualScene = {
  version: 1;
  levels: Array<{ id: string; label: string; elevation: number; height: number }>;
  areas: Array<{ id: string; label: string; levelId: string; position: Vector3; size: Vector3; color: string }>;
  zones: VisualZone[];
  overlaps: VisualOverlap[];
  camera: { position: Vector3; target: Vector3 };
};

type SiteVisualPayload = {
  jobsite?: { name?: string | null; location?: string | null; project_number?: string | null; jobsite_number?: string | null };
  siteMap?: { id: string; generationStatus?: string | null; aiMeta?: Record<string, unknown> | null; updatedAt?: string | null } | null;
  scene?: VisualScene | null;
  zones?: VisualZone[];
  canGenerate?: boolean;
  canEditZones?: boolean;
  warning?: string;
  error?: string;
};

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
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [payload, setPayload] = useState<SiteVisualPayload | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showOverlapsOnly, setShowOverlapsOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("isometric");
  const [draft, setDraft] = useState<VisualZone | null>(null);

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
  const zones = scene?.zones ?? [];
  const overlaps = scene?.overlaps ?? [];
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

  async function generateMap() {
    setGenerating(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/company/jobsites/${jobsiteId}/site-visual/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => null)) as SiteVisualPayload | null;
      if (!response.ok) throw new Error(data?.error || "Failed to generate site visual.");
      setPayload(data ?? {});
      setSelectedZoneId(data?.scene?.zones?.[0]?.id ?? null);
      setMessage(data?.siteMap?.generationStatus === "fallback" ? "Generated a deterministic fallback map." : "AI site visual generated.");
      setMessageTone(data?.siteMap?.generationStatus === "fallback" ? "warning" : "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate site visual.");
      setMessageTone("error");
    }
    setGenerating(false);
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
        return {
          ...current,
          scene: data?.scene ?? (current.scene ? { ...current.scene, zones: data?.zones ?? current.scene.zones } : current.scene),
          zones: data?.zones ?? current.zones,
        };
      });
      setMessage("Work zone updated.");
      setMessageTone("success");
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

      {!loading && !scene ? (
        <EmptyState
          icon={Layers3}
          eyebrow="Site Visual"
          title="No schematic map generated yet"
          description="Generate a 3D map from this jobsite's work areas, tasks, permits, and observations."
          primaryAction={payload?.canGenerate ? { label: generating ? "Generating..." : "Generate AI map", onClick: () => void generateMap() } : undefined}
        />
      ) : null}

      {loading ? <InlineMessage>Loading site visual...</InlineMessage> : null}

      {scene ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
          <SectionCard
            title="3D Work Map"
            description="Task boxes are colored by risk. Dark base marks overlapping work that also shares a schedule window."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={viewMode === "isometric" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setViewMode("isometric")}
                >
                  Isometric
                </button>
                <button
                  type="button"
                  className={viewMode === "top" ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setViewMode("top")}
                >
                  Top view
                </button>
                <button
                  type="button"
                  className={showOverlapsOnly ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                  onClick={() => setShowOverlapsOnly((value) => !value)}
                >
                  <Crosshair aria-hidden="true" className="h-4 w-4" />
                  {showOverlapsOnly ? "Show all zones" : "Show overlaps"}
                </button>
              </div>
            }
          >
            <SiteVisualRenderer
              scene={scene}
              selectedZoneId={selectedZoneId}
              showOverlapsOnly={showOverlapsOnly}
              viewMode={viewMode}
              onSelectZone={setSelectedZoneId}
            />
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Map Summary" description={payload?.jobsite?.name ?? "Current jobsite"}>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Areas" value={scene.areas.length} />
                <Metric label="Zones" value={zones.length} />
                <Metric label="Overlaps" value={overlaps.length} tone={overlaps.length ? "warning" : "success"} />
                <Metric label="Levels" value={scene.levels.length} />
              </div>
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
