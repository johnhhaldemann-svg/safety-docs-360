import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  runOwnerDocumentExportValidation,
  type OwnerDocumentExportValidationSupabaseClient,
} from "@/lib/superadmin/ownerDocumentExportValidation";
import { requireOwnerValidationSuperadmin } from "../route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerDocumentExportValidationSupabaseClient;
  const result = await runOwnerDocumentExportValidation({
    client: admin,
    startedBy: auth.user.id,
  });

  return NextResponse.json(result, { status: 201 });
}
