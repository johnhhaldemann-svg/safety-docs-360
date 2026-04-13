import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { authorizeRequest } from "@/lib/rbac";
import {
  buildMarketplaceNotes,
  getDocumentCreditCost,
  isMarketplaceEnabled,
  marketplacePreviewPathPrefix,
} from "@/lib/marketplace";
import { uploadDocumentsBucketObject } from "@/lib/supabaseStorageServer";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function getPdfPageCount(buffer: Uint8Array) {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    return pdfDoc.getPageCount();
  } catch {
    return null;
  }
}

function normalizePreviewContentType(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_approve_documents",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A preview file is required." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Preview file is too large (max 15 MB)." },
      { status: 400 }
    );
  }

  const contentType = normalizePreviewContentType(file);
  if (!contentType) {
    return NextResponse.json(
      { error: "Only PDF or DOCX preview files are allowed." },
      { status: 400 }
    );
  }

  const { data: document, error: getError } = await auth.supabase
    .from("documents")
    .select("id, notes")
    .eq("id", id)
    .single();

  if (getError || !document) {
    return NextResponse.json(
      { error: getError?.message || "Document not found." },
      { status: 404 }
    );
  }

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120) ||
    "preview";
  const storagePath = `${marketplacePreviewPathPrefix(id)}${safeName}`;
  const fileBuffer = new Uint8Array(await file.arrayBuffer());
  const pageCount = contentType === "application/pdf" ? await getPdfPageCount(fileBuffer) : null;

  const upload = await uploadDocumentsBucketObject(storagePath, fileBuffer, contentType, {
    upsert: true,
  });
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  const notes = buildMarketplaceNotes(document.notes, {
    enabled: isMarketplaceEnabled(document.notes),
    creditCost: getDocumentCreditCost(document.notes),
    previewFilePath: storagePath,
    submitterPreviewStatus: "approved",
  });
  const marketplaceUpdatedAt = new Date().toISOString();

  const { error: updateError } = await auth.supabase
    .from("documents")
    .update({
      notes,
      marketplace_updated_at: marketplaceUpdatedAt,
      marketplace_updated_by: auth.user.id,
      marketplace_updated_by_email: auth.user.email ?? null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    notes,
    previewFilePath: storagePath,
    pageCount,
    marketplaceUpdatedAt,
    marketplaceUpdatedByEmail: auth.user.email ?? null,
  });
}
