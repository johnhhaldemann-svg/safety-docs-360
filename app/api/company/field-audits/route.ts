import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import {
  normalizeFieldAuditPayload,
  type FieldAuditPhotoCounts,
  type FieldAuditStatusMap,
  type FieldAuditNotesMap,
  type FieldAuditTemplateSource,
  type NormalizedFieldAuditObservation,
} from "@/lib/fieldAudits/normalize";
import { runSafetyIntakePipeline } from "@/lib/safety-intelligence/ingestion/service";
import {
  buildCorrectiveActionFacetRow,
  upsertRiskMemoryFacetSafe,
} from "@/lib/riskMemory/facets";

export const runtime = "nodejs";

const MAX_PAYLOAD_CHARS = 1_800_000;
const MAX_OBSERVATIONS = 500;

type SubmitBody = {
  jobsiteId?: string | null;
  auditDate?: string | null;
  auditors?: string | null;
  selectedTrade?: string | null;
  templateSource?: FieldAuditTemplateSource | null;
  statusMap?: FieldAuditStatusMap;
  notesMap?: FieldAuditNotesMap;
  photoCounts?: FieldAuditPhotoCounts;
  evidenceMetadataByKey?: Record<string, unknown>;
};

function validAuditDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "invalid";
}

function cleanText(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeTemplateSource(value: unknown): FieldAuditTemplateSource {
  return value === "field" || value === "hs" || value === "env" || value === "mixed"
    ? value
    : "built_in";
}

function isMissingFieldAuditsTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_audits") ||
    normalized.includes("company_jobsite_audit_observations")
  );
}

function shouldCreateCorrectiveAction(observation: NormalizedFieldAuditObservation) {
  return observation.status === "fail";
}

function buildCorrectiveActionInsert(params: {
  companyId: string;
  jobsiteId: string | null;
  actorUserId: string;
  auditId: string;
  observation: NormalizedFieldAuditObservation;
}) {
  const due = new Date();
  due.setDate(due.getDate() + (params.observation.severity === "critical" ? 1 : 7));
  return {
    company_id: params.companyId,
    jobsite_id: params.jobsiteId,
    title: `Audit finding: ${params.observation.itemLabel}`.slice(0, 240),
    description:
      [
        params.observation.categoryLabel,
        params.observation.notes,
        `Source audit ${params.auditId}`,
      ]
        .filter(Boolean)
        .join("\n\n") || null,
    status: params.observation.severity === "critical" ? "escalated" : "open",
    severity: params.observation.severity,
    category: params.observation.categoryCode ?? "field_audit",
    due_at: due.toISOString(),
    assigned_user_id: null,
    created_by: params.actorUserId,
    updated_by: params.actorUserId,
    observation_type: "negative",
    sif_potential: params.observation.severity === "critical",
    sif_category: params.observation.categoryCode,
    dap_activity_id: null,
  };
}

function buildAiObservationPayload(params: {
  observationId: string;
  auditId: string;
  auditDate: string | null;
  auditors: string;
  selectedTrade: string;
  observation: NormalizedFieldAuditObservation;
  correctiveActionId?: string | null;
}) {
  const observedAt = params.auditDate || new Date().toISOString().slice(0, 10);
  const title = `${params.observation.status.toUpperCase()}: ${params.observation.itemLabel}`;
  const summary = [
    params.observation.categoryLabel,
    `Trade: ${params.observation.tradeCode ?? params.selectedTrade}`,
    `Status: ${params.observation.status}`,
    params.correctiveActionId ? `Corrective action: ${params.correctiveActionId}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    source_type: "observation",
    source_record_id: params.observationId,
    title,
    summary,
    description:
      params.observation.notes ||
      `${params.observation.itemLabel} was marked ${params.observation.status} during field audit ${params.auditId}.`,
    severity: params.observation.severity,
    trade: params.observation.tradeCode ?? params.selectedTrade,
    category: params.observation.categoryCode ?? params.observation.templateSource,
    date: observedAt,
    observation_date: observedAt,
    audit_id: params.auditId,
    auditors: params.auditors,
    status: params.observation.status,
    photo_count: params.observation.photoCount,
    corrective_action_id: params.correctiveActionId ?? null,
    riskMemory: params.observation.riskMemory,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_submit_documents",
      "can_manage_observations",
      "can_create_documents",
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;
  if (!isCompanyRole(auth.role) && auth.role !== "sales_demo") {
    return NextResponse.json({ error: "Field audits are available to company workspace roles." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ audits: [] });

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const { searchParams } = new URL(request.url);
  const requestedJobsiteId = searchParams.get("jobsiteId")?.trim() || "";
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (requestedJobsiteId && !isJobsiteAllowed(requestedJobsiteId, jobsiteScope)) {
    return NextResponse.json({ audits: [] });
  }

  let query = auth.supabase
    .from("company_jobsite_audits")
    .select("id, company_id, jobsite_id, audit_date, auditors, selected_trade, template_source, status, score_summary, created_at, updated_at, submitted_by")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (requestedJobsiteId) query = query.eq("jobsite_id", requestedJobsiteId);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ audits: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const result = await query;
  if (result.error) {
    if (isMissingFieldAuditsTable(result.error.message)) {
      return NextResponse.json(
        { audits: [], warning: "Field audit tables are not available yet. Run latest migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: result.error.message || "Failed to load field audits." }, { status: 500 });
  }

  return NextResponse.json({ audits: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_submit_documents",
      "can_manage_observations",
      "can_create_documents",
      "can_view_dashboards",
      "can_view_all_company_data",
    ],
  });
  if ("error" in auth) return auth.error;
  if (!isCompanyRole(auth.role) && auth.role !== "sales_demo") {
    return NextResponse.json({ error: "Field audits are available to company workspace roles." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const body = (await request.json().catch(() => null)) as SubmitBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json({ error: "Audit payload is too large." }, { status: 413 });
  }

  const jobsiteId = cleanText(body.jobsiteId, 80) || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only submit audits for assigned jobsites." }, { status: 403 });
  }
  const writeSupabase = createSupabaseAdminClient() ?? auth.supabase;

  const auditDate = validAuditDate(body.auditDate);
  if (auditDate === "invalid") {
    return NextResponse.json({ error: "auditDate must use YYYY-MM-DD format." }, { status: 400 });
  }

  const selectedTrade = cleanText(body.selectedTrade, 120) || "general_contractor";
  const auditors = cleanText(body.auditors, 1000);
  const normalized = normalizeFieldAuditPayload({
    selectedTrade,
    statusMap: body.statusMap && typeof body.statusMap === "object" ? body.statusMap : {},
    notesMap: body.notesMap && typeof body.notesMap === "object" ? body.notesMap : {},
    photoCounts: body.photoCounts && typeof body.photoCounts === "object" ? body.photoCounts : {},
  });

  if (normalized.observations.length < 1) {
    return NextResponse.json({ error: "At least one audit item must be scored before submit." }, { status: 400 });
  }
  if (normalized.observations.length > MAX_OBSERVATIONS) {
    return NextResponse.json({ error: `A single audit can submit at most ${MAX_OBSERVATIONS} scored items.` }, { status: 400 });
  }

  const auditInsert = await writeSupabase
    .from("company_jobsite_audits")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      audit_date: auditDate,
      auditors,
      selected_trade: selectedTrade,
      template_source: normalizeTemplateSource(body.templateSource),
      status: "submitted",
      score_summary: normalized.scoreSummary,
      payload: {
        ...body,
        normalizedAt: new Date().toISOString(),
        observationCount: normalized.observations.length,
      },
      submitted_by: auth.user.id,
    })
    .select("*")
    .single();

  if (auditInsert.error) {
    return NextResponse.json({ error: auditInsert.error.message || "Failed to save field audit." }, { status: 500 });
  }

  const auditId = String(auditInsert.data.id);
  const observationRows = normalized.observations.map((observation) => ({
    company_id: companyScope.companyId,
    audit_id: auditId,
    jobsite_id: jobsiteId,
    source_key: observation.sourceKey,
    template_source: observation.templateSource,
    trade_code: observation.tradeCode,
    sub_trade_code: observation.subTradeCode,
    task_code: observation.taskCode,
    category_code: observation.categoryCode,
    category_label: observation.categoryLabel,
    item_label: observation.itemLabel,
    status: observation.status,
    severity: observation.severity,
    notes: observation.notes,
    photo_count: observation.photoCount,
    evidence_metadata: {
      ...observation.evidenceMetadata,
      mobileEvidence:
        body.evidenceMetadataByKey &&
        typeof body.evidenceMetadataByKey === "object" &&
        observation.sourceKey in body.evidenceMetadataByKey
          ? body.evidenceMetadataByKey[observation.sourceKey]
          : null,
    },
    created_by: auth.user.id,
  }));

  const observationInsert = await writeSupabase
    .from("company_jobsite_audit_observations")
    .insert(observationRows)
    .select("*");

  if (observationInsert.error) {
    return NextResponse.json(
      { error: observationInsert.error.message || "Failed to save audit observations.", audit: auditInsert.data },
      { status: 500 }
    );
  }

  const savedObservations = observationInsert.data ?? [];
  let correctiveActionsCreated = 0;
  let aiRecordsCreated = 0;
  const ingestionErrors: string[] = [];

  for (const saved of savedObservations) {
    const observation = normalized.observations.find((item) => item.sourceKey === saved.source_key);
    if (!observation) continue;

    let correctiveActionId: string | null = null;
    if (shouldCreateCorrectiveAction(observation)) {
      const correctiveInsert = await writeSupabase
        .from("company_corrective_actions")
        .insert(buildCorrectiveActionInsert({
          companyId: companyScope.companyId,
          jobsiteId,
          actorUserId: auth.user.id,
          auditId,
          observation,
        }))
        .select("*")
        .single();
      if (!correctiveInsert.error && correctiveInsert.data) {
        correctiveActionId = String(correctiveInsert.data.id);
        correctiveActionsCreated += 1;
        await writeSupabase
          .from("company_jobsite_audit_observations")
          .update({ corrective_action_id: correctiveActionId })
          .eq("id", saved.id)
          .eq("company_id", companyScope.companyId);
        const facet = buildCorrectiveActionFacetRow(
          companyScope.companyId,
          correctiveInsert.data as Record<string, unknown>,
          { riskMemory: observation.riskMemory }
        );
        void upsertRiskMemoryFacetSafe(writeSupabase, facet);
      } else {
        ingestionErrors.push(correctiveInsert.error?.message || "Corrective action creation failed.");
      }
    }

    try {
      const intake = await runSafetyIntakePipeline({
        supabase: writeSupabase,
        body: buildAiObservationPayload({
          observationId: String(saved.id),
          auditId,
          auditDate,
          auditors,
          selectedTrade,
          observation,
          correctiveActionId,
        }),
        companyId: companyScope.companyId,
        defaultCompanyName: companyScope.companyName,
        defaultJobsiteId: jobsiteId,
        actorUserId: auth.user.id,
      });
      if (intake.bucketId) {
        aiRecordsCreated += 1;
        await writeSupabase
          .from("company_jobsite_audit_observations")
          .update({ ai_bucket_id: intake.bucketId })
          .eq("id", saved.id)
          .eq("company_id", companyScope.companyId);
      } else if (intake.prepared.validationStatus === "rejected") {
        ingestionErrors.push(`AI intake rejected ${saved.id}.`);
      }
    } catch (error) {
      ingestionErrors.push(error instanceof Error ? error.message : "AI ingestion failed.");
    }
  }

  return NextResponse.json({
    success: true,
    audit: auditInsert.data,
    observationCount: savedObservations.length,
    correctiveActionsCreated,
    aiRecordsCreated,
    ingestionErrors,
  });
}
