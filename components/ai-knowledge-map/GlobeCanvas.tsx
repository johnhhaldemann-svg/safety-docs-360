"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { AiKnowledgeEdge, AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";
import { categoryColors, riskTone } from "@/components/ai-knowledge-map/mapTheme";
import { HeatmapLayer } from "@/components/ai-knowledge-map/HeatmapLayer";
import { NodeTooltip } from "@/components/ai-knowledge-map/NodeTooltip";
import type { MapCommand } from "@/components/ai-knowledge-map/MapControls";

type OrbitControlsLike = {
  enableDamping: boolean;
  dampingFactor: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  target: THREE.Vector3;
  update: () => void;
  dispose: () => void;
  reset: () => void;
};

type SceneState = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControlsLike | null;
  nodeMeshes: THREE.Mesh[];
  renderer: THREE.WebGLRenderer;
};

export function GlobeCanvas({
  nodes,
  edges,
  selectedNodeId,
  heatmap,
  command,
  onSelectNode,
}: {
  nodes: AiKnowledgeNode[];
  edges: AiKnowledgeEdge[];
  selectedNodeId: string | null;
  heatmap: boolean;
  command: { id: number; value: MapCommand | null };
  onSelectNode: (node: AiKnowledgeNode) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const nodesRef = useRef(nodes);
  const onSelectRef = useRef(onSelectNode);
  const [hovered, setHovered] = useState<{ node: AiKnowledgeNode; x: number; y: number } | null>(null);
  const [webglFailed] = useState(() => typeof window !== "undefined" && typeof WebGLRenderingContext === "undefined");

  useEffect(() => {
    nodesRef.current = nodes;
    onSelectRef.current = onSelectNode;
  }, [nodes, onSelectNode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (webglFailed) return;

    let disposed = false;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 100);
    camera.position.set(0, 0.2, 4.9);

    const ambient = new THREE.AmbientLight(0x88ccff, 0.65);
    const point = new THREE.PointLight(0x38bdf8, 3.5, 9);
    point.position.set(3, 2.5, 4);
    scene.add(ambient, point);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0x07182f,
        metalness: 0.2,
        roughness: 0.48,
        emissive: 0x08345f,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.9,
      })
    );
    scene.add(globe);

    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(1.455, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.11 })
    );
    scene.add(wire);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.62, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08, side: THREE.BackSide })
    );
    scene.add(atmosphere);

    const group = new THREE.Group();
    scene.add(group);

    function pointFor(node: AiKnowledgeNode) {
      const vector = new THREE.Vector3(node.vectorCoordinates.x, node.vectorCoordinates.y, node.vectorCoordinates.z);
      if (vector.length() < 0.1) vector.set(0.2, 0.7, 0.8);
      return vector.normalize().multiplyScalar(1.72);
    }

    const nodeMeshes: THREE.Mesh[] = [];
    nodes.slice(0, 500).forEach((node) => {
      const tone = riskTone(node.riskLevel);
      const size = node.riskLevel === "critical" ? 0.065 : node.riskLevel === "high" ? 0.053 : 0.042;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 18, 18),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(categoryColors[node.nodeType] ?? tone.glow), transparent: true, opacity: 0.96 })
      );
      mesh.position.copy(pointFor(node));
      mesh.userData.nodeId = node.id;
      group.add(mesh);
      nodeMeshes.push(mesh);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 2.4, 18, 18),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(tone.glow), transparent: true, opacity: node.riskLevel === "critical" ? 0.18 : 0.1 })
      );
      glow.position.copy(mesh.position);
      group.add(glow);
    });

    const pointsById = new Map(nodes.map((node) => [node.id, pointFor(node)]));
    edges.slice(0, 700).forEach((edge) => {
      const from = pointsById.get(edge.sourceNodeId ?? edge.fromNodeId);
      const to = pointsById.get(edge.targetNodeId ?? edge.toNodeId);
      if (!from || !to) return;
      const mid = from.clone().add(to).normalize().multiplyScalar(2.12);
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      const color = edge.validationStatus === "approved" ? 0x34d399 : edge.confidenceScore < 0.55 ? 0xfbbf24 : 0x38bdf8;
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.max(0.18, edge.relationshipStrength * 0.46) }));
      group.add(line);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function pick(event: PointerEvent, click = false) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
      const node = hit ? nodesRef.current.find((item) => item.id === hit.object.userData.nodeId) : null;
      if (click && node) onSelectRef.current(node);
      setHovered(node ? { node, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
    }
    renderer.domElement.addEventListener("pointermove", (event) => pick(event));
    renderer.domElement.addEventListener("click", (event) => pick(event, true));

    let controls: OrbitControlsLike | null = null;
    void import("three/examples/jsm/controls/OrbitControls.js").then(({ OrbitControls }) => {
      if (disposed) return;
      controls = new OrbitControls(camera, renderer.domElement) as OrbitControlsLike;
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.45;
      sceneRef.current = { camera, controls, nodeMeshes, renderer };
    }).catch(() => {
      sceneRef.current = { camera, controls: null, nodeMeshes, renderer };
    });

    function resize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    function animate() {
      if (disposed) return;
      group.rotation.y += controls?.autoRotate ? 0 : 0.0018;
      controls?.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();
    sceneRef.current = { camera, controls, nodeMeshes, renderer };

    return () => {
      disposed = true;
      observer.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      controls?.dispose();
    };
  }, [nodes, edges, webglFailed]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !command.value) return;
    if (command.value === "zoomIn") state.camera.position.multiplyScalar(0.86);
    if (command.value === "zoomOut") state.camera.position.multiplyScalar(1.14);
    if (command.value === "fit") state.camera.position.set(0, 0.1, 4.4);
    if (command.value === "reset") {
      state.camera.position.set(0, 0.2, 4.9);
      state.controls?.reset();
    }
    if (command.value === "rotate" && state.controls) state.controls.autoRotate = !state.controls.autoRotate;
  }, [command]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.nodeMeshes.forEach((mesh) => {
      const selected = mesh.userData.nodeId === selectedNodeId;
      mesh.scale.setScalar(selected ? 1.75 : 1);
    });
  }, [selectedNodeId]);

  if (webglFailed) {
    return (
      <div className="relative min-h-[540px] rounded-2xl border border-white/10 bg-slate-950/80 p-4">
        <p className="text-sm font-bold text-amber-100">WebGL is unavailable. Showing performance-safe 2D node view.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {nodes.slice(0, 80).map((node) => (
            <button key={node.id} type="button" onClick={() => onSelectNode(node)} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left text-sm font-bold text-white">
              {node.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[540px] overflow-hidden rounded-2xl border border-sky-300/15 bg-[radial-gradient(circle_at_50%_44%,rgba(56,189,248,0.18),rgba(2,6,23,0.78)_42%,rgba(2,6,23,0.98)_100%)] shadow-[0_0_70px_rgba(56,189,248,0.12)]">
      <div ref={mountRef} className="absolute inset-0" />
      <HeatmapLayer enabled={heatmap} />
      <NodeTooltip node={hovered?.node ?? null} x={hovered?.x ?? 0} y={hovered?.y ?? 0} />
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-sky-300/15 bg-slate-950/70 px-3 py-2 text-xs font-bold text-sky-100 backdrop-blur">
        Vector coordinates place similar safety records near each other. Lines explain relationship strength.
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        Visible limit: {Math.min(nodes.length, 500)} nodes / {Math.min(edges.length, 700)} connections
      </div>
    </div>
  );
}
