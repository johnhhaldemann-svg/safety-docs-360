import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { renderGeneratedCsepDocx } from "@/lib/csepDocxRenderer";
import {
  getCsepExportValidationDetail,
  isCsepExportValidationError,
} from "@/lib/csepExportValidation";
import { loadGeneratedDocumentDraft } from "@/lib/safety-intelligence/repository";
import { renderSafetyPlanDocx } from "@/lib/safety-intelligence/documents/render";
import { uploadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import { serverLog } from "@/lib/serverLog";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function renderStoredDraft(normalizedType: string, draft: GeneratedSafetyPlanDraft) {
  try {
    return normalizedType === "CSEP"
      ? await renderGeneratedCsepDocx(draft)
      : await renderSafetyPlanDocx(draft);
  } catch (error) {
    if (normalizedType === "CSEP" && isCsepExportValidationError(error)) {
      return NextResponse.json(
        {
          error: `This CSEP draft is not ready to regenerate: ${getCsepExportValidationDetail(
            error
          )} Update the builder inputs and regenerate the AI draft first.`,
        },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorizeRequest(request, {
      requirePermission: "can_approve_documents",
    });

    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, user } = auth;
    const { id } = await context.params;
    const documentId = id.trim();

    if (!documentId) {
      return NextResponse.json({ error: "Document id is required." }, { status: 400 });
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, document_type, status, draft_file_path, generated_document_id")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (document.status?.trim().toLowerCase() === "archived") {
      return NextResponse.json({ error: "Document is archived." }, { status: 404 });
    }

    const draftFilePath = document.draft_file_path?.trim();
    if (!draftFilePath) {
      return NextResponse.json(
        { error: "This document does not have a stored draft file path yet." },
        { status: 400 }
      );
    }

    const generatedDocumentId = String(document.generated_document_id ?? "").trim();
    if (!generatedDocumentId) {
      return NextResponse.json(
        { error: "This document cannot be regenerated because no generated draft is attached." },
        { status: 400 }
      );
    }

    const normalizedType = String(document.document_type ?? "").trim().toUpperCase();
    const draft = await loadGeneratedDocumentDraft(supabase, generatedDocumentId);
    const rendered = await renderStoredDraft(normalizedType, draft);

    if (rendered instanceof NextResponse) {
      return rendered;
    }

    const upload = await uploadDocumentsBucketObject(
      draftFilePath,
      rendered.body,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      { upsert: true }
    );

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: upload.status });
    }

    return NextResponse.json({
      success: true,
      documentId,
      draftFilePath,
      regeneratedBy: user.email ?? null,
    });
  } catch (error) {
    serverLog("error", "admin_regenerate_draft_failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "Draft regeneration failed unexpectedly.",
      },
      { status: 500 }
    );
  }
}
