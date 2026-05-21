import { NextResponse } from "next/server";

const MAX_SITE_DOC_BYTES = 12 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type GcProgramAiReviewPostParsed = {
  additionalGcContext: string;
  siteDocument: { buffer: Buffer; fileName: string } | null;
};

export type BuilderProgramAiReviewPostParsed = {
  additionalReviewerContext: string;
  siteDocument: { buffer: Buffer; fileName: string } | null;
};

export type CompletedCsepCompletenessReviewPostParsed = {
  additionalReviewerContext: string;
  document: { buffer: Buffer; fileName: string };
  siteDocuments: Array<{ buffer: Buffer; fileName: string }>;
};

type ParseContextOpts = {
  contextFormField: string;
  jsonContextKey: string;
};

function isAllowedReviewDocument(file: File) {
  const normalizedName = file.name?.trim().toLowerCase() ?? "";
  const hasAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );
  const normalizedType = file.type?.trim().toLowerCase() ?? "";
  const hasAllowedMime = !normalizedType || ALLOWED_UPLOAD_MIME_TYPES.includes(normalizedType);

  return hasAllowedExtension && hasAllowedMime;
}

async function parseContextAndOptionalSiteFile(
  request: Request,
  opts: ParseContextOpts
): Promise<
  | { ok: true; data: { contextText: string; siteDocument: { buffer: Buffer; fileName: string } | null } }
  | { ok: false; response: NextResponse }
> {
  const ct = request.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid multipart body." }, { status: 400 }),
      };
    }

    const ctx = form.get(opts.contextFormField);
    const contextText = typeof ctx === "string" ? ctx : "";

    const raw = form.get("siteDocument");
    let siteDocument: { buffer: Buffer; fileName: string } | null = null;
    if (raw instanceof File && raw.size > 0) {
      if (raw.size > MAX_SITE_DOC_BYTES) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Site reference file is too large (max 12 MB)." },
            { status: 413 }
          ),
        };
      }
      if (!isAllowedReviewDocument(raw)) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Site reference file must be a PDF or DOCX." },
            { status: 400 }
          ),
        };
      }
      const ab = await raw.arrayBuffer();
      siteDocument = {
        buffer: Buffer.from(ab),
        fileName: raw.name?.trim() || "site-reference.pdf",
      };
    }

    return { ok: true, data: { contextText, siteDocument } };
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const rawCtx = body?.[opts.jsonContextKey];
  const contextText = typeof rawCtx === "string" ? rawCtx : "";
  return { ok: true, data: { contextText, siteDocument: null } };
}

export async function parseGcProgramAiReviewPostBody(
  request: Request
): Promise<
  { ok: true; data: GcProgramAiReviewPostParsed } | { ok: false; response: NextResponse }
> {
  const r = await parseContextAndOptionalSiteFile(request, {
    contextFormField: "additionalGcContext",
    jsonContextKey: "additionalGcContext",
  });
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      additionalGcContext: r.data.contextText,
      siteDocument: r.data.siteDocument,
    },
  };
}

export async function parseBuilderProgramAiReviewPostBody(
  request: Request
): Promise<
  { ok: true; data: BuilderProgramAiReviewPostParsed } | { ok: false; response: NextResponse }
> {
  const r = await parseContextAndOptionalSiteFile(request, {
    contextFormField: "additionalReviewerContext",
    jsonContextKey: "additionalReviewerContext",
  });
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      additionalReviewerContext: r.data.contextText,
      siteDocument: r.data.siteDocument,
    },
  };
}

export async function parseCompletedCsepCompletenessReviewPostBody(
  request: Request
): Promise<
  | { ok: true; data: CompletedCsepCompletenessReviewPostParsed }
  | { ok: false; response: NextResponse }
> {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Completed CSEP review requires multipart form data." },
        { status: 400 }
      ),
    };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid multipart body." }, { status: 400 }),
    };
  }

  const ctx = form.get("additionalReviewerContext");
  const additionalReviewerContext = typeof ctx === "string" ? ctx : "";

  const rawDocument = form.get("document");
  if (!(rawDocument instanceof File) || rawDocument.size <= 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A completed CSEP PDF or DOCX file is required." },
        { status: 400 }
      ),
    };
  }
  if (!isAllowedReviewDocument(rawDocument)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Completed CSEP file must be a PDF or DOCX." },
        { status: 400 }
      ),
    };
  }

  if (rawDocument.size > MAX_SITE_DOC_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Completed CSEP file is too large (max 12 MB)." },
        { status: 413 }
      ),
    };
  }

  const document = {
    buffer: Buffer.from(await rawDocument.arrayBuffer()),
    fileName: rawDocument.name?.trim() || "completed-csep.docx",
  };

  const rawSiteDocuments = form.getAll("siteDocument");
  const siteDocuments: Array<{ buffer: Buffer; fileName: string }> = [];
  for (const rawSiteDocument of rawSiteDocuments) {
    if (!(rawSiteDocument instanceof File) || rawSiteDocument.size <= 0) {
      continue;
    }
    if (rawSiteDocument.size > MAX_SITE_DOC_BYTES) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Each site reference file must be 12 MB or smaller." },
          { status: 413 }
        ),
      };
    }
    if (!isAllowedReviewDocument(rawSiteDocument)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Every site reference file must be a PDF or DOCX." },
          { status: 400 }
        ),
      };
    }

    siteDocuments.push({
      buffer: Buffer.from(await rawSiteDocument.arrayBuffer()),
      fileName: rawSiteDocument.name?.trim() || `site-reference-${siteDocuments.length + 1}.pdf`,
    });
  }

  return {
    ok: true,
    data: {
      additionalReviewerContext,
      document,
      siteDocuments,
    },
  };
}
