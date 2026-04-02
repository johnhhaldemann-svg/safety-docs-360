import { NextResponse } from "next/server";
import { coerceNonNegativeInt, readJobTransfer } from "@/lib/incidents/dart";
import { normalizeBodyPart } from "@/lib/incidents/bodyPart";
import { normalizeExposureEventType } from "@/lib/incidents/exposureEventType";
import { normalizeIncidentSource } from "@/lib/incidents/incidentSource";
import { normalizeInjuryType } from "@/lib/incidents/injuryType";
import { injuryTimePatternFromOccurredAt } from "@/lib/incidents/injuryTimePatterns";
import { readObjectiveFlag } from "@/lib/incidents/objectiveSeverity";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildManualForecasterIncidentDescription } from "@/lib/injuryWeather/manualForecasterIncident";

export const runtime = "nodejs";

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isSuperAdminRole(auth.role)) {
    return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const companyId = String(body?.companyId ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  }

  const { data: co, error: coErr } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (coErr || !co) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const jobsiteIdRaw = String(body?.jobsiteId ?? "").trim();
  const jobsiteId = jobsiteIdRaw || null;
  if (jobsiteId) {
    const { data: js, error: jsErr } = await admin
      .from("company_jobsites")
      .select("id")
      .eq("id", jobsiteId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (jsErr || !js) {
      return NextResponse.json({ error: "Jobsite not found for this company." }, { status: 400 });
    }
  }

  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const category = String(body?.category ?? "incident").trim().toLowerCase() || "incident";
  const exposureEventType = normalizeExposureEventType(body?.eventType);
  if (!exposureEventType) {
    return NextResponse.json(
      {
        error:
          "eventType is required (e.g. fall_same_level, struck_by_object). See company incidents API docs.",
      },
      { status: 400 }
    );
  }

  const injurySource = normalizeIncidentSource(body?.source);
  if (!injurySource) {
    return NextResponse.json(
      {
        error:
          "source is required (e.g. material_handling, hand_tools, other). See company incidents API docs.",
      },
      { status: 400 }
    );
  }

  const injuryType = normalizeInjuryType(body?.injuryType);
  if (category === "incident" && !injuryType) {
    return NextResponse.json({ error: "injuryType is required for injury incidents." }, { status: 400 });
  }

  const bodyPart = normalizeBodyPart(body?.bodyPart);
  if (category === "incident" && !bodyPart) {
    return NextResponse.json({ error: "bodyPart is required for injury incidents." }, { status: 400 });
  }

  const severity = String(body?.severity ?? "medium").trim().toLowerCase() || "medium";
  const sifFlag = Boolean(body?.sifFlag);
  const daysAwayParsed = coerceNonNegativeInt(body?.daysAwayFromWork);
  if (!daysAwayParsed.ok) {
    return NextResponse.json({ error: `daysAwayFromWork: ${daysAwayParsed.message}` }, { status: 400 });
  }
  const daysRestrictedParsed = coerceNonNegativeInt(body?.daysRestricted);
  if (!daysRestrictedParsed.ok) {
    return NextResponse.json({ error: `daysRestricted: ${daysRestrictedParsed.message}` }, { status: 400 });
  }

  const occurredAt = String(body?.occurredAt ?? "").trim() || null;
  /** ISO timestamp used for `created_at` so month-scoped injury-weather picks up this row in the intended period. */
  const signalCreatedAt = String(body?.signalCreatedAt ?? "").trim() || occurredAt || new Date().toISOString();

  let signalDate: Date;
  try {
    signalDate = new Date(signalCreatedAt);
    if (Number.isNaN(signalDate.getTime())) {
      return NextResponse.json({ error: "signalCreatedAt / occurredAt must be a valid date." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "signalCreatedAt / occurredAt must be a valid date." }, { status: 400 });
  }

  const createdIso = signalDate.toISOString();
  const injuryTimePatterns = injuryTimePatternFromOccurredAt(occurredAt);

  const userDescription = String(body?.description ?? "").trim();
  const description = buildManualForecasterIncidentDescription(userDescription);

  const insertRow = {
    company_id: companyId,
    jobsite_id: jobsiteId,
    title,
    description,
    status: "open",
    severity,
    category,
    injury_type: injuryType,
    body_part: category === "incident" ? bodyPart : null,
    exposure_event_type: exposureEventType,
    injury_source: injurySource,
    days_away_from_work: daysAwayParsed.value,
    days_restricted: daysRestrictedParsed.value,
    job_transfer: readJobTransfer(body?.jobTransfer, false),
    recordable: readObjectiveFlag(body?.recordable, false),
    lost_time: readObjectiveFlag(body?.lostTime, false),
    fatality: readObjectiveFlag(body?.fatality, false),
    owner_user_id: null,
    due_at: null,
    occurred_at: occurredAt,
    ...injuryTimePatterns,
    sif_flag: sifFlag,
    escalation_level: "none",
    escalation_reason: null,
    stop_work_status: "normal",
    stop_work_reason: null,
    escalated_at: null,
    stop_work_at: null,
    converted_from_submission_id: null,
    observation_id: null,
    dap_activity_id: null,
    created_by: auth.user.id,
    updated_by: auth.user.id,
    created_at: createdIso,
    updated_at: createdIso,
  };

  const result = await admin.from("company_incidents").insert(insertRow).select("id, company_id, jobsite_id, title, created_at").single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to create incident." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    incident: result.data,
    hint: "Use Injury Weather with the same company (and jobsite if set) selected, and refresh. Month filters use created_at / signal date.",
  });
}
