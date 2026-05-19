import { NextResponse } from "next/server";
import { buildMarketplaceNotes, getDocumentCreditCost, getDocumentPriceCents, isMarketplaceEnabled } from "@/lib/marketplace";
import { authorizeRequest } from "@/lib/rbac";
import { uploadDocumentsBucketObject } from "@/lib/supabaseStorageServer";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function safeFileName(value: string) {
  return (value || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeBoolean(values: FormDataEntryValue[], fallback: boolean) {
  if (values.length === 0) {
    return fallback;
  }
  const value = values[values.length - 1];
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "off") return false;
  return fallback;
}

function normalizePriceCents(value: FormDataEntryValue | null) {
  const price = Number(typeof value === "string" ? value : "");
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  return Math.round(price * 100);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_override_system_controls",
  });
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const { data: existing, error: existingError } = await auth.supabase
    .from("documents")
    .select("id, notes, final_file_path")
    .eq("id", id)
    .is("company_id", null)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: existingError?.message || "Marketplace document not found." },
      { status: 404 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const title = normalizeText(formData.get("title"));
  const documentType = normalizeText(formData.get("documentType"));
  const category = normalizeText(formData.get("category"));
  const enabled = normalizeBoolean(
    formData.getAll("enabled"),
    isMarketplaceEnabled(existing.notes)
  );
  const priceCents = normalizePriceCents(formData.get("price"));

  if (!title) {
    return NextResponse.json({ error: "Document title is required." }, { status: 400 });
  }
  if (!priceCents) {
    return NextResponse.json({ error: "A valid price greater than $0 is required." }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    document_title: title,
    project_name: title,
    document_type: documentType || "Marketplace Document",
    category: category || "Document Library",
    notes: buildMarketplaceNotes(existing.notes, {
      enabled,
      creditCost: getDocumentCreditCost(existing.notes),
      priceCents: priceCents ?? getDocumentPriceCents(existing.notes),
      currency: "usd",
    }),
    marketplace_updated_at: new Date().toISOString(),
    marketplace_updated_by: auth.user.id,
    marketplace_updated_by_email: auth.user.email ?? null,
  };

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const fileName = safeFileName(file.name);
    const storagePath = `marketplace-documents/${id}/${fileName}`;
    const uploaded = await uploadDocumentsBucketObject(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
      { upsert: true }
    );

    if (!uploaded.ok) {
      return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });
    }

    update.file_name = fileName;
    update.file_size = file.size;
    update.final_file_path = uploaded.key;
  }

  const { error } = await auth.supabase
    .from("documents")
    .update(update)
    .eq("id", id)
    .is("company_id", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
