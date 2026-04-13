import { NextResponse } from "next/server";
import { normalizeBodyPart } from "@/lib/incidents/bodyPart";
import { coerceNonNegativeInt, readJobTransfer } from "@/lib/incidents/dart";
import { normalizeExposureEventType } from "@/lib/incidents/exposureEventType";
import { injuryTimePatternFromOccurredAt } from "@/lib/incidents/injuryTimePatterns";
import { normalizeIncidentSource } from "@/lib/incidents/incidentSource";
import { normalizeInjuryType } from "@/lib/incidents/injuryType";
import { readObjectiveFlag } from "@/lib/incidents/objectiveSeverity";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { buildCorrectiveActionFacetRow, upsertRiskMemoryFacetSafe } from "@/lib/riskMemory/facets";

export const runtime = "nodejs";

const ACTION_STATUSES = new Set([
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
]);
const ACTION_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const ISSUE_CATEGORIES = new Set([
  "hazard",
  "near_miss",
  "incident",
  "good_catch",
  "ppe_violation",
  "housekeeping",
  "equipment_issue",
  "fall_hazard",
  "electrical_hazard",
  "excavation_trench_concern",
  "fire_hot_work_concern",
  "corrective_action",
]);

type ActionUpdatePayload = {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  status?: string;
  assignedUserId?: string;
  dueAt?: string;
  jobsiteId?: string;
  dapId?: string;
  dapActivityId?: string;
  workflowStatus?: string;
  convertToIncident?: boolean;
  incidentType?: string;
  injuryType?: string | null;
  eventType?: string | null;
  daysAwayFromWork?: number | null;
  daysRestricted?: number | null;
  jobTransfer?: boolean;
  bodyPart?: string | null;
  source?: string | null;
  recordable?: boolean;
  lostTime?: boolean;
  fatality?: boolean;
  observationType?: "positive" | "negative" | "near_miss";
  sifPotential?: boolean;
  sifCategory?: string;
};

function normalizeStatus(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return ACTION_STATUSES.has(normalized) ? normalized : "open";
}

function normalizeSeverity(severity?: string | null) {
  const normalized = (severity ?? "").trim().toLowerCase();
  return ACTION_SEVERITIES.has(normalized) ? normalized : "medium";
}

function normalizeCategory(category?: string | null) {
  const normalized = (category ?? "").trim().toLowerCase();
  return ISSUE_CATEGORIES.has(normalized) ? normalized : "corrective_action";
}

function isMissingCorrectiveActionsTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("company_corrective_actions");
}

function canManageCorrectiveActions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "foreman"
  );
}

function isValidTransition(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return true;
  if (fromStatus === "open" && (toStatus === "assigned" || toStatus === "stop_work")) return true;
  if (fromStatus === "assigned" && (toStatus === "in_progress" || toStatus === "escalated")) return true;
  if (fromStatus === "in_progress" && (toStatus === "corrected" || toStatus === "stop_work")) return true;
  if (fromStatus === "corrected" && toStatus === "verified_closed") return true;
  if (fromStatus === "escalated" && (toStatus === "in_progress" || toStatus === "stop_work")) return true;
  if (fromStatus === "stop_work" && (toStatus === "in_progress" || toStatus === "verified_closed")) return true;
  return false;
}

function isSafetyManagerOrAbove(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

function shouldRequireImmediateAction(severity: string, category: string) {
  return severity === "high" || severity === "critical" || category === "near_miss";
}

const SIF_CATEGORIES = new Set([
  "fall_from_height",
  "struck_by",
  "caught_between",
  "electrical",
  "excavation_collapse",
  "confined_space",
  "hazardous_energy",
  "crane_rigging",
  "line_of_fire",
]);

function normalizeObservationType(input?: string | null) {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "positive" || value === "near_miss") return value;
  return "negative";
}

function normalizeSifCategory(input?: string | null) {
  const value = (input ?? "").trim().toLowerCase();
  return SIF_CATEGORIES.has(value) ? value : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and operations managers can update corrective actions." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const existingResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, status, category, severity, observation_type, sif_potential, sif_category, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existingResult.error) {
    if (isMissingCorrectiveActionsTable(existingResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: existingResult.error.message || "Failed to find corrective action." },
      { status: 500 }
    );
  }

  if (!existingResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ActionUpdatePayload | null;
  const nextJobsiteId =
    typeof body?.jobsiteId === "string"
      ? body.jobsiteId.trim() || null
      : existingResult.data.jobsite_id;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(nextJobsiteId, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only update observations for assigned jobsites." },
      { status: 403 }
    );
  }
  const title = typeof body?.title === "string" ? body.title.trim() : undefined;
  const dueAtRaw = typeof body?.dueAt === "string" ? body.dueAt.trim() : undefined;
  const nextStatus = body?.status ? normalizeStatus(body.status) : undefined;

  if (typeof body?.title === "string" && !title) {
    return NextResponse.json({ error: "Issue title cannot be empty." }, { status: 400 });
  }

  if (nextStatus === "verified_closed" && !isSafetyManagerOrAbove(auth.role)) {
    return NextResponse.json(
      { error: "Only Safety Manager or above can mark Verified Closed." },
      { status: 403 }
    );
  }
  if (nextStatus === "verified_closed") {
    return NextResponse.json(
      {
        error:
          "Use the verify close endpoint so closure note, proof, and validation review are enforced.",
      },
      { status: 400 }
    );
  }

  if (nextStatus && !isValidTransition(existingResult.data.status, nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status transition from ${existingResult.data.status} to ${nextStatus}.`,
      },
      { status: 400 }
    );
  }

  let dueAtIso: string | null | undefined;
  if (typeof dueAtRaw === "string") {
    if (!dueAtRaw) {
      dueAtIso = null;
    } else {
      const due = new Date(dueAtRaw);
      if (Number.isNaN(due.getTime())) {
        return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });
      }
      dueAtIso = due.toISOString();
    }
  }

  const nextSeverity =
    typeof body?.severity === "string"
      ? normalizeSeverity(body.severity)
      : normalizeSeverity(existingResult.data.severity);
  const nextCategory =
    typeof body?.category === "string"
      ? normalizeCategory(body.category)
      : normalizeCategory(existingResult.data.category);
  const nextObservationType =
    typeof body?.observationType === "string"
      ? normalizeObservationType(body.observationType)
      : normalizeObservationType(existingResult.data.observation_type);
  const hasSifPotential = typeof body?.sifPotential === "boolean";
  const nextSifPotential =
    nextObservationType === "negative"
      ? hasSifPotential
        ? Boolean(body?.sifPotential)
        : Boolean(existingResult.data.sif_potential)
      : null;
  const nextSifCategory =
    nextObservationType === "negative" && nextSifPotential
      ? normalizeSifCategory(
          typeof body?.sifCategory === "string" ? body.sifCategory : existingResult.data.sif_category
        )
      : null;
  if (nextObservationType === "negative" && !hasSifPotential && existingResult.data.sif_potential === null) {
    return NextResponse.json(
      { error: "SIF evaluation is required for negative observations." },
      { status: 400 }
    );
  }
  if (nextObservationType === "negative" && nextSifPotential && !nextSifCategory) {
    return NextResponse.json(
      { error: "SIF category is required when sif_potential is yes." },
      { status: 400 }
    );
  }
  const derivedWorkflowStatus =
    shouldRequireImmediateAction(nextSeverity, nextCategory) &&
    (!body?.workflowStatus || String(body.workflowStatus).trim().toLowerCase() === "open")
      ? "immediate_action_required"
      : typeof body?.workflowStatus === "string"
        ? body.workflowStatus.trim().toLowerCase()
        : undefined;

  const immediateActionRequired =
    shouldRequireImmediateAction(nextSeverity, nextCategory) ||
    (nextObservationType === "negative" && Boolean(nextSifPotential));

  const updateValues = {
    ...(typeof body?.observationType === "string"
      ? { observation_type: nextObservationType }
      : {}),
    ...(typeof body?.sifPotential === "boolean" ? { sif_potential: nextSifPotential } : {}),
    ...(typeof body?.sifCategory === "string" || nextSifCategory === null
      ? { sif_category: nextSifCategory }
      : {}),
    priority: nextSifPotential ? "high" : nextSeverity,
    immediate_action_required: immediateActionRequired,
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof body?.description === "string" ? { description: body.description.trim() || null } : {}),
    ...(typeof body?.severity === "string" ? { severity: nextSeverity } : {}),
    ...(typeof body?.category === "string" ? { category: nextCategory } : {}),
    ...(typeof body?.jobsiteId === "string" ? { jobsite_id: body.jobsiteId.trim() || null } : {}),
    ...(typeof body?.dapId === "string" ? { dap_id: body.dapId.trim() || null } : {}),
    ...(typeof body?.dapActivityId === "string"
      ? { dap_activity_id: body.dapActivityId.trim() || null }
      : {}),
    ...(typeof derivedWorkflowStatus === "string" ? { workflow_status: derivedWorkflowStatus } : {}),
    ...(typeof body?.assignedUserId === "string"
      ? { assigned_user_id: body.assignedUserId.trim() || null }
      : {}),
    ...(typeof dueAtIso !== "undefined" ? { due_at: dueAtIso } : {}),
    ...(nextStatus
      ? {
          status: nextStatus,
          started_at:
            nextStatus === "in_progress"
              ? new Date().toISOString()
              : nextStatus === "open" || nextStatus === "assigned"
                ? null
                : undefined,
          closed_at: nextStatus === "verified_closed" ? new Date().toISOString() : undefined,
        }
      : {}),
    updated_by: auth.user.id,
  };

  const updateResult = await auth.supabase
    .from("company_corrective_actions")
    .update(updateValues)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .single();

  if (updateResult.error) {
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update corrective action." },
      { status: 500 }
    );
  }

  const caFacet = buildCorrectiveActionFacetRow(
    companyScope.companyId,
    updateResult.data as Record<string, unknown>,
    body as Record<string, unknown> | null
  );
  void upsertRiskMemoryFacetSafe(auth.supabase, caFacet);

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: id,
    company_id: companyScope.companyId,
    event_type: "updated",
    detail: nextStatus ? `Status updated to ${nextStatus}.` : "Issue details updated.",
    event_payload: {
      status: nextStatus,
      category: body?.category,
      assignedUserId: body?.assignedUserId,
      dapId: body?.dapId,
      dapActivityId: body?.dapActivityId,
      workflowStatus: body?.workflowStatus,
      observationType: body?.observationType,
      sifPotential: typeof body?.sifPotential === "boolean" ? body.sifPotential : undefined,
      sifCategory: body?.sifCategory,
      immediateActionRequired,
      dueAt: dueAtIso,
    },
    created_by: auth.user.id,
  });

  if (nextObservationType === "negative" && nextSifPotential) {
    await auth.supabase.from("company_corrective_action_events").insert({
      action_id: id,
      company_id: companyScope.companyId,
      event_type: "notify_safety_manager",
      detail: "SIF-potential observation requires Safety Manager attention.",
      event_payload: {
        sifCategory: nextSifCategory,
        priority: "high",
      },
      created_by: auth.user.id,
    });
  }

  if (body?.convertToIncident) {
    const convCategory = String(body.incidentType ?? "incident")
      .trim()
      .toLowerCase();
    const convInjury = normalizeInjuryType(body.injuryType);
    const convEvent = normalizeExposureEventType(body.eventType) ?? "other";
    const convDaysAway = coerceNonNegativeInt(body?.daysAwayFromWork);
    const convDaysRestricted = coerceNonNegativeInt(body?.daysRestricted);
    const convBodyPart = normalizeBodyPart(body?.bodyPart);
    const convSource = normalizeIncidentSource(body?.source) ?? "other";
    const convOccurredAt = new Date().toISOString();
    const convTimePatterns = injuryTimePatternFromOccurredAt(convOccurredAt);
    await auth.supabase.from("company_incidents").insert({
      company_id: companyScope.companyId,
      jobsite_id: updateResult.data.jobsite_id,
      title: updateResult.data.title,
      description: updateResult.data.description,
      status: "open",
      severity: updateResult.data.severity,
      category: convCategory,
      injury_source: convSource,
      exposure_event_type: convEvent,
      days_away_from_work: convDaysAway.ok ? convDaysAway.value : 0,
      days_restricted: convDaysRestricted.ok ? convDaysRestricted.value : 0,
      job_transfer: readJobTransfer(body?.jobTransfer, false),
      recordable: readObjectiveFlag(body?.recordable, false),
      lost_time: readObjectiveFlag(body?.lostTime, false),
      fatality: readObjectiveFlag(body?.fatality, false),
      injury_type: convCategory === "incident" ? convInjury ?? "other" : null,
      body_part: convCategory === "incident" ? convBodyPart ?? "other" : null,
      occurred_at: convOccurredAt,
      ...convTimePatterns,
      observation_id: id,
      dap_activity_id:
        typeof body?.dapActivityId === "string" ? body.dapActivityId.trim() || null : null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    });
  }

  return NextResponse.json({
    success: true,
    action: updateResult.data,
    message: "Corrective action updated.",
  });
}
