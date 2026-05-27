import { NextResponse } from "next/server";
import { requireOwnerValidationSuperadmin } from "@/app/api/superadmin/owner-validation/route";
import { buildOwnerValidationPreviewRoles } from "@/lib/superadmin/ownerValidationPreview";
import {
  loadSafety360TestCompanySummary,
  type Safety360SandboxSupabaseClient,
} from "@/lib/superadmin/ownerValidationSandbox";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as Safety360SandboxSupabaseClient;

  return NextResponse.json(
    {
      sandbox: await loadSafety360TestCompanySummary(admin),
      roles: buildOwnerValidationPreviewRoles(),
      note: "Preview As User is read-only and does not change the real signed-in session.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
