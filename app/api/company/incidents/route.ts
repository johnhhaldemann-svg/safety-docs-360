import { NextResponse } from "next/server";
import { coerceNonNegativeInt, readJobTransfer } from "@/lib/incidents/dart";
import { normalizeBodyPart } from "@/lib/incidents/bodyPart";
import { EXPOSURE_EVENT_TYPES, normalizeExposureEventType } from "@/lib/incidents/exposureEventType";
import { normalizeIncidentSource } from "@/lib/incidents/incidentSource";
import { INJURY_TYPES, normalizeInjuryType } from "@/lib/incidents/injuryType";
import { injuryTimePatternFromOccurredAt } from "@/lib/incidents/injuryTimePatterns";
import { readObjectiveFlag } from "@/lib/incidents/objectiveSeverity";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { buildIncidentFacetRow, upsertRiskMemoryFacetSafe } from "@/lib/riskMemory/facets";

export const runtime = "nodejs";

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_incidents");
}
function isMissingCompatView(message?: string | null) {
  return (message ?? "").toLowerCase().includes("compat_company_incidents");
}
function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

const INCIDENT_STATUSES = new Set(["open", "in_progress", "closed"]);
const ESCALATION_LEVELS = new Set(["none", "monitor", "urgent", "critical"]);
const STOP_WORK_STATUSES = new Set([
  "normal",
  "stop_work_requested",
  "stop_work_active",
  "cleared",
]);

function normalizeStatus(input: unknown, fallback = "open") {
  const value = String(input ?? "").trim().toLowerCase();
  return INCIDENT_STATUSES.has(value) ? value : fallback;
}
function normalizeEscalation(input: unknown, fallback = "none") {
  const value = String(input ?? "").trim().toLowerCase();
  return ESCALATION_LEVELS.has(value) ? value : fallback;
}
function normalizeStopWork(input: unknown, fallback = "normal") {
  const value = String(input ?? "").trim().toLowerCase();
  return STOP_WORK_STATUSES.has(value) ? value : fallback;
}

function applyIncidentAutomation(input: {
  severity: string;
  sifFlag: boolean;
  escalationLevel: string;
  stopWorkStatus: string;
  escalationReason: string | null;
  stopWorkReason: string | null;
}) {
  let escalationLevel = input.escalationLevel;
  let stopWorkStatus = input.stopWorkStatus;
  let escalationReason = input.escalationReason;
  let stopWorkReason = input.stopWorkReason;
  const severity = input.severity;
  const sifFlag = input.sifFlag;
  if (sifFlag || severity === "critical") {
    escalationLevel = escalationLevel === "critical" ? "critical" : "urgent";
    escalationReason = escalationReason || "Auto-escalated due to SIF/critical severity threshold.";
    if (stopWorkStatus === "normal") {
      stopWorkStatus = "stop_work_requested";
      stopWorkReason =
        stopWorkReason || "Auto stop-work request triggered by SIF/critical severity threshold.";
    }
  }
  if (sifFlag && severity === "critical") {
    escalationLevel = "critical";
    stopWorkStatus = "stop_work_active";
    stopWorkReason =
      stopWorkReason || "Auto stop-work active due to combined SIF + critical severity threshold.";
  }
  return { escalationLevel, stopWorkStatus, escalationReason, stopWorkReason };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team, authUser: auth.user });
  if (!companyScope.companyId) return NextResponse.json({ incidents: [] });
  const csepBlockGet = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockGet) return csepBlockGet;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim().toLowerCase();
  let query = auth.supabase
    .from("compat_company_incidents")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ incidents: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }
  let result = await query;
  if (result.error && isMissingCompatView(result.error.message)) {
    let fallbackQuery = auth.supabase
      .from("company_incidents")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .order("updated_at", { ascending: false });
    if (status) fallbackQuery = fallbackQuery.eq("status", status);
    if (jobsiteScope.restricted) {
      if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ incidents: [] });
      fallbackQuery = fallbackQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    }
    result = await fallbackQuery;
  }
  if (result.error) {
    if (isMissingTable(result.error.message)) return NextResponse.json({ incidents: [], warning: "Incident tables are not available yet. Run latest migrations." }, { status: 500 });
    return NextResponse.json({ error: result.error.message || "Failed to load incidents." }, { status: 500 });
  }
  return NextResponse.json({ incidents: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAnyPermission: ["can_create_documents", "can_view_all_company_data"] });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) return NextResponse.json({ error: "Only company admins and managers can create incidents." }, { status: 403 });
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team, authUser: auth.user });
  if (!companyScope.companyId) return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  const csepBlockPost = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPost) return csepBlockPost;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  const category = String(body?.category ?? "").trim().toLowerCase() || "incident";
  const exposureEventType = normalizeExposureEventType(body?.eventType);
  if (!exposureEventType) {
    return NextResponse.json(
      {
        error: `eventType is required. Valid values: ${EXPOSURE_EVENT_TYPES.join(", ")}.`,
      },
      { status: 400 }
    );
  }
  const injurySource = normalizeIncidentSource(body?.source);
  if (!injurySource) {
    return NextResponse.json(
      {
        error:
          "source is required. Use one of: ladder, scaffold, hand_tools, heavy_equipment, material_handling, electrical_system, other.",
      },
      { status: 400 }
    );
  }
  const injuryType = normalizeInjuryType(body?.injuryType);
  if (category === "incident" && !injuryType) {
    return NextResponse.json(
      {
        error: `injuryType is required for injury incidents. Valid values: ${INJURY_TYPES.join(", ")}.`,
      },
      { status: 400 }
    );
  }
  const bodyPart = normalizeBodyPart(body?.bodyPart);
  if (category === "incident" && !bodyPart) {
    return NextResponse.json(
      {
        error:
          "bodyPart is required for injury incidents. Use one of: back, hand, fingers, knee, shoulder, eye, foot, other.",
      },
      { status: 400 }
    );
  }
  const severity = String(body?.severity ?? "").trim().toLowerCase() || "medium";
  const sifFlag = Boolean(body?.sifFlag);
  const automated = applyIncidentAutomation({
    severity,
    sifFlag,
    escalationLevel: normalizeEscalation(body?.escalationLevel),
    stopWorkStatus: normalizeStopWork(body?.stopWorkStatus),
    escalationReason: String(body?.escalationReason ?? "").trim() || null,
    stopWorkReason: String(body?.stopWorkReason ?? "").trim() || null,
  });
  const escalationLevel = automated.escalationLevel;
  const stopWorkStatus = automated.stopWorkStatus;
  const stopWorkReason = automated.stopWorkReason;
  if (stopWorkStatus !== "normal" && !stopWorkReason) {
    return NextResponse.json({ error: "Stop work reason is required when stop work is requested or active." }, { status: 400 });
  }
  const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only create incidents for assigned jobsites." },
      { status: 403 }
    );
  }
  const daysAwayParsed = coerceNonNegativeInt(body?.daysAwayFromWork);
  if (!daysAwayParsed.ok) {
    return NextResponse.json({ error: `daysAwayFromWork: ${daysAwayParsed.message}` }, { status: 400 });
  }
  const daysRestrictedParsed = coerceNonNegativeInt(body?.daysRestricted);
  if (!daysRestrictedParsed.ok) {
    return NextResponse.json({ error: `daysRestricted: ${daysRestrictedParsed.message}` }, { status: 400 });
  }
  const jobTransfer = readJobTransfer(body?.jobTransfer, false);
  const recordable = readObjectiveFlag(body?.recordable, false);
  const lostTime = readObjectiveFlag(body?.lostTime, false);
  const fatality = readObjectiveFlag(body?.fatality, false);
  const occurredAt = String(body?.occurredAt ?? "").trim() || null;
  const injuryTimePatterns = injuryTimePatternFromOccurredAt(occurredAt);
  const result = await auth.supabase.from("company_incidents").insert({
    company_id: companyScope.companyId,
    jobsite_id: jobsiteId,
    title,
    description: String(body?.description ?? "").trim() || null,
    status: normalizeStatus(body?.status),
    severity,
    category,
    injury_type: injuryType,
    body_part: category === "incident" ? bodyPart : null,
    exposure_event_type: exposureEventType,
    injury_source: injurySource,
    days_away_from_work: daysAwayParsed.value,
    days_restricted: daysRestrictedParsed.value,
    job_transfer: jobTransfer,
    recordable,
    lost_time: lostTime,
    fatality,
    owner_user_id: String(body?.ownerUserId ?? "").trim() || null,
    due_at: String(body?.dueAt ?? "").trim() || null,
    occurred_at: occurredAt,
    ...injuryTimePatterns,
    sif_flag: sifFlag,
    escalation_level: escalationLevel,
    escalation_reason: automated.escalationReason,
    stop_work_status: stopWorkStatus,
    stop_work_reason: stopWorkReason,
    escalated_at: escalationLevel !== "none" ? new Date().toISOString() : null,
    stop_work_at: stopWorkStatus === "stop_work_active" ? new Date().toISOString() : null,
    converted_from_submission_id: String(body?.convertedFromSubmissionId ?? "").trim() || null,
    observation_id: String(body?.observationId ?? "").trim() || null,
    dap_activity_id: String(body?.dapActivityId ?? "").trim() || null,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  }).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to create incident." }, { status: 500 });
  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "incidents",
    record_id: result.data.id,
    event_type: "incident_created",
    detail: "Incident created.",
    event_payload: {
      status: result.data.status,
      sifFlag: result.data.sif_flag,
      escalationLevel: result.data.escalation_level,
      stopWorkStatus: result.data.stop_work_status,
      convertedFromSubmissionId: result.data.converted_from_submission_id,
    },
    created_by: auth.user.id,
  });
  const facetRow = buildIncidentFacetRow(companyScope.companyId, result.data as Record<string, unknown>, body);
  void upsertRiskMemoryFacetSafe(auth.supabase, facetRow);
  return NextResponse.json({ success: true, incident: result.data });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"] });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) return NextResponse.json({ error: "Only company admins and managers can update incidents." }, { status: 403 });
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team, authUser: auth.user });
  if (!companyScope.companyId) return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Incident id is required." }, { status: 400 });
  const existing = await auth.supabase
    .from("company_incidents")
    .select(
      "id, jobsite_id, status, severity, sif_flag, escalation_level, stop_work_status, category, injury_type, body_part, exposure_event_type, injury_source"
    )
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message || "Failed to load incident." }, { status: 500 });
  if (!existing.data) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  const targetJobsiteId =
    typeof body?.jobsiteId === "string" ? body.jobsiteId.trim() || null : existing.data.jobsite_id;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(targetJobsiteId, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only update incidents for assigned jobsites." },
      { status: 403 }
    );
  }

  const nextStatus = typeof body?.status === "string" ? normalizeStatus(body.status, existing.data.status ?? "open") : undefined;
  const severity =
    typeof body?.severity === "string"
      ? body.severity.trim().toLowerCase()
      : existing.data.severity ?? "medium";
  const sifFlag =
    typeof body?.sifFlag === "boolean" ? body.sifFlag : Boolean(existing.data.sif_flag);
  const automated = applyIncidentAutomation({
    severity,
    sifFlag,
    escalationLevel:
      typeof body?.escalationLevel === "string"
        ? normalizeEscalation(body.escalationLevel, existing.data.escalation_level ?? "none")
        : existing.data.escalation_level ?? "none",
    stopWorkStatus:
      typeof body?.stopWorkStatus === "string"
        ? normalizeStopWork(body.stopWorkStatus, existing.data.stop_work_status ?? "normal")
        : existing.data.stop_work_status ?? "normal",
    escalationReason:
      typeof body?.escalationReason === "string" ? body.escalationReason.trim() || null : null,
    stopWorkReason: typeof body?.stopWorkReason === "string" ? body.stopWorkReason.trim() || null : null,
  });
  const nextEscalation = automated.escalationLevel;
  const nextStopWork = automated.stopWorkStatus;
  const stopWorkReason = automated.stopWorkReason;
  if (nextStopWork && nextStopWork !== "normal" && !stopWorkReason && existing.data.stop_work_status === "normal") {
    return NextResponse.json({ error: "Stop work reason is required when activating stop work." }, { status: 400 });
  }
  const ex = existing.data as {
    category?: string | null;
    injury_type?: string | null;
    body_part?: string | null;
    exposure_event_type?: string | null;
    injury_source?: string | null;
  };
  const mergedCategory =
    typeof body?.category === "string"
      ? body.category.trim().toLowerCase()
      : String(ex.category ?? "").trim().toLowerCase() || "incident";
  const mergedInjuryType =
    "injuryType" in (body ?? {}) ? normalizeInjuryType(body?.injuryType) : normalizeInjuryType(ex.injury_type);
  const mergedBodyPart =
    "bodyPart" in (body ?? {}) ? normalizeBodyPart(body?.bodyPart) : normalizeBodyPart(ex.body_part);
  const mergedEventType =
    "eventType" in (body ?? {})
      ? normalizeExposureEventType(body?.eventType)
      : normalizeExposureEventType(ex.exposure_event_type);
  const mergedSource =
    "source" in (body ?? {}) ? normalizeIncidentSource(body?.source) : normalizeIncidentSource(ex.injury_source);
  if (mergedCategory === "incident") {
    if (!mergedInjuryType || !mergedBodyPart || !mergedEventType || !mergedSource) {
      return NextResponse.json(
        {
          error:
            "Injury incidents require structured fields: injuryType, bodyPart, eventType, and source (equipment/object).",
        },
        { status: 400 }
      );
    }
  }
  const dartPatch: {
    days_away_from_work?: number;
    days_restricted?: number;
    job_transfer?: boolean;
  } = {};
  if ("daysAwayFromWork" in (body ?? {})) {
    const r = coerceNonNegativeInt(body?.daysAwayFromWork);
    if (!r.ok) return NextResponse.json({ error: `daysAwayFromWork: ${r.message}` }, { status: 400 });
    dartPatch.days_away_from_work = r.value;
  }
  if ("daysRestricted" in (body ?? {})) {
    const r = coerceNonNegativeInt(body?.daysRestricted);
    if (!r.ok) return NextResponse.json({ error: `daysRestricted: ${r.message}` }, { status: 400 });
    dartPatch.days_restricted = r.value;
  }
  if ("jobTransfer" in (body ?? {})) {
    if (typeof body?.jobTransfer !== "boolean") {
      return NextResponse.json({ error: "jobTransfer must be a boolean." }, { status: 400 });
    }
    dartPatch.job_transfer = body.jobTransfer;
  }
  const objectivePatch: {
    recordable?: boolean;
    lost_time?: boolean;
    fatality?: boolean;
  } = {};
  if ("recordable" in (body ?? {})) {
    if (typeof body?.recordable !== "boolean") {
      return NextResponse.json({ error: "recordable must be a boolean." }, { status: 400 });
    }
    objectivePatch.recordable = body.recordable;
  }
  if ("lostTime" in (body ?? {})) {
    if (typeof body?.lostTime !== "boolean") {
      return NextResponse.json({ error: "lostTime must be a boolean." }, { status: 400 });
    }
    objectivePatch.lost_time = body.lostTime;
  }
  if ("fatality" in (body ?? {})) {
    if (typeof body?.fatality !== "boolean") {
      return NextResponse.json({ error: "fatality must be a boolean." }, { status: 400 });
    }
    objectivePatch.fatality = body.fatality;
  }
  const result = await auth.supabase.from("company_incidents").update({
    ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof body?.description === "string" ? { description: body.description.trim() || null } : {}),
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(typeof body?.severity === "string" ? { severity } : {}),
    ...(typeof body?.category === "string" ? { category: body.category.trim().toLowerCase() } : {}),
    ...("injuryType" in (body ?? {})
      ? { injury_type: normalizeInjuryType((body as { injuryType?: unknown }).injuryType) }
      : {}),
    ...("bodyPart" in (body ?? {})
      ? { body_part: normalizeBodyPart((body as { bodyPart?: unknown }).bodyPart) }
      : {}),
    ...("eventType" in (body ?? {})
      ? {
          exposure_event_type: normalizeExposureEventType(
            (body as { eventType?: unknown }).eventType
          ),
        }
      : {}),
    ...("source" in (body ?? {})
      ? { injury_source: normalizeIncidentSource((body as { source?: unknown }).source) }
      : {}),
    ...objectivePatch,
    ...dartPatch,
    ...(typeof body?.ownerUserId === "string" ? { owner_user_id: body.ownerUserId.trim() || null } : {}),
    ...(typeof body?.jobsiteId === "string" ? { jobsite_id: body.jobsiteId.trim() || null } : {}),
    ...(typeof body?.dueAt === "string" ? { due_at: body.dueAt.trim() || null } : {}),
    ...(typeof body?.occurredAt === "string"
      ? (() => {
          const o = body.occurredAt.trim() || null;
          return { occurred_at: o, ...injuryTimePatternFromOccurredAt(o) };
        })()
      : {}),
    ...(typeof body?.sifFlag === "boolean" ? { sif_flag: sifFlag } : {}),
    ...(nextEscalation ? { escalation_level: nextEscalation } : {}),
    ...(typeof automated.escalationReason !== "undefined"
      ? { escalation_reason: automated.escalationReason }
      : {}),
    ...(nextStopWork ? { stop_work_status: nextStopWork } : {}),
    ...(typeof stopWorkReason !== "undefined" ? { stop_work_reason: stopWorkReason } : {}),
    ...(nextEscalation && nextEscalation !== "none" && existing.data.escalation_level === "none"
      ? { escalated_at: new Date().toISOString() }
      : {}),
    ...(nextStopWork === "stop_work_active" && existing.data.stop_work_status !== "stop_work_active"
      ? { stop_work_at: new Date().toISOString() }
      : {}),
    ...(typeof body?.convertedFromSubmissionId === "string"
      ? { converted_from_submission_id: body.convertedFromSubmissionId.trim() || null }
      : {}),
    ...(typeof body?.observationId === "string"
      ? { observation_id: body.observationId.trim() || null }
      : {}),
    ...(typeof body?.dapActivityId === "string"
      ? { dap_activity_id: body.dapActivityId.trim() || null }
      : {}),
    updated_by: auth.user.id,
  }).eq("id", id).eq("company_id", companyScope.companyId).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to update incident." }, { status: 500 });
  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "incidents",
    record_id: result.data.id,
    event_type: "incident_updated",
    detail: "Incident risk controls updated.",
    event_payload: {
      previousStatus: existing.data.status,
      status: result.data.status,
      escalationLevel: result.data.escalation_level,
      stopWorkStatus: result.data.stop_work_status,
      sifFlag: result.data.sif_flag,
      convertedFromSubmissionId: result.data.converted_from_submission_id,
    },
    created_by: auth.user.id,
  });
  const facetPatch = buildIncidentFacetRow(companyScope.companyId, result.data as Record<string, unknown>, body);
  void upsertRiskMemoryFacetSafe(auth.supabase, facetPatch);
  return NextResponse.json({ success: true, incident: result.data });
}
