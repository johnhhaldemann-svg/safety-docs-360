import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { dbRenderToPayload } from "../../../route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string; jobId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return auth.error;

  const { jobsiteId, jobId } = await params;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }

  const jobResult = await admin
    .from("ai_visual_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .maybeSingle();

  if (jobResult.error) {
    return NextResponse.json({ error: jobResult.error.message || "Failed to load visual generation job." }, { status: 500 });
  }
  if (!jobResult.data) return NextResponse.json({ error: "Visual generation job not found." }, { status: 404 });

  let render = null;
  if (jobResult.data.render_id) {
    const renderResult = await auth.supabase
      .from("company_jobsite_site_renders")
      .select(
        "id, company_id, jobsite_id, site_map_id, blueprint_id, render_status, prompt_hash, image_path, thumbnail_path, image_width, image_height, overlay_json, ai_meta, error_message, created_at, updated_at, created_by, updated_by, archived_at"
      )
      .eq("company_id", companyScope.companyId)
      .eq("jobsite_id", jobsiteId)
      .eq("id", jobResult.data.render_id)
      .maybeSingle();
    render = renderResult.data ? await dbRenderToPayload(renderResult.data as Record<string, unknown>) : null;
  }

  return NextResponse.json({
    job: {
      id: jobResult.data.id,
      status: jobResult.data.status,
      progress: jobResult.data.progress,
      stage: jobResult.data.stage,
      errorType: jobResult.data.error_type,
      errorMessage: jobResult.data.error_message,
      renderId: jobResult.data.render_id,
      createdAt: jobResult.data.created_at,
      updatedAt: jobResult.data.updated_at,
      startedAt: jobResult.data.started_at,
      completedAt: jobResult.data.completed_at,
      aiMeta: jobResult.data.ai_meta,
    },
    render,
  });
}
