import { NextResponse } from "next/server";
import {
  ensureDefaultOwnerValidationModules,
  recordOwnerValidationRun,
  type OwnerValidationSupabaseClient,
  validateOwnerValidationRunInput,
} from "@/lib/superadmin/ownerValidation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
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

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerValidationSupabaseClient;
  const { data, error } = await admin
    .from("owner_validation_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json(
      { error: "Unable to load owner validation runs." },
      { status: 500 }
    );
  }

  return NextResponse.json({ runs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerValidationSupabaseClient;
  await ensureDefaultOwnerValidationModules(admin);

  const body = await request.json().catch(() => ({}));
  const input = validateOwnerValidationRunInput(body);
  const result = await recordOwnerValidationRun({
    client: admin,
    startedBy: auth.user.id,
    input,
  });

  return NextResponse.json(result, { status: 201 });
}
