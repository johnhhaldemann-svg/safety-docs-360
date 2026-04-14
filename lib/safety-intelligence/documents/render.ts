import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

type DocChild = Paragraph | Table;

function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

function heading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel]
) {
  return new Paragraph({
    heading: level,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });
}

function body(
  text: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
) {
  return new Paragraph({
    alignment,
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function tableCell(text: string, bold = false) {
  return new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    },
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text, bold, size: 20 })],
      }),
    ],
  });
}

function buildTable(columns: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: columns.map((column) => tableCell(column, true)),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((cell) => tableCell(cell || "N/A")),
          })
      ),
    ],
  });
}

function titleForDocumentType(documentType: GeneratedSafetyPlanDraft["documentType"]) {
  if (documentType === "pshsep") {
    return "Project / Site Specific Health, Safety & Environment Plan";
  }
  return "Contractor Site Specific Safety Plan";
}

export async function renderSafetyPlanDocx(draft: GeneratedSafetyPlanDraft) {
  const children: DocChild[] = [];
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: titleForDocumentType(draft.documentType),
          bold: true,
          size: 34,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: draft.projectOverview.projectName, size: 24 })],
    })
  );
  children.push(body(draft.title, AlignmentType.CENTER));

  draft.sectionMap.forEach((section, index) => {
    children.push(heading(`${index + 1}. ${section.title}`, HeadingLevel.HEADING_1));
    if (section.summary) {
      children.push(body(section.summary));
    }
    if (section.body) {
      children.push(body(section.body));
    }
    if (section.bullets?.length) {
      section.bullets.forEach((item) => children.push(bullet(item)));
    }
    if (section.subsections?.length) {
      section.subsections.forEach((subsection) => {
        children.push(heading(subsection.title, HeadingLevel.HEADING_2));
        subsection.bullets.forEach((item) => children.push(bullet(item)));
      });
    }
    if (section.table) {
      children.push(buildTable(section.table.columns, section.table.rows));
    }
  });

  children.push(heading("Disclaimer", HeadingLevel.HEADING_1));
  DOCUMENT_DISCLAIMER_LINES.forEach((line) => {
    children.push(body(line));
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  const projectPart = safeFilePart(draft.projectOverview.projectName, "Project");
  const typePart = draft.documentType.toUpperCase();

  return {
    body: new Uint8Array(buffer),
    filename: `${projectPart}_${typePart}_Draft.docx`,
  };
}
