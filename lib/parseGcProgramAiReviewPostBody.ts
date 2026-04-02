import { NextResponse } from "next/server";

const MAX_SITE_DOC_BYTES = 12 * 1024 * 1024;

export type GcProgramAiReviewPostParsed = {
  additionalGcContext: string;
  siteDocument: { buffer: Buffer; fileName: string } | null;
};

export async function parseGcProgramAiReviewPostBody(
  request: Request
): Promise<
  { ok: true; data: GcProgramAiReviewPostParsed } | { ok: false; response: NextResponse }
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

    const ctx = form.get("additionalGcContext");
    const additionalGcContext = typeof ctx === "string" ? ctx : "";

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

    return { ok: true, data: { additionalGcContext, siteDocument } };
  }

  const body = (await request.json().catch(() => null)) as { additionalGcContext?: unknown } | null;
  const additionalGcContext =
    typeof body?.additionalGcContext === "string" ? body.additionalGcContext : "";
  return { ok: true, data: { additionalGcContext, siteDocument: null } };
}
