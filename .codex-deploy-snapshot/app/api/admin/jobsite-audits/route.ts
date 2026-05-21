import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

const MAX_PAYLOAD_CHARS = 1_800_000;

type SubmitBody = {
  jobsite?: string;
  auditors?: string;
  auditDate?: string | null;
  payload?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server could not open admin database client." },
      { status: 503 }
    );
  }

  const { data, error } = await admin
    .from("internal_jobsite_audits")
    .select("id, created_at, created_by_email, jobsite_name, audit_date, auditors")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json(
      { error: "Payload too large. Download JSON instead or clear old checklist data." },
      { status: 413 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server could not open admin database client. Check SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const auditDate =
    typeof body.auditDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.auditDate)
      ? body.auditDate
      : null;

  const { data, error } = await admin
    .from("internal_jobsite_audits")
    .insert({
      created_by_user_id: auth.user.id,
      created_by_email: auth.user.email ?? null,
      jobsite_name: typeof body.jobsite === "string" ? body.jobsite.slice(0, 500) : "",
      audit_date: auditDate,
      auditors: typeof body.auditors === "string" ? body.auditors.slice(0, 1000) : "",
      payload,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save audit submission." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    submission: data,
  });
}
