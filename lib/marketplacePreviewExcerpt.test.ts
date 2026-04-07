import { describe, expect, it } from "vitest";
import {
  basenameFromStoragePath,
  hasWorkspaceDocumentStoragePath,
  isAnyPreviewableDocumentPath,
} from "./marketplacePreviewExcerpt";

describe("isAnyPreviewableDocumentPath", () => {
  it("returns true when file_name lacks extension but file_path is pdf", () => {
    expect(
      isAnyPreviewableDocumentPath({
        file_name: "Site safety plan Q1",
        file_path: "company/acme/uploads/abc/site-plan.pdf",
        draft_file_path: null,
        final_file_path: null,
      })
    ).toBe(true);
  });

  it("returns true when draft path is docx and file_name is generic", () => {
    expect(
      isAnyPreviewableDocumentPath({
        file_name: "Draft",
        file_path: null,
        draft_file_path: "drafts/job-12/report.docx",
        final_file_path: null,
      })
    ).toBe(true);
  });

  it("returns false when only non-preview extensions are present", () => {
    expect(
      isAnyPreviewableDocumentPath({
        file_name: "notes.txt",
        file_path: "x/y/z.doc",
        draft_file_path: null,
        final_file_path: null,
      })
    ).toBe(false);
  });
});

describe("hasWorkspaceDocumentStoragePath", () => {
  it("is true for extensionless storage keys when path is set", () => {
    expect(
      hasWorkspaceDocumentStoragePath({
        file_path: "drafts/company-1/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        draft_file_path: null,
        final_file_path: null,
      })
    ).toBe(true);
  });

  it("is false for whitespace-only paths", () => {
    expect(
      hasWorkspaceDocumentStoragePath({
        file_path: "   ",
        draft_file_path: null,
        final_file_path: null,
      })
    ).toBe(false);
  });
});

describe("basenameFromStoragePath", () => {
  it("returns last segment", () => {
    expect(basenameFromStoragePath("drafts/acme/uuid/file")).toBe("file");
  });
});
