import { describe, expect, it } from "vitest";
import {
  blueprintPreviewPath,
  blueprintSourcePath,
  cleanBlueprintTransform,
  defaultBlueprintTransform,
  validateBlueprintUpload,
} from "@/lib/jobsiteSiteBlueprint";

describe("jobsite site visual blueprints", () => {
  it("validates allowed blueprint uploads and rejects unsafe files", () => {
    expect(
      validateBlueprintUpload({
        fileName: "Level 3 Plan.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        pageNumber: 2,
      })
    ).toMatchObject({
      ok: true,
      fileName: "Level-3-Plan.pdf",
      mimeType: "application/pdf",
      pageNumber: 2,
    });

    expect(validateBlueprintUpload({ fileName: "site.svg", mimeType: "image/svg+xml", fileSize: 100 }).ok).toBe(false);
    expect(validateBlueprintUpload({ fileName: "large.png", mimeType: "image/png", fileSize: 26 * 1024 * 1024 }).ok).toBe(false);
  });

  it("builds scoped private storage paths", () => {
    expect(
      blueprintSourcePath({
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        blueprintId: "blueprint-1",
        fileName: "Plan A",
        mimeType: "image/jpeg",
      })
    ).toBe("companies/company-1/jobsites/jobsite-1/site-visual/blueprints/blueprint-1/source/Plan-A.jpg");

    expect(blueprintPreviewPath("company-1", "jobsite-1", "blueprint-1")).toBe(
      "companies/company-1/jobsites/jobsite-1/site-visual/blueprints/blueprint-1/preview/preview.webp"
    );
  });

  it("clamps blueprint transforms to operational bounds", () => {
    const fallback = defaultBlueprintTransform(2200, 1100);

    expect(
      cleanBlueprintTransform(
        { x: 999, z: -999, scale: 9, rotationY: 99, opacity: 0, width: 999, height: 1 },
        fallback
      )
    ).toMatchObject({
      x: 80,
      z: -80,
      scale: 4,
      opacity: 0.08,
      width: 120,
      height: 12,
    });
  });
});
