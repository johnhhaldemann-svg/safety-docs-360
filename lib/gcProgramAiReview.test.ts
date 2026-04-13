import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse", () => {
  class MockPdfParse {
    constructor(options: { data: Buffer }) {
      void options;
    }

    async getText() {
      return { text: "GC program content" };
    }
  }
  return { default: MockPdfParse, PDFParse: MockPdfParse };
});

import { extractGcProgramDocumentText, sniffGcDocumentKind } from "@/lib/gcProgramAiReview";

describe("sniffGcDocumentKind", () => {
  it("detects PDF by magic bytes", () => {
    const buf = Buffer.from("%PDF-1.4\n");
    expect(sniffGcDocumentKind(buf)).toBe("pdf");
  });

  it("detects ZIP-based OOXML (docx) by magic bytes", () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(sniffGcDocumentKind(buf)).toBe("docx");
  });

  it("returns null for unknown binary", () => {
    expect(sniffGcDocumentKind(Buffer.from("hello"))).toBe(null);
  });
});

describe("extractGcProgramDocumentText", () => {
  it("extracts PDF text even when the parser has no destroy method", async () => {
    const result = await extractGcProgramDocumentText(Buffer.from("%PDF-1.4\n"), "sample.pdf");

    expect(result).toEqual({
      ok: true,
      text: "GC program content",
      truncated: false,
      method: "pdf",
    });
  });
});
