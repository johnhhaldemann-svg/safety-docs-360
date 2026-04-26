import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function canRunToolbox(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "field_supervisor" ||
    role === "foreman"
  );
}

async function assertSessionAccess(
  auth: {
    supabase: SupabaseClient;
    user: { id: string };
    role: string;
  },
  companyId: string,
  sessionId: string
) {
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId,
    role: auth.role,
  });

  const existing = await auth.supabase
    .from("company_toolbox_sessions")
    .select("id, jobsite_id")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { error: NextResponse.json({ error: "Session not found." }, { status: 404 }) };
  }
  const jobsiteId = (existing.data as { jobsite_id: string }).jobsite_id;
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { jobsiteId };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ attendees: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: sessionId } = await params;
  const gate = await assertSessionAccess(auth, companyScope.companyId, sessionId);
  if ("error" in gate) return gate.error;

  const res = await auth.supabase
    .from("company_toolbox_attendees")
    .select("*")
    .eq("session_id", sessionId)
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: true });

  if (res.error) {
    return NextResponse.json({ error: res.error.message || "Failed to load attendees." }, { status: 500 });
  }
  return NextResponse.json({ attendees: res.data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canRunToolbox(auth.role)) {
    return NextResponse.json({ error: "Your role cannot add attendees." }, { status: 403 });
  }

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

  const { id: sessionId } = await params;
  const gate = await assertSessionAccess(auth, companyScope.companyId, sessionId);
  if ("error" in gate) return gate.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = String(body?.userId ?? "").trim() || null;
  const guestName = String(body?.guestName ?? "").trim() || null;
  if (!userId && !guestName) {
    return NextResponse.json({ error: "userId or guestName is required." }, { status: 400 });
  }

  const ins = await auth.supabase
    .from("company_toolbox_attendees")
    .insert({
      company_id: companyScope.companyId,
      session_id: sessionId,
      user_id: userId,
      guest_name: guestName,
      signed_at: body?.signed === true ? new Date().toISOString() : null,
      signature_note: String(body?.signatureNote ?? "").trim() || null,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to add attendee." }, { status: 500 });
  }
  return NextResponse.json({ attendee: ins.data });
}
