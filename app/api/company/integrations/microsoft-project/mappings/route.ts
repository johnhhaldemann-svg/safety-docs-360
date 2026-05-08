import { NextResponse } from "next/server";
import {
  authorizeMicrosoftProjectRequest,
  isDemoMicrosoftProjectRequest,
  runtime,
} from "../_shared";

export { runtime };

export async function POST(request: Request) {
  const scoped = await authorizeMicrosoftProjectRequest(request, { requireManage: true });
  if ("error" in scoped) return scoped.error;
  if (isDemoMicrosoftProjectRequest(scoped.auth)) {
    return NextResponse.json({ success: true });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId.trim() : "";
  const jobsiteId = typeof body?.jobsiteId === "string" ? body.jobsiteId.trim() || null : null;
  if (!sourceId) return NextResponse.json({ error: "sourceId is required." }, { status: 400 });

  if (jobsiteId) {
    const jobsite = await scoped.auth.supabase
      .from("company_jobsites")
      .select("id")
      .eq("company_id", scoped.companyScope.companyId)
      .eq("id", jobsiteId)
      .maybeSingle();
    if (jobsite.error) {
      return NextResponse.json({ error: jobsite.error.message || "Failed to validate jobsite." }, { status: 500 });
    }
    if (!jobsite.data) return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });
  }

  const updated = await scoped.auth.supabase
    .from("company_microsoft_project_sources")
    .update({ jobsite_id: jobsiteId, updated_by: scoped.auth.user.id })
    .eq("company_id", scoped.companyScope.companyId)
    .eq("id", sourceId)
    .select("id, jobsite_id")
    .single();

  if (updated.error || !updated.data) {
    return NextResponse.json({ error: updated.error?.message || "Failed to update mapping." }, { status: 500 });
  }

  return NextResponse.json({ success: true, source: updated.data });
}
