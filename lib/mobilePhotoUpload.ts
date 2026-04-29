import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const DOCUMENTS_BUCKET = "documents";

export function sanitizeMobileFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "photo.jpg";
}

export function isMultipartPhotoRequest(request: Request) {
  return (request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data");
}

export async function uploadMobilePhotoFromRequest(request: Request, pathPrefix: string) {
  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    throw new Error("photo file is required.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Missing storage configuration.");
  }

  const fileName = sanitizeMobileFileName(String(form.get("fileName") || photo.name || "photo.jpg"));
  const mimeType = String(form.get("mimeType") || photo.type || "image/jpeg");
  const path = `${pathPrefix}/${Date.now()}-${fileName}`;
  const upload = await adminClient.storage.from(DOCUMENTS_BUCKET).upload(path, photo, {
    contentType: mimeType,
    upsert: false,
  });
  if (upload.error) {
    throw new Error(upload.error.message || "Failed to upload photo.");
  }

  return { bucket: DOCUMENTS_BUCKET, filePath: path, fileName, mimeType };
}
