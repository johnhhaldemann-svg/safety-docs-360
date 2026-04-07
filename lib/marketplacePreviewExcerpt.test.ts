import { describe, expect, it } from "vitest";
import {
  basenameFromStoragePath,
  canRequestMarketplaceLibraryPreview,
  hasWorkspaceDocumentStoragePath,
  isAnyPreviewableDocumentPath,
  pickWorkspacePreviewStoragePath,
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

describe("canRequestMarketplaceLibraryPreview", () => {
  it("is true when custom preview path is pdf", () => {
    expect(
      canRequestMarketplaceLibraryPreview({
        notes: JSON.stringify({
          marketplace: { enabled: true, previewFilePath: "marketplace-preview/x/p.pdf" },
        }),
        final_file_path: null,
      })
    ).toBe(true);
  });

  it("is true when no custom preview but final is docx", () => {
    expect(
      canRequestMarketplaceLibraryPreview({
        notes: JSON.stringify({ marketplace: { enabled: true } }),
        final_file_path: "final/uuid/Job_CSEP_Draft.docx",
      })
    ).toBe(true);
  });

  it("is false when marketplace disabled", () => {
    expect(
      canRequestMarketplaceLibraryPreview({
        notes: JSON.stringify({ marketplace: { enabled: false } }),
        final_file_path: "final/uuid/x.docx",
      })
    ).toBe(false);
  });

  it("is true for extensionless final path when marketplace listed", () => {
    expect(
      canRequestMarketplaceLibraryPreview({
        notes: JSON.stringify({ marketplace: { enabled: true } }),
        final_file_path: "final/uuid/blobkey",
      })
    ).toBe(true);
  });
});

describe("pickWorkspacePreviewStoragePath", () => {
  it("prefers draft over file_path while in review", () => {
    expect(
      pickWorkspacePreviewStoragePath({
        status: "submitted",
        file_path: "companies/x/old/wrong.pdf",
        draft_file_path: "drafts/uuid/doc.docx",
        final_file_path: null,
      })
    ).toBe("drafts/uuid/doc.docx");
  });

  it("prefers final_file_path when approved", () => {
    expect(
      pickWorkspacePreviewStoragePath({
        status: "approved",
        file_path: "companies/x/upload.pdf",
        draft_file_path: "drafts/uuid/old.docx",
        final_file_path: "final/uuid/final.pdf",
      })
    ).toBe("final/uuid/final.pdf");
  });
});
