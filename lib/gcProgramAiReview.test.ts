import { describe, expect, it } from "vitest";
import { sniffGcDocumentKind } from "@/lib/gcProgramAiReview";

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
