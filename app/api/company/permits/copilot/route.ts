import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canAccessCompanyMemoryAssist } from "@/lib/companyMemoryAccess";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { runPermitCopilotAssist } from "@/lib/permitCopilot";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canAccessCompanyMemoryAssist(auth.role)) {
    return NextResponse.json({ error: "You do not have access to the permit copilot." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`permit-copilot:${auth.user.id}`, {
    windowMs: 60_000,
    max: 15,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many permit copilot requests. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company context for permit copilot." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessage = typeof body.message === "string" ? body.message : "";
  const structuredContext =
    typeof body.context === "string" ? body.context : body.context === null ? null : undefined;
  const selectedJobsiteName = typeof body.selectedJobsiteName === "string" ? body.selectedJobsiteName : null;
  const currentDraft = (body.currentDraft && typeof body.currentDraft === "object" ? body.currentDraft : null) as
    | Record<string, unknown>
    | null;
  const selectedActivity = (body.selectedActivity && typeof body.selectedActivity === "object"
    ? body.selectedActivity
    : null) as Record<string, unknown> | null;

  try {
    const result = await runPermitCopilotAssist(auth.supabase, companyScope.companyId, {
      userMessage,
      currentDraft: {
        title: String(currentDraft?.title ?? ""),
        permitType: String(currentDraft?.permitType ?? ""),
        severity: String(currentDraft?.severity ?? ""),
        category: String(currentDraft?.category ?? ""),
        escalationLevel: String(currentDraft?.escalationLevel ?? ""),
        escalationReason: String(currentDraft?.escalationReason ?? ""),
        stopWorkStatus: String(currentDraft?.stopWorkStatus ?? ""),
        stopWorkReason: String(currentDraft?.stopWorkReason ?? ""),
        dueAt: String(currentDraft?.dueAt ?? ""),
        ownerUserId: String(currentDraft?.ownerUserId ?? ""),
        jsaActivityId: String(currentDraft?.jsaActivityId ?? ""),
        observationId: String(currentDraft?.observationId ?? ""),
      },
      selectedActivity: selectedActivity
        ? {
            id: String(selectedActivity.id ?? ""),
            activity_name: String(selectedActivity.activity_name ?? ""),
            trade: selectedActivity.trade == null ? null : String(selectedActivity.trade),
            area: selectedActivity.area == null ? null : String(selectedActivity.area),
            permit_type: selectedActivity.permit_type == null ? null : String(selectedActivity.permit_type),
            planned_risk_level:
              selectedActivity.planned_risk_level == null ? null : String(selectedActivity.planned_risk_level),
            permit_required:
              typeof selectedActivity.permit_required === "boolean"
                ? selectedActivity.permit_required
                : null,
            hazard_category:
              selectedActivity.hazard_category == null ? null : String(selectedActivity.hazard_category),
            hazard_description:
              selectedActivity.hazard_description == null ? null : String(selectedActivity.hazard_description),
            mitigation: selectedActivity.mitigation == null ? null : String(selectedActivity.mitigation),
            work_date: selectedActivity.work_date == null ? null : String(selectedActivity.work_date),
          }
        : null,
      selectedJobsiteName,
      structuredContext,
    });

    serverLog("info", "permit_copilot", {
      companyId: companyScope.companyId,
      userId: auth.user.id,
      fallbackUsed: result.fallbackUsed,
      retrieval: result.retrieval,
    });

    return NextResponse.json({
      suggestion: result.suggestion,
      disclaimer: result.disclaimer,
      retrieval: result.retrieval,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Permit copilot failed.";
    serverLog("error", "permit_copilot_error", {
      companyId: companyScope.companyId,
      userId: auth.user.id,
      message: msg.slice(0, 200),
    });
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
