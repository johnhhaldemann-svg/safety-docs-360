import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { GC_REQUIRED_PROGRAM_DOCUMENT_TYPE } from "@/lib/gcRequiredProgram";
import {
  extractGcProgramDocumentText,
  generateGcProgramAiReview,
} from "@/lib/gcProgramAiReview";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
/** Allow time for storage download + PDF/DOCX extraction + OpenAI Responses API. */
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!isSuperAdminRole(auth.role)) {
    return NextResponse.json(
      { error: "Only a super admin can run GC program AI review." },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server storage is not configured." },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const documentId = id.trim();
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { additionalGcContext?: string | null }
    | null;
  const additionalGcContext =
    typeof body?.additionalGcContext === "string" ? body.additionalGcContext : "";

  const { data: row, error: docError } = await admin
    .from("documents")
    .select("id, document_type, file_path, file_name, document_title, notes, company_id")
    .eq("id", documentId)
    .maybeSingle();

  if (docError) {
    return NextResponse.json(
      { error: docError.message || "Failed to load document." },
      { status: 500 }
    );
  }

  const doc = row as {
    id?: string;
    document_type?: string | null;
    file_path?: string | null;
    file_name?: string | null;
    document_title?: string | null;
    notes?: string | null;
    company_id?: string | null;
  } | null;

  if (!doc?.id || !doc.file_path) {
    return NextResponse.json(
      { error: "Document not found or has no file." },
      { status: 404 }
    );
  }

  if ((doc.document_type ?? "").trim() !== GC_REQUIRED_PROGRAM_DOCUMENT_TYPE) {
    return NextResponse.json({ error: "Not a GC program document." }, { status: 400 });
  }

  let companyName: string | null = null;
  if (doc.company_id) {
    const { data: co } = await admin
      .from("companies")
      .select("name")
      .eq("id", doc.company_id)
      .maybeSingle();
    companyName = (co as { name?: string } | null)?.name?.trim() || null;
  }

  const { data: fileBlob, error: dlError } = await admin.storage
    .from("documents")
    .download(doc.file_path);

  if (dlError || !fileBlob) {
    return NextResponse.json(
      { error: dlError?.message || "Could not download file from storage." },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const fileName = doc.file_name?.trim() || "upload";

  try {
    const extracted = await extractGcProgramDocumentText(buffer, fileName);

    const documentText = extracted.ok ? extracted.text : "";
    const extractionMeta = extracted.ok
      ? { ok: true as const, method: extracted.method, truncated: extracted.truncated }
      : { ok: false as const, error: extracted.error };

    const { review, disclaimer } = await generateGcProgramAiReview({
      documentText,
      documentTitle: doc.document_title ?? "",
      fileName,
      companyName,
      recordNotes: doc.notes ?? null,
      additionalGcContext: additionalGcContext.trim() || null,
    });

    return NextResponse.json({
      review,
      disclaimer,
      extraction: extractionMeta,
      documentId: doc.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI review failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 502 }
    );
  }
}
