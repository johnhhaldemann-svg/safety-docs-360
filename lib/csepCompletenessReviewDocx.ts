import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  LevelSuffix,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  BuilderProgramAiReview,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";
import {
  getCsepFindingNoteFields,
  getCsepSectionNoteFields,
} from "@/lib/csepReviewNoteFormat";

const REVIEW_OUTLINE_REFERENCE = "review-outline";

function paragraph(
  text: string,
  options?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bold?: boolean }
) {
  return new Paragraph({
    heading: options?.heading,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
      }),
    ],
  });
}

function summaryTable(rows: Array<[string, string]>) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                bottom: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                left: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                right: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
              },
              children: [paragraph(label, { bold: true })],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                bottom: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                left: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                right: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
              },
              children: [paragraph(value || "Not provided.")],
            }),
          ],
        })
    ),
  });
}

function sectionHeading(text: string) {
  return outlineParagraph(text, 0, {
    heading: HeadingLevel.HEADING_1,
    bold: true,
  });
}

function outlineParagraph(
  text: string,
  level: number,
  options?: {
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
  }
) {
  return new Paragraph({
    heading: options?.heading,
    numbering: {
      reference: REVIEW_OUTLINE_REFERENCE,
      level,
    },
    spacing: {
      before: level === 0 ? 280 : level === 1 ? 180 : 80,
      after: level === 0 ? 180 : level === 1 ? 120 : 80,
      line: 276,
      lineRule: LineRuleType.AUTO,
    },
    border:
      level === 0
        ? {
            bottom: {
              style: BorderStyle.SINGLE,
              color: "A7BED8",
              size: 3,
            },
          }
        : undefined,
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        italics: options?.italics,
      }),
    ],
  });
}

function outlineDetail(label: string, value: string) {
  return new Paragraph({
    numbering: {
      reference: REVIEW_OUTLINE_REFERENCE,
      level: 2,
    },
    spacing: {
      before: 60,
      after: 80,
      line: 276,
      lineRule: LineRuleType.AUTO,
    },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
      }),
      new TextRun({
        text: value || "Not provided.",
      }),
    ],
  });
}

function outlineListItem(text: string) {
  return outlineParagraph(text, 1);
}

function statusLabel(status: BuilderProgramAiReviewSectionNote["status"]) {
  if (status === "present") return "Present";
  if (status === "missing") return "Missing";
  return "Partial";
}

function topPriorityFindings(review: BuilderProgramAiReview) {
  return review.detailedFindings.slice(0, 5).flatMap((finding) => [
    outlineParagraph(finding.sectionLabel, 1, { heading: HeadingLevel.HEADING_2, bold: true }),
    ...getCsepFindingNoteFields(finding).map((field) => outlineDetail(field.label, field.value)),
  ]);
}

function sectionAuditBlock(note: BuilderProgramAiReviewSectionNote) {
  return [
    outlineParagraph(`${note.sectionLabel} (${statusLabel(note.status)})`, 1, {
      heading: HeadingLevel.HEADING_2,
      bold: true,
    }),
    ...getCsepSectionNoteFields(note).map((field) => outlineDetail(field.label, field.value)),
  ];
}

function findingBlock(finding: BuilderProgramAiReview["detailedFindings"][number]) {
  return [
    outlineParagraph(finding.sectionLabel, 1, {
      heading: HeadingLevel.HEADING_2,
      bold: true,
    }),
    ...getCsepFindingNoteFields(finding).map((field) => outlineDetail(field.label, field.value)),
  ];
}

export async function renderCsepCompletenessReviewNotesDocx(params: {
  sourceFileName: string;
  review: BuilderProgramAiReview;
  disclaimer: string;
  reviewerContext?: string | null;
  extractionSummary?: string | null;
  siteReferenceSummary?: string | null;
}) {
  const docChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: "Completed CSEP Review Notes",
          bold: true,
          size: 32,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: `Source document: ${params.sourceFileName}`,
          italics: true,
        }),
      ],
    }),
    summaryTable([
      ["Overall assessment", params.review.overallAssessment.replace(/_/g, " ")],
      ["Executive summary", params.review.executiveSummary],
      ["Scope / hazard coverage", params.review.scopeTradeAndHazardCoverage],
      ["Extraction summary", params.extractionSummary ?? "Not provided."],
      ["Site reference summary", params.siteReferenceSummary ?? "No site / GC reference file attached."],
      ["Reviewer context", params.reviewerContext?.trim() || "No additional reviewer context provided."],
    ]),
    sectionHeading("Missing-items checklist"),
    ...(params.review.missingItemsChecklist.length
      ? params.review.missingItemsChecklist.map((item) => outlineListItem(item))
      : [paragraph("No missing items were identified.")]),
    sectionHeading("Top priority fixes"),
    ...(params.review.detailedFindings.length
      ? topPriorityFindings(params.review)
      : [paragraph("No priority fixes were returned.")]),
    sectionHeading("Builder alignment notes"),
    ...(params.review.builderAlignmentNotes.length
      ? params.review.builderAlignmentNotes.map((item) => outlineListItem(item))
      : [paragraph("No builder alignment notes were returned.")]),
    sectionHeading("Section-by-section builder audit"),
    ...params.review.sectionReviewNotes.flatMap((item) => sectionAuditBlock(item)),
    sectionHeading("Document review findings"),
    ...params.review.detailedFindings.flatMap((finding) => findingBlock(finding)),
    sectionHeading("Document quality notes"),
    ...(params.review.documentQualityIssues?.length
      ? params.review.documentQualityIssues.map((item) => outlineListItem(item))
      : [paragraph("No document quality issues were flagged.")]),
    sectionHeading("Recommended edits"),
    ...(params.review.recommendedEditsBeforeApproval.length
      ? params.review.recommendedEditsBeforeApproval.map((item) => outlineListItem(item))
      : [paragraph("No recommended edits were returned.")]),
    sectionHeading("Embedded note coverage"),
    ...(params.review.noteCoverage?.length
      ? params.review.noteCoverage.map((item) => outlineListItem(item))
      : [paragraph("No embedded DOCX comment coverage was returned.")]),
    sectionHeading("Internal disclaimer"),
    paragraph(params.disclaimer),
  ];

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: REVIEW_OUTLINE_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: {
                  indent: { left: 480, hanging: 240 },
                  spacing: { before: 280, after: 180 },
                },
                run: {
                  bold: true,
                  color: "1F3E63",
                  size: 28,
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%1.%2",
              alignment: AlignmentType.START,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: {
                  indent: { left: 960, hanging: 360 },
                  spacing: { before: 180, after: 120 },
                },
                run: {
                  bold: true,
                  color: "1F3E63",
                  size: 24,
                },
              },
            },
            {
              level: 2,
              format: LevelFormat.DECIMAL,
              text: "%1.%2.%3",
              alignment: AlignmentType.START,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: {
                  indent: { left: 1440, hanging: 420 },
                  spacing: { before: 80, after: 80 },
                },
                run: {
                  color: "1F1F1F",
                  size: 22,
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: docChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
