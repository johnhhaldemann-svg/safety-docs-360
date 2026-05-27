import { NextResponse } from "next/server";
import {
  type OwnerValidationSupabaseClient,
  updateOwnerCustomerReadyGate,
  validateOwnerCustomerReadyGateInput,
} from "@/lib/superadmin/ownerValidation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireOwnerValidationSuperadmin } from "../../route";

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
  const moduleKey =
    resolvedParams && typeof resolvedParams === "object" && "moduleKey" in resolvedParams
      ? String((resolvedParams as { moduleKey?: unknown }).moduleKey ?? "")
      : "";
  if (!moduleKey?.trim()) {
    return NextResponse.json({ error: "Module key is required." }, { status: 400 });
  }

  const input = validateOwnerCustomerReadyGateInput(await request.json().catch(() => ({})));
  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerValidationSupabaseClient;
  const result = await updateOwnerCustomerReadyGate({
    client: admin,
    moduleKey: moduleKey.trim(),
    actorUserId: auth.user.id,
    customerReadyStatus: input.customerReadyStatus,
  });

  return NextResponse.json(result);
}
