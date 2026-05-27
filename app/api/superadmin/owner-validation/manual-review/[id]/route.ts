import { NextResponse } from "next/server";
import {
  type OwnerValidationSupabaseClient,
  updateOwnerManualReviewItem,
  validateOwnerManualReviewUpdateInput,
} from "@/lib/superadmin/ownerValidation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
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

  return NextResponse.json(result);
}
