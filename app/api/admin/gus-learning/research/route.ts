import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canRequestGusResearch, fetchApprovedSourceResearch } from "@/lib/gusLearning";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 120;

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canRequestGusResearch(auth.role)) {
    return NextResponse.json({ error: "You do not have access to request Gus research." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (!companyId) return NextResponse.json({ error: "No company workspace is linked to this request." }, { status: 400 });
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : typeof body.source_url === "string" ? body.source_url.trim() : "";
  if (!topic || !question || !sourceUrl) {
    return NextResponse.json({ error: "topic, question, and sourceUrl are required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const result = await fetchApprovedSourceResearch(admin, {
    requestedBy: auth.user.id,
    companyId,
    projectId: typeof body.projectId === "string" ? body.projectId : typeof body.project_id === "string" ? body.project_id : null,
    topic,
    question,
    sourceUrl,
    affectedModules: stringArray(body.affectedModules ?? body.affected_modules),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ finding: result.finding }, { status: 201 });
}
