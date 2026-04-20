import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { ensurePdfParseWorkerHandler } from "@/lib/pdfParseWorker";

const MAX_CHARS = 90_000;

class ServerDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: unknown) {
    if (Array.isArray(init) && init.length >= 6) {
      const [a, b, c, d, e, f] = init;
      this.a = Number(a) || 1;
      this.b = Number(b) || 0;
      this.c = Number(c) || 0;
      this.d = Number(d) || 1;
      this.e = Number(e) || 0;
      this.f = Number(f) || 0;
    } else if (init && typeof init === "object") {
      const obj = init as Partial<Record<"a" | "b" | "c" | "d" | "e" | "f", unknown>>;
      if (typeof obj.a === "number") this.a = obj.a;
      if (typeof obj.b === "number") this.b = obj.b;
      if (typeof obj.c === "number") this.c = obj.c;
      if (typeof obj.d === "number") this.d = obj.d;
      if (typeof obj.e === "number") this.e = obj.e;
      if (typeof obj.f === "number") this.f = obj.f;
    }
  }

  translate(tx = 0, ty = 0) {
    this.e += tx;
    this.f += ty;
    return this;
  }

  scale(scaleX = 1, scaleY = scaleX) {
    this.a *= scaleX;
    this.d *= scaleY;
    this.e *= scaleX;
    this.f *= scaleY;
    return this;
  }

  multiply(other: unknown) {
    const matrix = other instanceof ServerDOMMatrix ? other : new ServerDOMMatrix(other);
    return new ServerDOMMatrix([
      this.a * matrix.a + this.c * matrix.b,
      this.b * matrix.a + this.d * matrix.b,
      this.a * matrix.c + this.c * matrix.d,
      this.b * matrix.c + this.d * matrix.d,
      this.a * matrix.e + this.c * matrix.f + this.e,
      this.b * matrix.e + this.d * matrix.f + this.f,
    ]);
  }

  inverse() {
    const determinant = this.a * this.d - this.b * this.c;
    if (!determinant) {
      return new ServerDOMMatrix();
    }
    return new ServerDOMMatrix([
      this.d / determinant,
      -this.b / determinant,
      -this.c / determinant,
      this.a / determinant,
      (this.c * this.f - this.d * this.e) / determinant,
      (this.b * this.e - this.a * this.f) / determinant,
    ]);
  }

  toFloat32Array() {
    return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]);
  }
}

type PdfJsGlobal = typeof globalThis & {
  DOMMatrix?: {
    new (init?: string | number[] | undefined): unknown;
  };
  DOMMatrixReadOnly?: {
    new (init?: string | number[] | undefined): unknown;
  };
};

type XmlNode = {
  nodeName?: string | null;
  textContent?: string | null;
  childNodes?: ArrayLike<XmlNode>;
  attributes?: ArrayLike<{ name?: string | null; value?: string | null }>;
};

export type ReviewDocumentAnnotation = {
  id: string;
  author: string | null;
  date: string | null;
  anchorText: string;
  note: string;
};

export type ExtractedReviewDocument =
  | {
      ok: true;
      text: string;
      truncated: boolean;
      method: "pdf" | "docx";
      annotations: ReviewDocumentAnnotation[];
    }
  | {
      ok: false;
      error: string;
    };

function ensurePdfJsGlobals() {
  const g = globalThis as PdfJsGlobal;

  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = ServerDOMMatrix as unknown as PdfJsGlobal["DOMMatrix"];
  }

  if (typeof g.DOMMatrixReadOnly === "undefined") {
    g.DOMMatrixReadOnly = g.DOMMatrix;
  }
}

function localName(nodeName: string | null | undefined) {
  if (!nodeName) return "";
  const parts = nodeName.split(":");
  return parts[parts.length - 1] ?? "";
}

function getAttributeByLocalName(node: XmlNode, name: string) {
  const attrs = node.attributes ?? [];
  for (let index = 0; index < attrs.length; index += 1) {
    const attr = attrs[index];
    if (localName(attr?.name) === name) {
      return attr?.value?.trim() ?? "";
    }
  }
  return "";
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(text: string, max = MAX_CHARS): { text: string; truncated: boolean } {
  const cleaned = text.replace(/\0/g, "").trim();
  if (cleaned.length <= max) return { text: cleaned, truncated: false };
  return {
    text: `${cleaned.slice(0, max)}\n\n[...truncated for analysis]`,
    truncated: true,
  };
}

function collectText(node: XmlNode, parts: string[]) {
  const name = localName(node.nodeName);

  if (name === "t" || name === "delText") {
    if (node.textContent) {
      parts.push(node.textContent);
    }
    return;
  }

  if (name === "tab") {
    parts.push(" ");
    return;
  }

  if (name === "br" || name === "cr") {
    parts.push("\n");
    return;
  }

  const children = node.childNodes ?? [];
  for (let index = 0; index < children.length; index += 1) {
    collectText(children[index], parts);
  }

  if (name === "p") {
    parts.push("\n");
  }
}

function getElementsByLocalName(doc: Document, name: string): XmlNode[] {
  const result: XmlNode[] = [];
  const elements = doc.getElementsByTagName("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (localName(element.nodeName) === name) {
      result.push(element);
    }
  }
  return result;
}

function extractCommentAnchorMap(documentXml: string) {
  const doc = new DOMParser().parseFromString(documentXml, "text/xml");
  const anchorTextById = new Map<string, string>();
  const activeCommentIds: string[] = [];

  const appendForActiveComments = (value: string) => {
    if (!value || activeCommentIds.length === 0) return;
    for (const id of activeCommentIds) {
      anchorTextById.set(id, `${anchorTextById.get(id) ?? ""}${value}`);
    }
  };

  const walk = (node: XmlNode) => {
    const name = localName(node.nodeName);

    if (name === "commentRangeStart") {
      const id = getAttributeByLocalName(node, "id");
      if (id && !activeCommentIds.includes(id)) {
        activeCommentIds.push(id);
      }
      return;
    }

    if (name === "commentRangeEnd") {
      const id = getAttributeByLocalName(node, "id");
      const index = activeCommentIds.indexOf(id);
      if (index >= 0) {
        activeCommentIds.splice(index, 1);
      }
      return;
    }

    if (name === "t" || name === "delText") {
      appendForActiveComments(node.textContent ?? "");
      return;
    }

    if (name === "tab") {
      appendForActiveComments(" ");
      return;
    }

    if (name === "br" || name === "cr") {
      appendForActiveComments("\n");
      return;
    }

    const children = node.childNodes ?? [];
    for (let index = 0; index < children.length; index += 1) {
      walk(children[index]);
    }

    if (name === "p") {
      appendForActiveComments("\n");
    }
  };

  walk(doc.documentElement);

  const normalized = new Map<string, string>();
  for (const [id, value] of anchorTextById.entries()) {
    const cleaned = normalizeWhitespace(value);
    if (cleaned) {
      normalized.set(id, cleaned);
    }
  }

  return normalized;
}

async function extractDocxAnnotations(buffer: Buffer): Promise<ReviewDocumentAnnotation[]> {
  const zip = await JSZip.loadAsync(buffer);
  const commentsFile = zip.file("word/comments.xml");
  if (!commentsFile) return [];

  const commentsXml = await commentsFile.async("text");
  const documentXml = await zip.file("word/document.xml")?.async("text");
  const anchorTextById = documentXml ? extractCommentAnchorMap(documentXml) : new Map<string, string>();
  const doc = new DOMParser().parseFromString(commentsXml, "text/xml");
  const commentNodes = getElementsByLocalName(doc, "comment");

  return commentNodes
    .map((commentNode) => {
      const parts: string[] = [];
      collectText(commentNode, parts);

      return {
        id: getAttributeByLocalName(commentNode, "id"),
        author: getAttributeByLocalName(commentNode, "author") || null,
        date: getAttributeByLocalName(commentNode, "date") || null,
        anchorText: normalizeWhitespace(
          anchorTextById.get(getAttributeByLocalName(commentNode, "id")) ?? ""
        ),
        note: normalizeWhitespace(parts.join(" ")),
      } satisfies ReviewDocumentAnnotation;
    })
    .filter((annotation) => annotation.id && annotation.note);
}

export function sniffReviewDocumentKind(buffer: Buffer): "pdf" | "docx" | null {
  if (!buffer || buffer.length < 5) return null;
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "docx";
  }
  return null;
}

async function extractPdfToResult(buffer: Buffer): Promise<ExtractedReviewDocument> {
  type PdfParserInstance = {
    getText: () => PromiseLike<{ text?: string | null }>;
    destroy?: () => PromiseLike<void> | void;
  };

  ensurePdfJsGlobals();
  await ensurePdfParseWorkerHandler();

  const pdfParseModule = await import("pdf-parse");
  const PdfParseCtor =
    (pdfParseModule as { PDFParse?: new (options: { data: Buffer }) => PdfParserInstance }).PDFParse ??
    (pdfParseModule as { default?: new (options: { data: Buffer }) => PdfParserInstance }).default ??
    null;

  if (!PdfParseCtor) {
    throw new Error("PDF preview parser is unavailable.");
  }

  const parser = new PdfParseCtor({ data: buffer });
  try {
    const result = await parser.getText();
    const raw = result.text?.trim() ?? "";
    const { text, truncated } = truncateText(raw);
    return {
      ok: true,
      text,
      truncated,
      method: "pdf",
      annotations: [],
    };
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocxToResult(buffer: Buffer): Promise<ExtractedReviewDocument> {
  const mammoth = await import("mammoth");
  const [result, annotations] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    extractDocxAnnotations(buffer),
  ]);
  const raw = (result.value ?? "").trim();
  const { text, truncated } = truncateText(raw);
  return {
    ok: true,
    text,
    truncated,
    method: "docx",
    annotations,
  };
}

export async function extractReviewDocumentText(
  buffer: Buffer,
  fileName: string
): Promise<ExtractedReviewDocument> {
  const lower = fileName.toLowerCase();

  try {
    if (lower.endsWith(".doc")) {
      return {
        ok: false,
        error: "Legacy .doc format is not supported. Upload PDF or DOCX for AI review.",
      };
    }

    let kind: "pdf" | "docx" | null = null;
    if (lower.endsWith(".pdf")) kind = "pdf";
    else if (lower.endsWith(".docx")) kind = "docx";
    else kind = sniffReviewDocumentKind(buffer);

    if (kind === "pdf") {
      return await extractPdfToResult(buffer);
    }

    if (kind === "docx") {
      return await extractDocxToResult(buffer);
    }

    return {
      ok: false,
      error: "Unsupported file type for text extraction. Use PDF or DOCX.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read document text.",
    };
  }
}
