import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { runGusPhotoReview } from "@/lib/gus/gusPhotoReview";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).type === "string" &&
    typeof (value as File).size === "number"
  );
}

function parseJsonField(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseStringField(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") ?? null;
  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "Upload one jobsite photo for Gus to review." }, { status: 400 });
  }

  const mimeType = file.type.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Gus can review PNG, JPEG, or WEBP photos." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Uploaded photo is empty." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Photo must be 8 MB or smaller." }, { status: 413 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  }).catch(() => ({ companyId: null }));
  const context = parseJsonField(formData?.get("context") ?? null);
  const requestContext = context && typeof context === "object" && !Array.isArray(context) ? context : {};
  const companyId =
    "companyId" in requestContext && typeof requestContext.companyId === "string"
      ? requestContext.companyId
      : companyScope.companyId;
  const jobsiteId =
    "jobsiteId" in requestContext && typeof requestContext.jobsiteId === "string"
      ? requestContext.jobsiteId
      : undefined;

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await runGusPhotoReview({
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    fileName: file.name,
    message: parseStringField(formData?.get("message") ?? null, 800),
    context: {
      ...requestContext,
      companyId: companyId ?? undefined,
      jobsiteId,
      userId: auth.user.id,
    },
    decision: parseJsonField(formData?.get("decision") ?? null) as never,
    safetyPreferences: parseJsonField(formData?.get("safetyPreferences") ?? null) as never,
  });

  if (!result.output) {
    return NextResponse.json(
      {
        error: result.error || "Gus could not review this photo.",
        meta: result.meta,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...result.output,
    validationFindings: result.validationFindings,
    meta: result.meta,
  });
}
