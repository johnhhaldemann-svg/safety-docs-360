import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { buildMarketplaceNotes } from "@/lib/marketplace";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildDocumentReviewApprovalMemory, recordApprovalDecisions } from "@/lib/aiApprovalMemory";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRequest(request, {
      requirePermission: "can_approve_documents",
    });

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const reviewerEmailValue = formData.get("reviewerEmail");
    const reviewNotesValue = formData.get("reviewNotes");
    const marketplaceEnabledValue = formData.get("marketplaceEnabled");
    const creditCostValue = formData.get("creditCost");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A final DOCX file is required." },
        { status: 400 }
      );
    }

    const reviewerEmail =
      typeof reviewerEmailValue === "string" && reviewerEmailValue.trim()
        ? reviewerEmailValue.trim()
        : null;
    const reviewNotes =
      typeof reviewNotesValue === "string" && reviewNotesValue.trim()
        ? reviewNotesValue.trim()
        : null;
    const marketplaceEnabled =
      typeof marketplaceEnabledValue === "string"
        ? marketplaceEnabledValue === "true"
        : true;
    const creditCost =
      typeof creditCostValue === "string" && creditCostValue.trim()
        ? Number(creditCostValue)
        : 5;

    const { data: currentDocument } = await auth.supabase
      .from("documents")
      .select("notes, title, document_type, category, company_id")
      .eq("id", id)
      .single();
    const filePath = `final/${id}/${file.name}`;
    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await auth.supabase.storage
      .from("documents")
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType:
          file.type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const approvedAt = new Date().toISOString();

    const { error: updateError } = await auth.supabase
      .from("documents")
      .update({
        status: "approved",
        final_file_path: filePath,
        reviewer_email: reviewerEmail,
        review_notes: reviewNotes,
        approved_at: approvedAt,
        approved_by: auth.user.id,
        approved_by_email: auth.user.email ?? reviewerEmail,
        marketplace_updated_at: approvedAt,
        marketplace_updated_by: auth.user.id,
        marketplace_updated_by_email: auth.user.email ?? reviewerEmail,
        notes: buildMarketplaceNotes(currentDocument?.notes, {
          enabled: marketplaceEnabled,
          creditCost: Number.isFinite(creditCost) ? creditCost : 5,
        }),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Capture the approval into the AI Approval Memory Bank (service-role, best-effort).
    const memoryClient = createSupabaseAdminClient();
    if (memoryClient) {
      const doc = (currentDocument ?? {}) as Record<string, unknown>;
      await recordApprovalDecisions(memoryClient, [
        buildDocumentReviewApprovalMemory(
          {
            id,
            company_id: typeof doc.company_id === "string" ? doc.company_id : null,
            title: typeof doc.title === "string" ? doc.title : null,
            document_type: typeof doc.document_type === "string" ? doc.document_type : null,
            category: typeof doc.category === "string" ? doc.category : null,
          },
          {
            decision: "approved",
            reason: reviewNotes,
            reviewedBy: auth.user.id,
            reviewedAt: approvedAt,
          }
        ),
      ]);
    }

    return NextResponse.json({
      success: true,
      final_file_path: filePath,
      approvedAt,
    });
  } catch (error) {
    console.error("Document approval route error:", error);

    return NextResponse.json(
      { error: "Unexpected approval route error." },
      { status: 500 }
    );
  }
}
