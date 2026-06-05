import { NextResponse } from "next/server";
import {
  type OwnerValidationSupabaseClient,
  updateOwnerManualReviewItem,
  validateOwnerManualReviewUpdateInput,
} from "@/lib/superadmin/ownerValidation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildOwnerValidationApprovalMemory, recordApprovalDecisions } from "@/lib/aiApprovalMemory";
import { requireOwnerValidationSuperadmin } from "../../route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Manual review item ID is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const input = validateOwnerManualReviewUpdateInput(body);
  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerValidationSupabaseClient;
  const result = await updateOwnerManualReviewItem({
    client: admin,
    itemId: id,
    actorUserId: auth.user.id,
    status: input.status,
    notes: input.notes,
  });

  // Capture terminal readiness decisions into the AI Approval Memory Bank (best-effort).
  const decision = input.status === "passed" ? "approved" : input.status === "failed" ? "rejected" : null;
  const memoryClient = createSupabaseAdminClient();
  if (decision && memoryClient && result?.item) {
    await recordApprovalDecisions(memoryClient, [
      buildOwnerValidationApprovalMemory(result.item, {
        decision,
        reason: input.notes,
        reviewedBy: auth.user.id,
        reviewedAt: result.item.completed_at ?? null,
      }),
    ]);
  }

  return NextResponse.json(result);
}
