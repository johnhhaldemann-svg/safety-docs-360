import { describe, expect, it } from "vitest";
import { normalizeDocumentsBucketObjectPath } from "./documentsBucketPath";

describe("normalizeDocumentsBucketObjectPath", () => {
  it("passes through normal bucket keys", () => {
    expect(normalizeDocumentsBucketObjectPath("drafts/user/id/file.docx")).toBe(
      "drafts/user/id/file.docx"
    );
  });

  it("strips accidental documents/ prefix", () => {
    expect(normalizeDocumentsBucketObjectPath("documents/drafts/a/b.docx")).toBe("drafts/a/b.docx");
  });

  it("extracts key from public object URL", () => {
    expect(
      normalizeDocumentsBucketObjectPath(
        "https://abc.supabase.co/storage/v1/object/public/documents/drafts/x/y.docx"
      )
    ).toBe("drafts/x/y.docx");
  });

  it("extracts key from authenticated object URL", () => {
    expect(
      normalizeDocumentsBucketObjectPath(
        "https://abc.supabase.co/storage/v1/object/authenticated/documents/drafts/x/y.docx"
      )
    ).toBe("drafts/x/y.docx");
  });

  it("decodes percent-encoded path segments", () => {
    expect(normalizeDocumentsBucketObjectPath("drafts/user/my%20file.pdf")).toBe(
      "drafts/user/my file.pdf"
    );
  });
});
