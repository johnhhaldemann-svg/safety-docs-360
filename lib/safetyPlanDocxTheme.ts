import { Document, Paragraph, Table } from "docx";

type DocChild = Paragraph | Table;

const BODY_TEXT = "1F1F1F";
const ACCENT_BLUE = "2F5597";

export const SAFETY_PLAN_DOCX_STYLES = {
  default: {
    document: {
      run: {
        font: "Aptos",
        size: 22,
        color: BODY_TEXT,
      },
      paragraph: {
        spacing: {
          after: 120,
          line: 276,
        },
      },
    },
    title: {
      paragraph: {
        spacing: {
          after: 240,
        },
      },
      run: {
        font: "Aptos Display",
        bold: true,
        size: 40,
        color: ACCENT_BLUE,
      },
    },
    heading1: {
      paragraph: {
        spacing: {
          before: 200,
          after: 200,
        },
      },
      run: {
        font: "Aptos Display",
        bold: true,
        size: 32,
        color: ACCENT_BLUE,
      },
    },
    heading2: {
      paragraph: {
        spacing: {
          before: 120,
          after: 120,
        },
      },
      run: {
        font: "Aptos",
        bold: true,
        size: 26,
        color: ACCENT_BLUE,
      },
    },
    heading3: {
      paragraph: {
        spacing: {
          before: 120,
          after: 90,
        },
      },
      run: {
        font: "Aptos",
        bold: true,
        size: 24,
        color: BODY_TEXT,
      },
    },
    strong: {
      run: {
        font: "Aptos",
        bold: true,
        size: 22,
        color: BODY_TEXT,
      },
    },
    listParagraph: {
      paragraph: {
        spacing: {
          after: 120,
        },
        indent: {
          left: 720,
        },
      },
      run: {
        font: "Aptos",
        size: 22,
        color: BODY_TEXT,
      },
    },
    footnoteText: {
      run: {
        font: "Aptos",
        size: 18,
        color: BODY_TEXT,
      },
    },
    endnoteText: {
      run: {
        font: "Aptos",
        size: 18,
        color: BODY_TEXT,
      },
    },
  },
} as const;

export function createSafetyPlanDocument(children: DocChild[]) {
  return new Document({
    styles: SAFETY_PLAN_DOCX_STYLES,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}
