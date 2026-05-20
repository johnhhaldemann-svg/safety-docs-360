import { describe, expect, it } from "vitest";
import {
  buildSiteVisualFallbackRenderSvg,
  buildSiteVisualRenderOverlay,
  buildSiteVisualRenderPrompt,
  cleanSiteVisualRenderOverlay,
  extractResponsesImageBase64,
  siteVisualRenderPromptHash,
} from "@/lib/jobsiteSiteRender";
import { buildFallbackSiteVisualScene, type SiteVisualGenerationInput } from "@/lib/jobsiteSiteVisual";

const input: SiteVisualGenerationInput = {
  jobsite: { id: "jobsite-1", name: "Hillcrest Office Fit-Out" },
  blueprint: {
    id: "blueprint-1",
    fileName: "Level 3 Plan.pdf",
    mimeType: "application/pdf",
    width: 1800,
    height: 1000,
    pageNumber: 1,
    transform: { x: 0, z: 0, scale: 1, rotationY: 0, opacity: 0.7, width: 72, height: 40 },
  },
  items: [
    {
      id: "schedule-1",
      sourceType: "schedule",
      title: "Roofing Work",
      trade: "Roofing",
      workArea: "Roof",
      workStartDate: "2026-05-21",
      workEndDate: "2026-05-21",
      shiftStartTime: "07:00",
      shiftEndTime: "12:00",
      riskLevel: "high",
    },
    {
      id: "schedule-2",
      sourceType: "schedule",
      title: "Electrical Rough-In",
      trade: "Electrical",
      workArea: "Level 2 East",
      workStartDate: "2026-05-21",
      workEndDate: "2026-05-21",
      shiftStartTime: "08:00",
      shiftEndTime: "13:00",
      riskLevel: "critical",
    },
  ],
};

describe("jobsite site visual render helpers", () => {
  it("builds deterministic clickable render overlays from scene zones", () => {
    const scene = buildFallbackSiteVisualScene(input);
    const overlay = buildSiteVisualRenderOverlay(scene);

    expect(overlay.version).toBe(1);
    expect(overlay.disclaimer).toContain("Operational visual aid");
    expect(overlay.activities).toHaveLength(2);
    expect(overlay.activities[0]).toMatchObject({ number: 1, riskLevel: "critical" });
    expect(overlay.activities[0]?.x).toBeGreaterThanOrEqual(0.02);
    expect(overlay.activities[0]?.x).toBeLessThanOrEqual(0.98);
  });

  it("clamps overlay coordinates and dimensions", () => {
    const overlay = cleanSiteVisualRenderOverlay({
      activities: [{ id: "a", zoneId: "z", number: 1000, label: "A", riskLevel: "high", x: -9, y: 9, width: 9, height: 0 }],
      overlaps: [{ id: "o", zoneIds: ["a", "b"], severity: "critical", label: "O", reason: "R", x: -1, y: 2 }],
    });

    expect(overlay.activities[0]).toMatchObject({ number: 99, x: 0.02, y: 0.98, width: 0.32, height: 0.04 });
    expect(overlay.overlaps[0]).toMatchObject({ x: 0.02, y: 0.98 });
  });

  it("builds stable prompt hashes and extracts Responses image output", () => {
    const scene = buildFallbackSiteVisualScene(input);
    const blueprint = input.blueprint!;
    const promptInput = { jobsite: { name: input.jobsite.name }, blueprint, scene };
    const prompt = buildSiteVisualRenderPrompt(promptInput);

    expect(prompt).toContain("multi-level construction cutaway");
    expect(prompt).toContain("Make overlap clarity the primary goal");
    expect(siteVisualRenderPromptHash(promptInput)).toBe(siteVisualRenderPromptHash(promptInput));
    expect(
      extractResponsesImageBase64({
        output: [{ type: "image_generation_call", result: "abc123", revised_prompt: "revised" }],
      })
    ).toEqual({ imageBase64: "abc123", revisedPrompt: "revised" });
  });

  it("builds a deterministic detailed visual fallback SVG from blueprint floor plates and zones", () => {
    const scene = buildFallbackSiteVisualScene(input);
    const blueprint = input.blueprint!;
    const promptInput = { jobsite: { name: input.jobsite.name }, blueprint, scene };
    const svg = buildSiteVisualFallbackRenderSvg(promptInput, undefined, "data:image/png;base64,abc123");

    expect(svg).toContain("<svg");
    expect(svg).toContain("blueprint-plate-0");
    expect(svg).toContain("data:image/png;base64,abc123");
    expect(svg).toContain("OVERLAP / HAZARD AREAS");
    expect(svg).not.toContain("WORK ACTIVITIES");
    expect(svg).not.toContain("SAFETY INSIGHT");
  });
});
