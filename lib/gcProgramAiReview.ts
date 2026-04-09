import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";
import { configurePdfParseWorker } from "@/lib/pdfParseWorker";

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

function ensurePdfJsGlobals() {
  const g = globalThis as PdfJsGlobal;

  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = ServerDOMMatrix as unknown as PdfJsGlobal["DOMMatrix"];
  }

  if (typeof g.DOMMatrixReadOnly === "undefined") {
    g.DOMMatrixReadOnly = g.DOMMatrix;
  }
}

export type GcProgramAiReview = {
  executiveSummary: string;
  /** How well the submission reflects what the GC / site requires the sub to follow on site */
  alignmentWithGcSiteRequirements: string;
  /** Construction-relevant OSHA themes (e.g. fall protection, electrical, PPE, training) — strengths */
  oshaRelatedStrengths: string[];
  /** Gaps, missing elements, or risks relative to typical OSHA expectations for the described work */
  oshaRelatedGapsOrRisks: string[];
  recommendedFollowUps: string[];
  overallAssessment: "sufficient" | "needs_work" | "insufficient_context";
};

function truncateText(text: string, max = MAX_CHARS): { text: string; truncated: boolean } {
  const t = text.replace(/\0/g, "").trim();
  if (t.length <= max) return { text: t, truncated: false };
  return { text: `${t.slice(0, max)}\n\n[…truncated for analysis]`, truncated: true };
}

/** Detect PDF / Office Open XML (docx) when the filename omits or misstates the extension. */
export function sniffGcDocumentKind(buffer: Buffer): "pdf" | "docx" | null {
  if (!buffer || buffer.length < 5) return null;
  // PDF starts with %PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }
  // DOCX / XLSX / other OOXML are ZIP archives (PK…)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "docx";
  }
  return null;
}

async function extractPdfToResult(buffer: Buffer): Promise<{
  ok: true;
  text: string;
  truncated: boolean;
  method: "pdf";
}> {
  type PdfParserInstance = {
    getText: () => PromiseLike<{ text?: string | null }>;
    destroy?: () => PromiseLike<void> | void;
  };

  ensurePdfJsGlobals();

  const pdfParseModule = await import("pdf-parse");
  const PdfParseCtor =
    (pdfParseModule as { PDFParse?: new (options: { data: Buffer }) => PdfParserInstance }).PDFParse ??
    (pdfParseModule as { default?: new (options: { data: Buffer }) => PdfParserInstance }).default ??
    null;

  if (!PdfParseCtor) {
    throw new Error("PDF preview parser is unavailable.");
  }

  configurePdfParseWorker(PdfParseCtor as unknown as { setWorker?: (workerSrc?: string) => string });

  const parser = new PdfParseCtor({ data: buffer });
  try {
    const result = await parser.getText();
    const raw = result.text?.trim() ?? "";
    const { text, truncated } = truncateText(raw);
    return { ok: true, text, truncated, method: "pdf" };
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocxToResult(buffer: Buffer): Promise<{
  ok: true;
  text: string;
  truncated: boolean;
  method: "docx";
}> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const raw = (result.value ?? "").trim();
  const { text, truncated } = truncateText(raw);
  return { ok: true, text, truncated, method: "docx" };
}

/** Extract plain text from uploaded GC program files (PDF, DOCX). */
export async function extractGcProgramDocumentText(
  buffer: Buffer,
  fileName: string
): Promise<
  | { ok: true; text: string; truncated: boolean; method: "pdf" | "docx" }
  | { ok: false; error: string }
> {
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
    else kind = sniffGcDocumentKind(buffer);

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
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not read document text.",
    };
  }
}

function extractResponsesApiOutputText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();

  const output = o.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemObj = item as Record<string, unknown>;
    const content = itemObj.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") chunks.push(p.text);
    }
  }
  const joined = chunks.join("").trim();
  return joined || null;
}

const DISCLAIMER =
  "This AI review is for internal triage only. It is not legal advice, does not replace a competent safety professional or the AHJ, and may omit or misread content. Verify against current OSHA / state rules and the contract documents.";

export async function generateGcProgramAiReview(params: {
  documentText: string;
  documentTitle: string;
  fileName: string;
  companyName?: string | null;
  recordNotes?: string | null;
  /** Pasted GC / site requirements when not fully captured in the file */
  additionalGcContext?: string | null;
  /** Optional uploaded site/GC reference (PDF/DOCX text) to compare against the submission */
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
}): Promise<{ review: GcProgramAiReview; disclaimer: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const hasBody = params.documentText.trim().length >= 80;
  const siteName = params.siteReferenceFileName?.trim() || null;
  const siteText = params.siteReferenceText?.trim() ?? "";
  const hasSiteRef = Boolean(siteName && siteText.length >= 20);

  const contextBlock = [
    `File name: ${params.fileName}`,
    `Title / label: ${params.documentTitle || "(none)"}`,
    params.companyName ? `Company: ${params.companyName}` : null,
    params.recordNotes ? `Record notes: ${params.recordNotes}` : null,
    params.additionalGcContext?.trim()
      ? `Additional GC / site requirements (admin-provided): ${params.additionalGcContext.trim()}`
      : null,
    siteName
      ? hasSiteRef
        ? `--- Site / GC reference document (${siteName}) ---\n${params.siteReferenceText}`
        : `--- Site / GC reference document (${siteName}) ---\n(File uploaded but extractable text is missing or very short; rely on pasted requirements and submission text.)`
      : null,
    hasBody
      ? `--- Subcontractor submission (document under review) ---\n${params.documentText}`
      : `--- Subcontractor submission (document under review) ---\n(No extractable text or too short; rely on metadata and any additional context above.)`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "You are an expert in U.S. OSHA construction safety (29 CFR Part 1926 where relevant) and general industry concepts where they apply to described work.",
    "The primary input is a program, plan, or submission that a subcontractor uploaded because a General Contractor (GC) or site requires them to follow it on site, in addition to regulatory baselines.",
    "Tasks:",
    "1) Assess how well the submission addresses typical OSHA-aligned expectations for the scope implied in the text (hazards, controls, training, PPE, emergency response, competent persons, inspections, etc.) — without inventing citations or claiming the document is filed with OSHA.",
    "2) Assess alignment with what the GC/site expects the sub to follow: use the submission text, any pasted 'Additional GC / site requirements', AND (when present) the 'Site / GC reference document' section as the authoritative site/GC expectations to compare against.",
    "3) When a site/GC reference document is provided, explicitly call out where the submission matches, omits, or conflicts with that reference, in addition to OSHA-oriented gaps.",
    "4) Be specific and practical. If the text is thin or unreadable, set overallAssessment to insufficient_context and explain limitations.",
    "Do NOT invent incidents, citations, or OSHA inspection outcomes. Do not claim to verify regulatory compliance.",
    "Output strict JSON matching the schema.",
    contextBlock,
  ].join("\n\n");

  const res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAiCompatibleModelId("gpt-4.1"),
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "gc_program_ai_review",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              executiveSummary: { type: "string" },
              alignmentWithGcSiteRequirements: { type: "string" },
              oshaRelatedStrengths: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              oshaRelatedGapsOrRisks: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 8,
              },
              recommendedFollowUps: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              overallAssessment: {
                type: "string",
                enum: ["sufficient", "needs_work", "insufficient_context"],
              },
            },
            required: [
              "executiveSummary",
              "alignmentWithGcSiteRequirements",
              "oshaRelatedStrengths",
              "oshaRelatedGapsOrRisks",
              "recommendedFollowUps",
              "overallAssessment",
            ],
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errText.slice(0, 500)}`);
  }

  const json: unknown = await res.json();
  const rawText = extractResponsesApiOutputText(json);
  if (!rawText) {
    throw new Error("Empty model output.");
  }

  let parsed: Partial<GcProgramAiReview>;
  try {
    parsed = JSON.parse(rawText) as Partial<GcProgramAiReview>;
  } catch {
    throw new Error("Could not parse model JSON.");
  }

  const review: GcProgramAiReview = {
    executiveSummary: String(parsed.executiveSummary ?? "").trim() || "No summary returned.",
    alignmentWithGcSiteRequirements: String(parsed.alignmentWithGcSiteRequirements ?? "").trim() || "—",
    oshaRelatedStrengths: Array.isArray(parsed.oshaRelatedStrengths)
      ? parsed.oshaRelatedStrengths.filter((x) => typeof x === "string" && x.trim())
      : [],
    oshaRelatedGapsOrRisks: Array.isArray(parsed.oshaRelatedGapsOrRisks)
      ? parsed.oshaRelatedGapsOrRisks.filter((x) => typeof x === "string" && x.trim())
      : [],
    recommendedFollowUps: Array.isArray(parsed.recommendedFollowUps)
      ? parsed.recommendedFollowUps.filter((x) => typeof x === "string" && x.trim())
      : [],
    overallAssessment:
      parsed.overallAssessment === "sufficient" ||
      parsed.overallAssessment === "needs_work" ||
      parsed.overallAssessment === "insufficient_context"
        ? parsed.overallAssessment
        : "insufficient_context",
  };

  return { review, disclaimer: DISCLAIMER };
}
