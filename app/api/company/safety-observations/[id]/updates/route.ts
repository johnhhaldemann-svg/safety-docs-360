import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canManageObservations } from "@/lib/companyPermissions";
import { UPDATE_TYPES } from "@/lib/safety-observations/constants";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageObservations(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to add updates." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const update_type = String(body?.update_type ?? body?.updateType ?? "").trim();
  const message = String(body?.message ?? "").trim();

  if (!UPDATE_TYPES.includes(update_type as (typeof UPDATE_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid update_type." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

  const obs = await auth.supabase
    .from("safety_observations")
    .select("id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (obs.error || !obs.data) {
    return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  }

  const ins = await auth.supabase
    .from("safety_observation_updates")
    .insert({
      observation_id: id,
      update_type,
      message,
      created_by: auth.user.id,
    })
    .select("id,observation_id,update_type,message,created_by,created_at")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Insert failed." }, { status: 500 });
  }

  return NextResponse.json({ update: ins.data }, { status: 201 });
}
