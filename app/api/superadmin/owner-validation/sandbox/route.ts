import { NextResponse } from "next/server";
import {
  loadSafety360TestCompanySummary,
  type Safety360SandboxSupabaseClient,
  seedSafety360TestCompany,
} from "@/lib/superadmin/ownerValidationSandbox";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireOwnerValidationSuperadmin } from "../route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as Safety360SandboxSupabaseClient;
  const summary = await loadSafety360TestCompanySummary(admin);

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as Safety360SandboxSupabaseClient;
  const result = await seedSafety360TestCompany({
    supabase: admin,
    actorUserId: auth.user.id,
  });

  return NextResponse.json(result, { status: 201 });
}
