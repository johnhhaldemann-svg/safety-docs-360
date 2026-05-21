import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

/**
 * MVP inbound roster sync: accepts a batch of employee descriptors, records import metadata,
 * and returns counts. Full HRIS mapping (users, jobsite assignments) can extend this endpoint.
 */
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const employees = Array.isArray(body?.employees) ? body!.employees : [];
  const source = String(body?.source ?? "hris_api").trim() || "hris_api";

  if (employees.length > 5000) {
    return NextResponse.json({ error: "Maximum 5000 employees per batch." }, { status: 400 });
  }

  for (const row of employees) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "Each employee must be an object." }, { status: 400 });
    }
    const email = String((row as { email?: unknown }).email ?? "").trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Each employee requires a valid email." }, { status: 400 });
    }
  }

  const log = await auth.supabase
    .from("company_hris_roster_imports")
    .insert({
      company_id: companyScope.companyId,
      source,
      row_count: employees.length,
      notes: "MVP: metadata only; roster rows are not persisted as user records in this build.",
      created_by: auth.user.id,
    })
    .select("id, created_at, row_count")
    .single();

  if (log.error || !log.data) {
    return NextResponse.json({ error: log.error?.message || "Failed to record import." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "integrations",
    record_id: log.data.id,
    event_type: "hris_roster_import",
    detail: `HRIS roster batch accepted (${employees.length} rows).`,
    event_payload: { importId: log.data.id, source, rowCount: employees.length },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    import: log.data,
    acceptedRows: employees.length,
    note:
      "Roster payloads are validated but not written to auth.users in this MVP; extend with idempotent upserts when HRIS mapping is finalized.",
  });
}
