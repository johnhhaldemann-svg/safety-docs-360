import { describe, expect, it } from "vitest";
import { buildSurfaceSystemPrompt } from "@/lib/companyMemory/assist";

describe("buildSurfaceSystemPrompt", () => {
  it("returns surface-specific guidance", () => {
    expect(buildSurfaceSystemPrompt("csep")).toContain("CSEP");
    expect(buildSurfaceSystemPrompt("library")).toContain("company documents");
    expect(buildSurfaceSystemPrompt("corrective_actions")).toContain("corrective");
    expect(buildSurfaceSystemPrompt("jsa")).toContain("job safety");
  });

  it("falls back to default for unknown surface", () => {
    expect(buildSurfaceSystemPrompt("unknown_surface_xyz")).toBe(
      buildSurfaceSystemPrompt("default")
    );
  });
});
