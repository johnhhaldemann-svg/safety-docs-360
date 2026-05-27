import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  loadOwnerChangeLogEntries,
  recordOwnerChangeLogEntry,
  validateOwnerChangeLogInput,
  type OwnerChangeLogSupabaseClient,
} from "@/lib/superadmin/ownerChangeLog";
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

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerChangeLogSupabaseClient;
  const changes = await loadOwnerChangeLogEntries(admin);

  return NextResponse.json(
    { changes },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerChangeLogSupabaseClient;
  const input = validateOwnerChangeLogInput(await request.json().catch(() => ({})));
  const change = await recordOwnerChangeLogEntry({
    client: admin,
    createdBy: auth.user.id,
    input,
  });

  return NextResponse.json({ change }, { status: 201 });
}
