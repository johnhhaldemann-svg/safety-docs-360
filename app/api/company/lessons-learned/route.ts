import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/company/lessons-learned
// Returns lessons-learned records for the company.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_access_field_work"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  const { data, error } = await auth.supabase
    .from("lessons_learned")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      // Table doesn't exist yet — return empty list so UI falls back gracefully
      return NextResponse.json({ lessons: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lessons: data ?? [] });
}

// POST /api/company/lessons-learned
// Creates a new lessons-learned record.
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_access_field_work"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  const body = await request.json() as Record<string, unknown>;

  const { data, error } = await auth.supabase
    .from("lessons_learned")
    .insert({
      ...body,
      company_id: companyScope.companyId,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lesson: data }, { status: 201 });
}
