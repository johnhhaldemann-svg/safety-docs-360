"use client";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Crosshair, Layers3, RefreshCw, Save, Sparkles } from "lucide-react";
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
  overlaps: Array<{ id: string; zoneIds: [string, string]; severity: "medium" | "high" | "critical"; label: string; reason: string }>;
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

const supabase = getSupabaseBrowserClient();

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

function overlapZoneIds(scene: VisualScene | null) {
  return new Set((scene?.overlaps ?? []).flatMap((overlap) => overlap.zoneIds));
}

function getMeshMaterial(color: string, selected: boolean, overlapped: boolean) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: selected ? 0.86 : overlapped ? 0.72 : 0.58,
    roughness: 0.55,
    metalness: 0.02,
    emissive: selected ? new THREE.Color("#dbeafe") : overlapped ? new THREE.Color("#451a03") : new THREE.Color("#000000"),
    emissiveIntensity: selected ? 0.25 : overlapped ? 0.18 : 0,
  });
}

function makeLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(37,99,235,0.25)";
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 38px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(text.slice(0, 28), 26, 66);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.6, 1.4, 1);
  return sprite;
}

function SiteVisualRenderer({
  scene,
  selectedZoneId,
  showOverlapsOnly,
  onSelectZone,
}: {
  scene: VisualScene;
  selectedZoneId: string | null;
  showOverlapsOnly: boolean;
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
    mount.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    threeScene.fog = new THREE.Fog(0xf8fbff, 70, 145);
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 500);
    camera.position.set(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z);
    camera.lookAt(scene.camera.target.x, scene.camera.target.y, scene.camera.target.z);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(scene.camera.target.x, scene.camera.target.y, scene.camera.target.z);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 12;
    controls.maxDistance = 120;

    threeScene.add(new THREE.HemisphereLight(0xffffff, 0x8ea0b8, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(20, 36, 18);
    threeScene.add(keyLight);
    const grid = new THREE.GridHelper(90, 30, 0xb7c4d8, 0xe2e8f0);
    threeScene.add(grid);

    const overlapIds = overlapZoneIds(scene);
    const zoneMeshes = new Map<string, THREE.Mesh>();
    const clickable: THREE.Mesh[] = [];

    for (const area of scene.areas) {
      const geometry = new THREE.BoxGeometry(area.size.x, Math.max(0.12, area.size.y), area.size.z);
      const material = new THREE.MeshStandardMaterial({ color: area.color, transparent: true, opacity: 0.72, roughness: 0.9 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(area.position.x, area.position.y, area.position.z);
      threeScene.add(mesh);
      const label = makeLabelSprite(area.label);
      label.position.set(area.position.x, area.position.y + 1.1, area.position.z - area.size.z / 2 - 1.1);
      threeScene.add(label);
    }

    for (const zone of scene.zones) {
      const isOverlapped = overlapIds.has(zone.id);
      if (showOverlapsOnly && !isOverlapped) continue;
      const geometry = new THREE.BoxGeometry(zone.size.x, zone.size.y, zone.size.z);
      const mesh = new THREE.Mesh(geometry, getMeshMaterial(zone.color, zone.id === selectedZoneId, isOverlapped));
      mesh.position.set(zone.position.x, zone.position.y, zone.position.z);
      mesh.userData.zoneId = zone.id;
      threeScene.add(mesh);
      zoneMeshes.set(zone.id, mesh);
      clickable.push(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: zone.id === selectedZoneId ? 0x0f172a : isOverlapped ? 0x7c2d12 : 0xffffff })
      );
      line.position.copy(mesh.position);
      threeScene.add(line);

      const label = makeLabelSprite(zone.label);
      label.position.set(zone.position.x, zone.position.y + zone.size.y / 2 + 1.1, zone.position.z);
      threeScene.add(label);
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
      camera.aspect = nextWidth / nextHeight;
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
  }, [scene, selectedZoneId, showOverlapsOnly, onSelectZone]);

  return <div ref={mountRef} className="h-[560px] min-h-[420px] w-full overflow-hidden rounded-xl border border-[var(--app-border)] bg-[#f8fbff]" />;
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

export function JobsiteSiteVisualClient({ jobsiteId }: { jobsiteId: string }) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [payload, setPayload] = useState<SiteVisualPayload | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showOverlapsOnly, setShowOverlapsOnly] = useState(false);
  const [draft, setDraft] = useState<VisualZone | null>(null);

  async function getAuthHeaders() {
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

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Jobsite Workspace"
        title="AI 3D Site Visual"
        description="AI-generated schematic map for seeing work areas, task zones, and overlapping work. This is an operational visual aid, not an engineering or BIM drawing."
        actions={
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
        }
      />

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
            description="Orbit, zoom, and select a work zone. Overlapping zones rotate slightly and appear with stronger contrast."
            actions={
              <button
                type="button"
                className={showOverlapsOnly ? appButtonPrimaryClassName : appButtonSecondaryClassName}
                onClick={() => setShowOverlapsOnly((value) => !value)}
              >
                <Crosshair aria-hidden="true" className="h-4 w-4" />
                {showOverlapsOnly ? "Show all zones" : "Show overlaps"}
              </button>
            }
          >
            <SiteVisualRenderer
              scene={scene}
              selectedZoneId={selectedZoneId}
              showOverlapsOnly={showOverlapsOnly}
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

            <SectionCard title="Selected Zone" description={draft ? "Fine-tune the schematic position and size." : "Select a work zone in the map or list."}>
              {draft ? (
                <div className="space-y-4">
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
              ) : (
                <InlineMessage>Select a zone to edit its schematic placement.</InlineMessage>
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
