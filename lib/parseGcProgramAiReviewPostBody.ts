import { NextResponse } from "next/server";

const MAX_SITE_DOC_BYTES = 12 * 1024 * 1024;

export type GcProgramAiReviewPostParsed = {
  additionalGcContext: string;
  siteDocument: { buffer: Buffer; fileName: string } | null;
};

export type BuilderProgramAiReviewPostParsed = {
  additionalReviewerContext: string;
  siteDocument: { buffer: Buffer; fileName: string } | null;
};

type ParseContextOpts = {
  contextFormField: string;
  jsonContextKey: string;
};

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
