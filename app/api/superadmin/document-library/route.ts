import { NextResponse } from "next/server";
import { uploadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import {
  buildMarketplaceNotes,
  getDocumentPriceCents,
  isMarketplaceEnabled,
} from "@/lib/marketplace";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

function safeFileName(value: string) {
  return (value || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizePriceCents(value: FormDataEntryValue | null) {
  const price = Number(typeof value === "string" ? value : "");
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  return Math.round(price * 100);
}

async function requireSuperadmin(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_override_system_controls",
  });
  return auth;
}

export async function GET(request: Request) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("documents")
    .select(
      "id, created_at, document_title, project_name, document_type, category, notes, file_name, file_size, status, final_file_path, marketplace_updated_at, marketplace_updated_by_email"
    )
    .is("company_id", null)
    .not("final_file_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const documents = (data ?? []).map((document) => ({
    ...document,
    marketplaceEnabled: isMarketplaceEnabled(document.notes),
    priceCents: getDocumentPriceCents(document.notes),
  }));

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "A document file is required." }, { status: 400 });
  }

  const title = normalizeText(formData.get("title"));
  const documentType = normalizeText(formData.get("documentType")) || "Marketplace Document";
  const category = normalizeText(formData.get("category")) || "Document Library";
  const priceCents = normalizePriceCents(formData.get("price"));

  if (!title) {
    return NextResponse.json({ error: "Document title is required." }, { status: 400 });
  }
  if (!priceCents) {
    return NextResponse.json({ error: "A valid price greater than $0 is required." }, { status: 400 });
  }

  const documentId = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const storagePath = `marketplace-documents/${documentId}/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const uploaded = await uploadDocumentsBucketObject(storagePath, bytes, contentType, {
    upsert: true,
  });

  if (!uploaded.ok) {
    return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });
  }

  const notes = buildMarketplaceNotes(null, {
    enabled: true,
    creditCost: Math.max(1, Math.ceil(priceCents / 100)),
    priceCents,
    currency: "usd",
  });
  const now = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("documents")
    .insert({
      id: documentId,
      company_id: null,
      user_id: auth.user.id,
      document_title: title,
      project_name: title,
      document_type: documentType,
      category,
      status: "approved",
      notes,
      file_name: fileName,
      file_size: file.size,
      final_file_path: uploaded.key,
      uploaded_by: auth.user.email ?? "Superadmin",
      approved_at: now,
      approved_by: auth.user.id,
      approved_by_email: auth.user.email ?? null,
      marketplace_updated_at: now,
      marketplace_updated_by: auth.user.id,
      marketplace_updated_by_email: auth.user.email ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create marketplace document." },
      { status: 500 }
    );
  }

  return NextResponse.json({ documentId: data.id });
}
