import { NextResponse } from "next/server";
import type { BuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import { annotateCsepReviewDocx } from "@/lib/annotateCsepReviewDocx";
import { renderCsepCompletenessReviewNotesDocx } from "@/lib/csepCompletenessReviewDocx";
import { normalizeAppRole, authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";
export const maxDuration = 120;

function canRunCompletedCsepReview(role: string) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "internal_reviewer";
}

function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

function isDocxFileName(fileName: string) {
  return fileName.trim().toLowerCase().endsWith(".docx");
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canRunCompletedCsepReview(auth.role)) {
    return NextResponse.json(
      { error: "Completed CSEP AI review can only be run by super admins or internal reviewers." },
      { status: 403 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const rawDocument = form?.get("document");
    const rawReview = form?.get("review");
    const rawFileName = form?.get("fileName");

    if (!(rawDocument instanceof File) || typeof rawReview !== "string") {
      return NextResponse.json(
        { error: "A completed DOCX upload and serialized review are required." },
        { status: 400 }
      );
    }

    const fileName =
      (typeof rawFileName === "string" && rawFileName.trim()) || rawDocument.name?.trim() || "completed-csep.docx";

    let review: BuilderProgramAiReview;
    try {
      review = JSON.parse(rawReview) as BuilderProgramAiReview;
    } catch {
      return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
    }

    if (!isDocxFileName(fileName)) {
      return NextResponse.json(
        { error: "Inline comments are currently available for DOCX uploads only." },
        { status: 400 }
      );
    }

    const annotated = await annotateCsepReviewDocx({
      buffer: Buffer.from(await rawDocument.arrayBuffer()),
      review,
    });
    const baseName = safeFilePart(fileName.replace(/\.[^.]+$/, ""), "completed_csep");
    return new NextResponse(new Uint8Array(annotated), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}_annotated_review.docx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fileName?: string;
        disclaimer?: string;
        reviewerContext?: string;
        extractionSummary?: string;
        siteReferenceSummary?: string;
        review?: BuilderProgramAiReview;
      }
    | null;

  if (!body?.review || !body.fileName?.trim()) {
    return NextResponse.json(
      { error: "A completed review and source file name are required to download notes." },
      { status: 400 }
    );
  }

  const buffer = await renderCsepCompletenessReviewNotesDocx({
    sourceFileName: body.fileName.trim(),
    review: body.review,
    disclaimer: body.disclaimer?.trim() || "",
    reviewerContext: body.reviewerContext?.trim() || "",
    extractionSummary: body.extractionSummary?.trim() || "",
    siteReferenceSummary: body.siteReferenceSummary?.trim() || "",
  });

  const baseName = safeFilePart(body.fileName.replace(/\.[^.]+$/, ""), "completed_csep");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${baseName}_review_notes.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
