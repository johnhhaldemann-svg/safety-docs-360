import {
  AlignmentType,
  Document,
  Footer,
  PageBreak,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";
import { polishCsepDocxNarrativeText } from "@/lib/csepDocxNarrativePolish";
import { CONTRACTOR_SAFETY_BLUEPRINT_TITLE } from "@/lib/safetyBlueprintLabels";

type DocChild = Paragraph;

type CoverOptions = {
  projectName: string;
  subtitle?: string | null;
  contractorName?: string | null;
};

export const CSEP_STYLE_IDS = {
  body: "BodyTextCustom",
  sectionTitle: "SectionTitle",
  subhead: "SubheadCustom",
} as const;

const COLORS = {
  titleBlue: "17365D",
  accentBlue: "1F4E78",
  lightBorder: "D9E1F2",
  lightFill: "EEF4FA",
  footerGray: "666666",
  mutedText: "5B6B7A",
  bodyText: "1F1F1F",
  subheadText: "404040",
};

function sectionParagraph(options: IParagraphOptions) {
  return new Paragraph({
    style: CSEP_STYLE_IDS.sectionTitle,
    ...options,
  });
}

export function createCsepBody(
  text: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
) {
  return new Paragraph({
    style: CSEP_STYLE_IDS.body,
    alignment,
    children: [
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Aptos",
        size: 21,
        color: COLORS.bodyText,
      }),
    ],
  });
}

export function createCsepSectionHeading(text: string) {
  return sectionParagraph({
    children: [
      new TextRun({
        text,
        font: "Aptos Display",
        bold: true,
        color: COLORS.accentBlue,
        size: 30,
      }),
    ],
    spacing: { before: 180, after: 100 },
  });
}

export function createCsepSubheading(text: string) {
  return new Paragraph({
    style: CSEP_STYLE_IDS.subhead,
    children: [
      new TextRun({
        text,
        font: "Aptos",
        bold: true,
        color: COLORS.subheadText,
        size: 22,
      }),
    ],
  });
}

export function createCsepPageBreak() {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

export function createCsepLabeledParagraph(
  label: string,
  value: string,
  options: {
    prefix?: string;
    indentLeft?: number;
    spacingAfter?: number;
  } = {}
) {
  const trimmed = value?.trim() ? value.trim() : "N/A";
  const lines = trimmed.split("\n");
  const valueRuns: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      valueRuns.push(new TextRun({ break: 1 }));
    }
    valueRuns.push(
      new TextRun({
        text: polishCsepDocxNarrativeText(line),
        font: "Aptos",
        size: 21,
        color: COLORS.bodyText,
      })
    );
  });

  return new Paragraph({
    style: CSEP_STYLE_IDS.body,
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
    spacing: { after: options.spacingAfter ?? 100 },
    children: [
      ...(options.prefix ? [new TextRun({ text: `${options.prefix} ` })] : []),
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: "Aptos",
        size: 21,
        color: COLORS.subheadText,
      }),
      ...valueRuns,
    ],
  });
}

export function createCsepCover(options: CoverOptions): Paragraph[] {
  const subtitle = options.subtitle?.trim();
  const contractorName = options.contractorName?.trim();

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "SafetyDocs360",
          font: "Aptos Display",
          bold: true,
          color: COLORS.accentBlue,
          size: 40,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "PROJECT / SITE SPECIFIC",
          font: "Aptos",
          bold: true,
          color: COLORS.mutedText,
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: CONTRACTOR_SAFETY_BLUEPRINT_TITLE.toUpperCase(),
          font: "Aptos Display",
          bold: true,
          color: COLORS.titleBlue,
          size: 44,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: options.projectName,
          font: "Aptos",
          bold: true,
          color: COLORS.subheadText,
          size: 26,
        }),
      ],
    }),
  ];

  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: subtitle,
            font: "Aptos",
            size: 21,
            color: COLORS.bodyText,
          }),
        ],
      })
    );
  }

  if (contractorName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Contractor: ${contractorName}`,
            font: "Aptos",
            size: 21,
            color: COLORS.bodyText,
          }),
        ],
      })
    );
  }

  return children;
}

export function createCsepInfoTable(
  rows: Array<[string, string, string, string]>
) {
  return rows.flatMap(([labelOne, valueOne, labelTwo, valueTwo]) => [
    createCsepLabeledParagraph(labelOne, valueOne),
    createCsepLabeledParagraph(labelTwo, valueTwo),
  ]);
}

export function createCsepDocument(children: DocChild[]) {
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Aptos",
            size: 22,
            color: COLORS.bodyText,
          },
          paragraph: {
            spacing: {
              after: 200,
              line: 276,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: CSEP_STYLE_IDS.body,
          name: CSEP_STYLE_IDS.body,
          paragraph: {
            spacing: {
              after: 100,
              line: 269,
            },
          },
          run: {
            font: "Aptos",
            size: 21,
          },
        },
        {
          id: CSEP_STYLE_IDS.sectionTitle,
          name: CSEP_STYLE_IDS.sectionTitle,
          paragraph: {
            spacing: {
              after: 100,
            },
          },
          run: {
            font: "Aptos Display",
            bold: true,
            color: COLORS.accentBlue,
            size: 30,
          },
        },
        {
          id: CSEP_STYLE_IDS.subhead,
          name: CSEP_STYLE_IDS.subhead,
          paragraph: {
            spacing: {
              after: 100,
            },
          },
          run: {
            font: "Aptos",
            bold: true,
            color: COLORS.subheadText,
            size: 22,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1008,
              right: 1152,
              bottom: 864,
              left: 1152,
              header: 720,
              footer: 720,
              gutter: 0,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                style: CSEP_STYLE_IDS.body,
                children: [
                  new TextRun({
                    text: `SafetyDocs360 | ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} | Submission-ready CSEP`,
                    font: "Aptos",
                    size: 17,
                    color: COLORS.footerGray,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

export function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

export function valueOrNA(value?: string | null) {
  return value?.trim() ? value.trim() : "N/A";
}
