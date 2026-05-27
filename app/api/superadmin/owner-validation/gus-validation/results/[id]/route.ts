import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  type OwnerGusValidationSupabaseClient,
  updateOwnerGusValidationResult,
  validateOwnerGusResultUpdateInput,
} from "@/lib/superadmin/ownerGusValidation";
import { requireOwnerValidationSuperadmin } from "../../../route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<unknown> }
) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const resolvedParams = await params;
  const id =
    resolvedParams && typeof resolvedParams === "object" && "id" in resolvedParams
      ? String((resolvedParams as { id?: unknown }).id ?? "")
      : "";

  if (!id.trim()) {
    return NextResponse.json({ error: "Gus validation result ID is required." }, { status: 400 });
  }

  const input = validateOwnerGusResultUpdateInput(await request.json().catch(() => ({})));
  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerGusValidationSupabaseClient;
  const result = await updateOwnerGusValidationResult({
    client: admin,
    resultId: id.trim(),
    actorUserId: auth.user.id,
    status: input.status,
    notes: input.notes,
  });

  return NextResponse.json({ result });
}
