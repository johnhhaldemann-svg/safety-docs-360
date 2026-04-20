import JSZip from "jszip";
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

import {
  extractGcProgramDocumentText,
  generateGcProgramAiReview,
  sniffGcDocumentKind,
} from "@/lib/gcProgramAiReview";

async function createCommentedDocx() {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:r><w:t>Prepared by </w:t></w:r>
      <w:commentRangeStart w:id="0"/>
      <w:r><w:t>deterministic</w:t></w:r>
      <w:commentRangeEnd w:id="0"/>
      <w:r><w:commentReference w:id="0"/></w:r>
      <w:r><w:t> assembler</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>16.5 Related Task Triggers</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
  );
  zip.folder("word")?.folder("_rels")?.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
</Relationships>`
  );
  zip.folder("word")?.file(
    "comments.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="0" w:author="john haldemann" w:date="2026-04-16T14:38:00Z">
    <w:p>
      <w:r><w:t>Fix this</w:t></w:r>
    </w:p>
  </w:comment>
</w:comments>`
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

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
      annotations: [],
    });
  });

  it("extracts DOCX comments with anchor text", async () => {
    const result = await extractGcProgramDocumentText(
      await createCommentedDocx(),
      "commented.docx"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.method).toBe("docx");
    expect(result.text).toContain("Prepared by deterministic assembler");
    expect(result.annotations).toEqual([
      expect.objectContaining({
        id: "0",
        author: "john haldemann",
        anchorText: "deterministic",
        note: "Fix this",
      }),
    ]);
  });
});

describe("generateGcProgramAiReview", () => {
  it("surfaces document quality issues and note coverage in deterministic mode", async () => {
    const { review } = await generateGcProgramAiReview({
      documentText: [
        "TEST GC Program",
        "Prepared by safety_plan_deterministic_assembler",
        "Risk Score 672 (critical)",
        "16.5 Related Task Triggers",
      ].join("\n"),
      documentTitle: "GC Review Draft",
      fileName: "gc-review.docx",
      annotations: [
        {
          id: "5",
          author: "john haldemann",
          date: "2026-04-16T14:38:00Z",
          anchorText: "16.5 Related Task Triggers",
          note: "For all of these lets find a way to just list the task and not name them triggers",
        },
      ],
    });

    const qualitySummary = review.documentQualityIssues?.join("\n") ?? "";
    const noteSummary = review.noteCoverage?.join("\n") ?? "";

    expect(qualitySummary).toContain("Placeholder values");
    expect(qualitySummary).toContain("Internal generator wording");
    expect(qualitySummary).toContain("raw risk score");
    expect(qualitySummary).toContain("lists the tasks directly");
    expect(noteSummary).toContain("list the task");
  });
});
