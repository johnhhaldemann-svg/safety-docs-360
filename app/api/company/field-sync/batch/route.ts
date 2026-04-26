import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { shouldRejectStaleUpdate } from "@/lib/fieldSync/serverWins";

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

type ToolboxSessionUpsert = {
  opId: string;
  kind: "toolbox_session_upsert";
  sessionId: string;
  ifUnmodifiedSince?: string | null;
  patch: {
    notes?: string | null;
    status?: "draft" | "completed";
    linkedCorrectiveActionId?: string | null;
  };
};

type ToolboxSessionCreate = {
  opId: string;
  kind: "toolbox_session_create";
  jobsiteId: string;
  templateId?: string | null;
  notes?: string | null;
  linkedCorrectiveActionId?: string | null;
};

type BatchOp = ToolboxSessionUpsert | ToolboxSessionCreate;

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canRunToolbox(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const body = (await request.json().catch(() => null)) as { operations?: unknown } | null;
  const operations = Array.isArray(body?.operations) ? (body!.operations as BatchOp[]) : [];
  if (!operations.length) {
    return NextResponse.json({ error: "operations array is required." }, { status: 400 });
  }
  if (operations.length > 50) {
    return NextResponse.json({ error: "Maximum 50 operations per batch." }, { status: 400 });
  }

  const results: Array<{
    opId: string;
    ok: boolean;
    conflict?: boolean;
    error?: string;
    session?: unknown;
  }> = [];

  for (const op of operations) {
    const opId = String((op as { opId?: unknown }).opId ?? "");
    if (!opId) {
      results.push({ opId: "", ok: false, error: "Missing opId." });
      continue;
    }

    try {
      if (op.kind === "toolbox_session_create") {
        const jobsiteId = String(op.jobsiteId ?? "").trim();
        if (!jobsiteId || !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
          results.push({ opId, ok: false, error: "Invalid jobsite." });
          continue;
        }
        const ins = await auth.supabase
          .from("company_toolbox_sessions")
          .insert({
            company_id: companyScope.companyId,
            jobsite_id: jobsiteId,
            template_id: op.templateId?.trim() || null,
            conducted_by: auth.user.id,
            notes: op.notes?.trim() || null,
            status: "draft",
            linked_corrective_action_id: op.linkedCorrectiveActionId?.trim() || null,
          })
          .select("*")
          .single();
        if (ins.error || !ins.data) {
          results.push({ opId, ok: false, error: ins.error?.message || "Create failed." });
        } else {
          results.push({ opId, ok: true, session: ins.data });
        }
        continue;
      }

      if (op.kind === "toolbox_session_upsert") {
        const sessionId = String(op.sessionId ?? "").trim();
        if (!sessionId) {
          results.push({ opId, ok: false, error: "sessionId required." });
          continue;
        }
        const existing = await auth.supabase
          .from("company_toolbox_sessions")
          .select("id, jobsite_id, updated_at")
          .eq("id", sessionId)
          .eq("company_id", companyScope.companyId)
          .maybeSingle();

        if (existing.error || !existing.data) {
          results.push({ opId, ok: false, error: "Session not found." });
          continue;
        }
        const row = existing.data as { jobsite_id: string; updated_at: string };
        if (!isJobsiteAllowed(row.jobsite_id, jobsiteScope)) {
          results.push({ opId, ok: false, error: "Forbidden." });
          continue;
        }

        if (
          shouldRejectStaleUpdate({
            serverUpdatedAtIso: row.updated_at,
            ifUnmodifiedSinceIso: op.ifUnmodifiedSince,
          })
        ) {
          results.push({ opId, ok: false, conflict: true, error: "Server has newer changes." });
          continue;
        }

        const patch: Record<string, unknown> = {};
        if (typeof op.patch?.notes === "string") patch.notes = op.patch.notes.trim() || null;
        if (op.patch?.status === "completed" || op.patch?.status === "draft") patch.status = op.patch.status;
        if (typeof op.patch?.linkedCorrectiveActionId === "string") {
          patch.linked_corrective_action_id = op.patch.linkedCorrectiveActionId.trim() || null;
        }

        const res = await auth.supabase
          .from("company_toolbox_sessions")
          .update(patch)
          .eq("id", sessionId)
          .eq("company_id", companyScope.companyId)
          .select("*")
          .maybeSingle();

        if (res.error || !res.data) {
          results.push({ opId, ok: false, error: res.error?.message || "Update failed." });
          continue;
        }

        if (patch.status === "completed") {
          await auth.supabase.from("company_risk_events").insert({
            company_id: companyScope.companyId,
            module_name: "toolbox",
            record_id: sessionId,
            event_type: "toolbox_session_completed",
            detail: "Toolbox session marked completed (field sync).",
            event_payload: { sessionId },
            created_by: auth.user.id,
          });
        }

        results.push({ opId, ok: true, session: res.data });
        continue;
      }

      results.push({ opId, ok: false, error: "Unknown operation kind." });
    } catch (e) {
      results.push({ opId, ok: false, error: e instanceof Error ? e.message : "Error." });
    }
  }

  return NextResponse.json({ results });
}
