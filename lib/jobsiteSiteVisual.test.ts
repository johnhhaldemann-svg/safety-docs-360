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
