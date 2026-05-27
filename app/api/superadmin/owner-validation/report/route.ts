import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  loadOwnerProofReport,
  type OwnerProofReportSupabaseClient,
} from "@/lib/superadmin/ownerProofReport";
import { requireOwnerValidationSuperadmin } from "../route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerProofReportSupabaseClient;
  const report = await loadOwnerProofReport(admin);

  return NextResponse.json(
    { report },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
