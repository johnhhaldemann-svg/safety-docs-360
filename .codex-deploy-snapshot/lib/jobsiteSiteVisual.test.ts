import { describe, expect, it } from "vitest";
import {
  boxesIntersect,
  buildFallbackSiteVisualScene,
  detectSiteVisualOverlaps,
  siteVisualPromptHash,
  validateSiteVisualScene,
  type SiteVisualGenerationInput,
  type SiteVisualZone,
} from "@/lib/jobsiteSiteVisual";

const input: SiteVisualGenerationInput = {
  jobsite: {
    id: "jobsite-1",
    name: "Hillcrest Office Fit-Out",
    location: "Cedar Park, TX",
  },
  items: [
    {
      id: "schedule-1",
      sourceType: "schedule",
      title: "Drop Hazard 3rd Floor",
      trade: "Drywall",
      workArea: "3rd Floor East",
      workStartDate: "2026-05-21",
      workEndDate: "2026-05-21",
      shiftStartTime: "07:00",
      shiftEndTime: "12:00",
      riskLevel: "critical",
      controls: ["controlled access zone"],
    },
    {
      id: "schedule-2",
      sourceType: "schedule",
      title: "Electrical rough-in",
      trade: "Electrical",
      workArea: "3rd Floor East",
      workStartDate: "2026-05-21",
      workEndDate: "2026-05-21",
      shiftStartTime: "09:00",
      shiftEndTime: "15:00",
      riskLevel: "high",
      permitTriggers: ["energized_electrical_or_loto"],
    },
  ],
};

describe("jobsite site visual scene helpers", () => {
  it("builds a fallback schematic scene from scheduled work areas", () => {
    const scene = buildFallbackSiteVisualScene(input);

    expect(scene.version).toBe(1);
    expect(scene.blueprint).toBeNull();
    expect(scene.levels[0]?.label).toBe("Level 3");
    expect(scene.areas[0]?.label).toBe("3rd Floor East");
    expect(scene.zones).toHaveLength(2);
    expect(scene.zones[0]).toMatchObject({
      sourceType: "schedule",
      scheduleItemId: "schedule-1",
      riskLevel: "critical",
      startsAt: "2026-05-21T07:00:00",
      endsAt: "2026-05-21T12:00:00",
    });
  });

  it("uses blueprint metadata for fallback placement and clamps AI blueprint bounds", () => {
    const blueprintInput: SiteVisualGenerationInput = {
      ...input,
      blueprint: {
        id: "blueprint-1",
        fileName: "Level 3 Plan.pdf",
        mimeType: "application/pdf",
        width: 2200,
        height: 1100,
        pageNumber: 1,
        transform: { x: 2, z: -3, scale: 1, rotationY: 0, opacity: 0.7, width: 80, height: 40 },
      },
    };

    const fallback = buildFallbackSiteVisualScene(blueprintInput);
    expect(fallback.blueprint).toMatchObject({ id: "blueprint-1", imageWidth: 2200, imageHeight: 1100 });
    expect(fallback.areas[0]?.blueprintBounds).toEqual(expect.objectContaining({ width: 0.22, height: 0.16 }));
    expect(fallback.zones[0]?.blueprintBounds).toEqual(expect.objectContaining({ width: 0.08, height: 0.05 }));

    const scene = validateSiteVisualScene(
      {
        levels: [{ id: "l1", label: "Level 1", elevation: 0, height: 0.25 }],
        areas: [
          {
            id: "a1",
            label: "Area",
            levelId: "l1",
            position: { x: 0, y: 0, z: 0 },
            size: { x: 10, y: 0.25, z: 10 },
            color: "#dbeafe",
            blueprintBounds: { x: -1, y: 2, width: 5, height: 0 },
          },
        ],
        zones: [
          {
            id: "z1",
            label: "Zone",
            sourceType: "schedule",
            sourceId: "schedule-1",
            scheduleItemId: "schedule-1",
            trade: "Drywall",
            workArea: "3rd Floor East",
            startsAt: "2026-05-21T07:00:00",
            endsAt: "2026-05-21T09:00:00",
            riskLevel: "high",
            controls: [],
            position: { x: 0, y: 1, z: 0 },
            size: { x: 4, y: 1, z: 4 },
            color: "#f97316",
            blueprintBounds: { x: 0.4, y: 0.3, width: 0.2, height: 0.1 },
          },
        ],
        camera: { position: { x: 1, y: 20, z: 1 }, target: { x: 0, y: 0, z: 0 } },
        blueprint: { id: "blueprint-1", imageWidth: 2200, imageHeight: 1100, transform: { x: 200, z: 0, scale: 10, rotationY: 0, opacity: 2, width: 400, height: 1 } },
      },
      blueprintInput
    );

    expect(scene.areas[0]?.blueprintBounds).toMatchObject({ x: 0, y: 1, width: 1, height: 0.01 });
    expect(scene.zones[0]?.blueprintBounds).toMatchObject({ x: 0.4, y: 0.3, width: 0.2, height: 0.1 });
    expect(scene.blueprint?.transform).toMatchObject({ x: 80, scale: 4, opacity: 1, width: 120, height: 12 });
  });

  it("detects overlaps only when boxes and time windows overlap", () => {
    const base: SiteVisualZone = {
      id: "zone-1",
      label: "Zone 1",
      sourceType: "schedule",
      sourceId: "one",
      scheduleItemId: "one",
      trade: null,
      workArea: null,
      startsAt: "2026-05-21T07:00:00",
      endsAt: "2026-05-21T12:00:00",
      riskLevel: "medium",
      controls: [],
      position: { x: 0, y: 1, z: 0 },
      size: { x: 4, y: 1, z: 4 },
      color: "#2563eb",
    };
    const overlapping = {
      ...base,
      id: "zone-2",
      sourceId: "two",
      scheduleItemId: "two",
      startsAt: "2026-05-21T11:00:00",
      endsAt: "2026-05-21T13:00:00",
      riskLevel: "critical" as const,
      position: { x: 1, y: 1, z: 1 },
    };
    const later = {
      ...overlapping,
      id: "zone-3",
      startsAt: "2026-05-21T14:00:00",
      endsAt: "2026-05-21T16:00:00",
    };

    expect(boxesIntersect(base, overlapping)).toBe(true);
    expect(detectSiteVisualOverlaps([base, overlapping])).toEqual([
      expect.objectContaining({ severity: "critical", zoneIds: ["zone-1", "zone-2"] }),
    ]);
    expect(detectSiteVisualOverlaps([base, later])).toEqual([]);
  });

  it("detects blueprint-footprint and stacked vertical work overlaps", () => {
    const base: SiteVisualZone = {
      id: "zone-1",
      label: "Suite 101 demo",
      sourceType: "schedule",
      sourceId: "one",
      scheduleItemId: "one",
      trade: null,
      workArea: null,
      startsAt: "2026-05-21T07:00:00",
      endsAt: "2026-05-21T12:00:00",
      riskLevel: "medium",
      controls: [],
      position: { x: 0, y: 1, z: 0 },
      size: { x: 4, y: 1, z: 4 },
      color: "#2563eb",
      blueprintBounds: { x: 0.2, y: 0.2, width: 0.2, height: 0.18 },
    };
    const blueprintOverlap: SiteVisualZone = {
      ...base,
      id: "zone-2",
      label: "Suite 101 overhead work",
      riskLevel: "high",
      position: { x: 20, y: 1, z: 20 },
      blueprintBounds: { x: 0.32, y: 0.28, width: 0.18, height: 0.16 },
    };
    const verticalStack: SiteVisualZone = {
      ...base,
      id: "zone-3",
      label: "Level 2 lift work",
      riskLevel: "critical",
      position: { x: 0.5, y: 8, z: 0.5 },
      blueprintBounds: null,
    };

    expect(detectSiteVisualOverlaps([base, blueprintOverlap])[0]).toMatchObject({
      severity: "high",
      reason: "Work footprints overlap on the uploaded blueprint and their scheduled windows overlap.",
    });
    expect(detectSiteVisualOverlaps([base, verticalStack])[0]).toMatchObject({
      severity: "critical",
      reason: "Work footprints stack above or below each other during the same scheduled window.",
    });
  });

  it("clamps and validates AI scene geometry before saving", () => {
    const scene = validateSiteVisualScene(
      {
        levels: [{ id: "L!!!", label: "Level bad", elevation: 999, height: -2 }],
        areas: [
          {
            id: "Area 1",
            label: "Area",
            levelId: "l",
            position: { x: 500, y: -20, z: -500 },
            size: { x: -1, y: -1, z: 200 },
            color: "orange",
          },
        ],
        zones: [
          {
            id: "Zone 1",
            label: "AI Zone",
            sourceType: "unknown",
            sourceId: null,
            scheduleItemId: null,
            trade: null,
            workArea: null,
            startsAt: "2026-05-21T07:00:00",
            endsAt: "2026-05-21T09:00:00",
            riskLevel: "critical",
            controls: ["review"],
            position: { x: 999, y: -1, z: 999 },
            size: { x: -20, y: 99, z: 0 },
            color: "red",
          },
        ],
        camera: { position: { x: 999, y: -1, z: 999 }, target: { x: 0, y: 0, z: 0 } },
      },
      input
    );

    expect(scene.levels[0]).toMatchObject({ id: "l", elevation: 28, height: 0.1 });
    expect(scene.areas[0]?.position).toMatchObject({ x: 80, y: 0, z: -80 });
    expect(scene.areas[0]?.size).toMatchObject({ x: 0.5, y: 0.25, z: 30 });
    expect(scene.zones[0]).toMatchObject({
      id: "zone-1",
      sourceType: "manual",
      color: "#ef4444",
      position: { x: 80, y: 0, z: 80 },
      size: { x: 0.5, y: 12, z: 0.5 },
    });
  });

  it("creates a stable prompt hash independent of item order", () => {
    const reversed = { ...input, items: [...input.items].reverse() };

    expect(siteVisualPromptHash(input)).toBe(siteVisualPromptHash(reversed));
  });
});
