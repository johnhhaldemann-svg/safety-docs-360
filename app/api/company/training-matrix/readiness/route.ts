import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canViewCompanyTrainingMatrix } from "@/lib/companyTrainingAccess";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  loadCompanyWorkspaceUsers,
  loadCompanyWorkspaceUsersRls,
} from "@/lib/companyWorkspaceDirectory";
import { fetchCompanyTrainingRequirements } from "@/lib/companyTrainingRequirementsDb";
import {
  buildProfileCertificationInventory,
  parseCertificationExpirations,
} from "@/lib/certificationExpirations";
import {
  activatesScopedRequirement,
  computeTrainingMatrixRow,
  DEFAULT_MATCH_FIELDS,
  matchesSelectedMatrixFilter,
  type TrainingRequirementInput,
} from "@/lib/trainingMatrix";
import {
  applyOperationalSignalsToReadinessRows,
  buildContractorReadinessRow,
  buildEmployeeReadinessRow,
  summarizeReadinessRows,
  type ContractorReadinessInput,
  type ContractorReadinessRecord,
  type ReadinessOperationalSignal,
  type ReadinessOperationalSignalInput,
  type ReadinessRequirement,
} from "@/lib/readinessMatrix";
import { contractorTrainingStatus } from "@/lib/contractorTraining";
import {
  evaluateInductionAccess,
  type InductionCompletionRow,
  type InductionProgramRow,
  type InductionRequirementRow,
} from "@/lib/inductions/evaluateAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

type ProfileRow = {
  user_id: string;
  certifications: string[] | null;
  certification_expirations?: Record<string, string> | null;
  job_title: string | null;
  trade_specialty: string | null;
  readiness_status: string | null;
  years_experience?: number | null;
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function humanizeTaskCode(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function isMissingRelationError(message: string | null | undefined) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("schema cache") || lower.includes("does not exist") || lower.includes("could not find");
}

type ReadinessQueryBuilder = {
  eq: (column: string, value: string) => ReadinessQueryBuilder;
  in?: (column: string, values: string[]) => ReadinessQueryBuilder;
  gte: (column: string, value: string) => ReadinessQueryBuilder;
} & PromiseLike<{ data: unknown[] | null; error: { message?: string | null } | null }>;
type ReadinessQueryClient = {
  from: (table: string) => {
    select: (columns: string) => ReadinessQueryBuilder;
  };
};

function applyJobsiteFilter<TQuery>(
  query: TQuery,
  jobsiteIds: string[]
): TQuery {
  const filterable = query as ReadinessQueryBuilder;
  if (jobsiteIds.length === 1) return filterable.eq("jobsite_id", jobsiteIds[0]) as TQuery;
  if (jobsiteIds.length > 1 && typeof filterable.in === "function") return filterable.in("jobsite_id", jobsiteIds) as TQuery;
  return query;
}

function buildSalesDemoReadinessResponse() {
  const rows = [
    buildEmployeeReadinessRow({
      requirements: [
        { id: "demo-fall", title: "Fall Protection", matchKeywords: ["Fall Protection"] },
        { id: "demo-jsa", title: "JSA", matchKeywords: ["JSA"] },
      ],
      row: {
        userId: "demo-maria",
        name: "Maria L.",
        email: "maria.demo@safety360docs.local",
        role: "Safety Manager",
        cells: { "demo-fall": "match", "demo-jsa": "match" },
        cellDetails: {
          "demo-fall": { state: "match", matchSource: "certifications", matchedLabel: "Fall Protection", expiryStatus: "ok" },
          "demo-jsa": { state: "match", matchSource: "certifications", matchedLabel: "JSA", expiryStatus: "ok" },
        },
        certificationInventory: [],
        profileFields: { tradeSpecialty: "Steel", jobTitle: "Safety Manager" },
      },
    }),
    buildContractorReadinessRow({
      assignmentId: "demo-derrick-assignment",
      employeeId: "demo-derrick",
      name: "Derrick P.",
      email: "derrick.demo@safety360docs.local",
      contractorId: "demo-roof",
      contractorName: "Roofing Partner",
      jobsiteId: "demo-site",
      jobsiteName: "North Tower",
      trade: "Roofing",
      position: "Foreman",
      requirements: [{ id: "demo-roof-fall", title: "Fall Protection" }],
      records: [{ requirementId: "demo-roof-fall", title: "Fall Protection", status: "missing" }],
    }),
  ];
  return NextResponse.json({
    rows,
    summary: summarizeReadinessRows(rows),
    filters: {
      trades: ["Roofing", "Steel"],
      jobsites: [{ id: "demo-site", name: "North Tower" }],
      taskCodes: [],
      subTrades: [],
    },
    selectedFilters: {},
    metadata: { source: "sales_demo", generatedAt: new Date().toISOString() },
  });
}

function signal(jobsiteId: string | null, params: Omit<ReadinessOperationalSignal, "jobsiteId">) {
  return { ...params, jobsiteId };
}

async function loadOperationalSignals(params: {
  db: ReadinessQueryClient;
  companyId: string;
  jobsiteIds: string[];
  sinceIso: string;
}): Promise<{ signals: ReadinessOperationalSignalInput[]; warnings: string[] }> {
  const { db, companyId, jobsiteIds, sinceIso } = params;
  if (jobsiteIds.length === 0) return { signals: [], warnings: [] };
  const byJobsite = new Map<string, ReadinessOperationalSignal[]>();
  const warnings: string[] = [];
  const addSignal = (jobsiteId: string | null | undefined, next: Omit<ReadinessOperationalSignal, "jobsiteId">) => {
    if (!jobsiteId) return;
    const list = byJobsite.get(jobsiteId) ?? [];
    list.push(signal(jobsiteId, next));
    byJobsite.set(jobsiteId, list);
  };
  const scope = <TQuery,>(query: TQuery) => applyJobsiteFilter(query, jobsiteIds);

  const [actionsRes, incidentsRes, permitsRes, jsaActivitiesRes, sorRes] = await Promise.all([
    scope(
      db
        .from("company_corrective_actions")
        .select("id, title, status, severity, priority, due_at, jobsite_id, sif_potential")
        .eq("company_id", companyId)
        .gte("created_at", sinceIso)
    ),
    scope(
      db
        .from("company_incidents")
        .select("id, title, category, status, severity, sif_flag, escalation_level, created_at, jobsite_id, recordable")
        .eq("company_id", companyId)
        .gte("created_at", sinceIso)
    ),
    scope(
      db
        .from("company_permits")
        .select("id, status, stop_work_status, sif_flag, escalation_level, created_at, jobsite_id")
        .eq("company_id", companyId)
        .gte("created_at", sinceIso)
    ),
    scope(
      db
        .from("company_jsa_activities")
        .select("id, status, hazard_category, created_at, work_date, jobsite_id")
        .eq("company_id", companyId)
        .gte("created_at", sinceIso)
    ),
    db
      .from("company_sor_records")
      .select("id, date, status, severity, hazard_category_code, created_at")
      .eq("company_id", companyId)
      .gte("date", sinceIso.slice(0, 10)),
  ]);

  const optionalResults = [
    { name: "corrective actions", result: actionsRes },
    { name: "incidents", result: incidentsRes },
    { name: "permits", result: permitsRes },
    { name: "JSA activities", result: jsaActivitiesRes },
    { name: "SOR records", result: sorRes },
  ];
  for (const item of optionalResults) {
    if (item.result.error && !isMissingRelationError(item.result.error.message)) {
      warnings.push(`Operational ${item.name} could not be loaded: ${item.result.error.message}`);
    }
  }

  if (!actionsRes.error) {
    const actionsByJobsite = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (actionsRes.data ?? []) as Array<Record<string, unknown>>) {
      if (String(row.status ?? "").toLowerCase() === "closed") continue;
      const jobsiteId = typeof row.jobsite_id === "string" ? row.jobsite_id : null;
      if (!jobsiteId) continue;
      const list = actionsByJobsite.get(jobsiteId) ?? [];
      list.push(row);
      actionsByJobsite.set(jobsiteId, list);
    }
    for (const [jobsiteId, list] of actionsByJobsite) {
      const high = list.filter((row) =>
        ["high", "critical", "urgent"].includes(String(row.severity ?? row.priority ?? "").toLowerCase()) ||
        row.sif_potential === true
      );
      if (high.length > 0) {
        addSignal(jobsiteId, {
          type: "corrective_action",
          label: "Open High-Risk Actions",
          detail: `${high.length} open high-risk corrective action${high.length === 1 ? "" : "s"} on this jobsite.`,
          severity: "high",
          count: high.length,
        });
      } else if (list.length > 0) {
        addSignal(jobsiteId, {
          type: "corrective_action",
          label: "Open Corrective Actions",
          detail: `${list.length} open corrective action${list.length === 1 ? "" : "s"} on this jobsite.`,
          severity: "medium",
          count: list.length,
        });
      }
    }
  }

  if (!incidentsRes.error) {
    const incidentsByJobsite = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (incidentsRes.data ?? []) as Array<Record<string, unknown>>) {
      const jobsiteId = typeof row.jobsite_id === "string" ? row.jobsite_id : null;
      if (!jobsiteId) continue;
      const serious =
        row.sif_flag === true ||
        row.recordable === true ||
        ["high", "critical", "serious"].includes(String(row.severity ?? row.escalation_level ?? "").toLowerCase());
      if (!serious) continue;
      const list = incidentsByJobsite.get(jobsiteId) ?? [];
      list.push(row);
      incidentsByJobsite.set(jobsiteId, list);
    }
    for (const [jobsiteId, list] of incidentsByJobsite) {
      addSignal(jobsiteId, {
        type: "incident",
        label: "Recent Serious Incidents",
        detail: `${list.length} recent serious incident signal${list.length === 1 ? "" : "s"} on this jobsite.`,
        severity: "high",
        count: list.length,
      });
    }
  }

  if (!permitsRes.error) {
    const permitsByJobsite = new Map<string, number>();
    for (const row of (permitsRes.data ?? []) as Array<Record<string, unknown>>) {
      const jobsiteId = typeof row.jobsite_id === "string" ? row.jobsite_id : null;
      if (!jobsiteId) continue;
      const stopWork = String(row.stop_work_status ?? "").toLowerCase();
      const status = String(row.status ?? "").toLowerCase();
      if (row.sif_flag === true || ["active", "issued", "open"].includes(stopWork) || status.includes("stop")) {
        permitsByJobsite.set(jobsiteId, (permitsByJobsite.get(jobsiteId) ?? 0) + 1);
      }
    }
    for (const [jobsiteId, count] of permitsByJobsite) {
      addSignal(jobsiteId, {
        type: "permit",
        label: "Permit / Stop-Work Signal",
        detail: `${count} permit or stop-work signal${count === 1 ? "" : "s"} require supervisor review.`,
        severity: "high",
        count,
      });
    }
  }

  if (!jsaActivitiesRes.error) {
    const activityByJobsite = new Map<string, number>();
    for (const row of (jsaActivitiesRes.data ?? []) as Array<Record<string, unknown>>) {
      const jobsiteId = typeof row.jobsite_id === "string" ? row.jobsite_id : null;
      if (!jobsiteId) continue;
      const hazard = String(row.hazard_category ?? "").toLowerCase();
      if (/(fall|lift|crane|excavat|trench|energ|confined|hot work|hoist|struck|caught)/.test(hazard)) {
        activityByJobsite.set(jobsiteId, (activityByJobsite.get(jobsiteId) ?? 0) + 1);
      }
    }
    for (const [jobsiteId, count] of activityByJobsite) {
      addSignal(jobsiteId, {
        type: "jsa_activity",
        label: "High-Hazard JSA Activity",
        detail: `${count} high-hazard JSA activit${count === 1 ? "y" : "ies"} in the recent work window.`,
        severity: "medium",
        count,
      });
    }
  }

  if (!sorRes.error) {
    const sorCount = ((sorRes.data ?? []) as Array<Record<string, unknown>>).filter((row) =>
      ["high", "critical", "serious"].includes(String(row.severity ?? "").toLowerCase())
    ).length;
    if (sorCount > 0) {
      for (const jobsiteId of jobsiteIds) {
        addSignal(jobsiteId, {
          type: "sor",
          label: "High-Severity SORs",
          detail: `${sorCount} high-severity SOR record${sorCount === 1 ? "" : "s"} exist in the company window. Confirm site exposure before work.`,
          severity: "medium",
          count: sorCount,
        });
      }
    }
  }

  return {
    signals: [...byJobsite.entries()].map(([jobsiteId, signals]) => ({ jobsiteId, signals })),
    warnings,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canViewCompanyTrainingMatrix(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "You do not have access to readiness matrix." }, { status: 403 });
  }

  if (auth.role === "sales_demo") {
    return buildSalesDemoReadinessResponse();
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json({ error: "This company account is not linked to a company workspace yet." }, { status: 400 });
  }

  if (!companyScope.companyId) {
    return NextResponse.json({
      rows: [],
      summary: summarizeReadinessRows([]),
      filters: { trades: [], jobsites: [], subTrades: [], taskCodes: [] },
      selectedFilters: {},
      metadata: { source: "no_company_scope", generatedAt: new Date().toISOString() },
    });
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const url = new URL(request.url);
  const selectedTrade = url.searchParams.get("trade")?.trim() || null;
  const selectedSubTrade = url.searchParams.get("subTrade")?.trim() || null;
  const selectedTaskCode = url.searchParams.get("taskCode")?.trim() || null;
  const requestedJobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
  const matrixContext = { selectedTrade, selectedSubTrade, selectedTaskCode };

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (requestedJobsiteId && !isJobsiteAllowed(requestedJobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You do not have access to this jobsite." }, { status: 403 });
  }
  if (jobsiteScope.restricted && !requestedJobsiteId && jobsiteScope.jobsiteIds.length === 0) {
    return NextResponse.json({
      rows: [],
      summary: summarizeReadinessRows([]),
      filters: { trades: [], jobsites: [], subTrades: [], taskCodes: [] },
      selectedFilters: matrixContext,
      metadata: { source: "no_jobsite_scope", generatedAt: new Date().toISOString() },
    });
  }

  const adminClient = createSupabaseAdminClient();
  const db = adminClient ?? auth.supabase;
  const companyId = companyScope.companyId;
  const scopedJobsiteIds = requestedJobsiteId
    ? [requestedJobsiteId]
    : jobsiteScope.restricted
      ? jobsiteScope.jobsiteIds
      : [];

  const reqFetch = await fetchCompanyTrainingRequirements(auth.supabase, companyId, false);
  if (reqFetch.error) {
    return NextResponse.json({ error: reqFetch.error }, { status: 500 });
  }

  const allRequirementRows = reqFetch.rows;
  const filteredForSubTrades = allRequirementRows.filter((row) =>
    matchesSelectedMatrixFilter(row.apply_trades, selectedTrade)
  );
  const filteredForTaskCodes = filteredForSubTrades.filter((row) =>
    matchesSelectedMatrixFilter(row.apply_sub_trades, selectedSubTrade)
  );
  const visibleRequirementRows = allRequirementRows.filter((row) => {
    if (!matchesSelectedMatrixFilter(row.apply_trades, selectedTrade)) return false;
    if (!activatesScopedRequirement(row.apply_sub_trades, selectedSubTrade)) return false;
    if (!activatesScopedRequirement(row.apply_task_codes, selectedTaskCode)) return false;
    return true;
  });

  const readinessRequirements: ReadinessRequirement[] = visibleRequirementRows.map((row) => ({
    id: row.id,
    title: row.title,
    matchKeywords: row.match_keywords ?? [],
  }));
  const requirementInputs: TrainingRequirementInput[] = visibleRequirementRows.map((row) => ({
    id: row.id,
    match_keywords: row.match_keywords ?? [],
    match_fields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    apply_trades: row.apply_trades ?? [],
    apply_positions: row.apply_positions ?? [],
    apply_sub_trades: row.apply_sub_trades ?? [],
    apply_task_codes: row.apply_task_codes ?? [],
  }));

  const directory = adminClient
    ? await loadCompanyWorkspaceUsers({
        adminClient,
        authUser: { id: auth.user.id, email: auth.user.email, user_metadata: auth.user.user_metadata },
        companyId,
        scopeTeam: companyScope.companyName,
      })
    : await loadCompanyWorkspaceUsersRls({
        supabase: auth.supabase,
        authUser: { id: auth.user.id, email: auth.user.email, user_metadata: auth.user.user_metadata },
        companyId,
        scopeTeam: companyScope.companyName,
      });

  if (directory.error) {
    return NextResponse.json({ error: directory.error }, { status: 500 });
  }

  const userIds = directory.users.map((user) => user.id);
  const profileResult = userIds.length
    ? await db
        .from("user_profiles")
        .select("user_id, certifications, certification_expirations, job_title, trade_specialty, readiness_status, years_experience")
        .in("user_id", userIds)
    : { data: [], error: null };
  if (profileResult.error && adminClient) {
    return NextResponse.json({ error: profileResult.error.message || "Failed to load user profiles." }, { status: 500 });
  }

  const profileMap = new Map(((profileResult.data ?? []) as ProfileRow[]).map((row) => [row.user_id, row]));
  const asOf = new Date();
  let employeeRows = directory.users.map((user) => {
    const profile = profileMap.get(user.id);
    const expMap = parseCertificationExpirations(profile?.certification_expirations ?? undefined);
    const result = computeTrainingMatrixRow(
      {
        certifications: profile?.certifications ?? [],
        certificationExpirations: expMap,
        job_title: profile?.job_title ?? "",
        trade_specialty: profile?.trade_specialty ?? "",
      },
      requirementInputs,
      asOf,
      matrixContext
    );
    return buildEmployeeReadinessRow({
      requirements: readinessRequirements,
      row: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cells: result.cells,
        cellDetails: result.cellDetails,
        certificationInventory: buildProfileCertificationInventory(profile?.certifications ?? [], expMap, asOf),
        profileFields: {
          tradeSpecialty: profile?.trade_specialty ?? "",
          jobTitle: profile?.job_title ?? "",
        },
      },
    });
  });

  let jobsitesQuery = db
    .from("company_jobsites")
    .select("id, name, status")
    .eq("company_id", companyId);
  if (requestedJobsiteId) jobsitesQuery = jobsitesQuery.eq("id", requestedJobsiteId);
  else if (scopedJobsiteIds.length > 0) jobsitesQuery = jobsitesQuery.in("id", scopedJobsiteIds);
  const jobsitesResult =
    typeof jobsitesQuery.order === "function"
      ? await jobsitesQuery.order("name", { ascending: true })
      : await jobsitesQuery;
  if (jobsitesResult.error) {
    return NextResponse.json({ error: jobsitesResult.error.message || "Failed to load jobsites." }, { status: 500 });
  }
  const jobsites = ((jobsitesResult.data ?? []) as Array<{ id: string; name: string; status?: string | null }>);
  const jobsiteIds = jobsites.map((row) => row.id);
  const jobsiteById = new Map(jobsites.map((row) => [row.id, row]));
  if (requestedJobsiteId) {
    employeeRows = employeeRows.map((row) => ({
      ...row,
      jobsiteId: requestedJobsiteId,
      jobsiteName: jobsiteById.get(requestedJobsiteId)?.name ?? "Selected jobsite",
    }));
  }

  let contractorRows = [] as ReturnType<typeof buildContractorReadinessRow>[];
  const inductionWarnings: string[] = [];
  if (jobsiteIds.length > 0) {
    let reqQuery = db
      .from("jobsite_contractor_training_requirements")
      .select("id, jobsite_id, title, sort_order")
      .eq("company_id", companyId);
    reqQuery = applyJobsiteFilter(reqQuery, jobsiteIds);
    const assignmentQuery = applyJobsiteFilter(
      db
        .from("contractor_employee_jobsite_assignments")
        .select("id, contractor_id, contractor_employee_id, jobsite_id, status")
        .eq("company_id", companyId)
        .eq("status", "active"),
      jobsiteIds
    );
    const [contractorReqsResult, assignmentsResult, contractorsResult, programsResult, inductionReqsResult, completionsResult] =
      await Promise.all([
        reqQuery,
        assignmentQuery,
        db.from("company_contractors").select("id, name").eq("company_id", companyId),
        db.from("company_induction_programs").select("id, name, audience, active").eq("company_id", companyId),
        db.from("company_induction_requirements").select("id, program_id, jobsite_id, active, effective_from, effective_to").eq("company_id", companyId),
        db.from("company_induction_completions").select("program_id, jobsite_id, user_id, visitor_display_name, expires_at, completed_at").eq("company_id", companyId),
      ]);

    const inductionErrors = [
      programsResult.error?.message,
      inductionReqsResult.error?.message,
      completionsResult.error?.message,
    ].filter((message): message is string => Boolean(message));
    inductionWarnings.push(...inductionErrors.filter(isMissingRelationError));

    const firstError =
      contractorReqsResult.error?.message ||
      assignmentsResult.error?.message ||
      contractorsResult.error?.message ||
      inductionErrors.find((message) => !isMissingRelationError(message));
    if (firstError) {
      return NextResponse.json({ error: firstError }, { status: 500 });
    }

    const assignments = (assignmentsResult.data ?? []) as Array<{
      id: string;
      contractor_id: string | null;
      contractor_employee_id: string;
      jobsite_id: string;
      status: string;
    }>;
    const employeeIds = assignments.map((row) => row.contractor_employee_id);
    const contractorIds = uniqueSorted(assignments.map((row) => row.contractor_id ?? ""));

    const [employeesResult, recordsResult, docsResult] = employeeIds.length
      ? await Promise.all([
          db
            .from("contractor_employee_profiles")
            .select("id, full_name, email, contractor_company_name, trade_specialty, job_title, readiness_status")
            .in("id", employeeIds),
          db
            .from("contractor_employee_training_records")
            .select("id, contractor_employee_id, requirement_id, title, completed_on, expires_on")
            .in("contractor_employee_id", employeeIds),
          contractorIds.length
            ? db
                .from("company_contractor_documents")
                .select("contractor_id, title, doc_type, expires_on")
                .eq("company_id", companyId)
                .in("contractor_id", contractorIds)
            : Promise.resolve({ data: [], error: null }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

    const detailError = employeesResult.error?.message || recordsResult.error?.message || docsResult.error?.message;
    if (detailError) {
      return NextResponse.json({ error: detailError }, { status: 500 });
    }

    const contractorNameById = new Map(((contractorsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
    const employeeById = new Map(((employeesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));
    const recordsByEmployee = new Map<string, ContractorReadinessRecord[]>();
    for (const record of (recordsResult.data ?? []) as Array<{
      contractor_employee_id: string;
      requirement_id: string | null;
      title: string;
      completed_on: string | null;
      expires_on: string | null;
    }>) {
      const status = contractorTrainingStatus({
        title: record.title,
        completed_on: record.completed_on,
        expires_on: record.expires_on,
      });
      const list = recordsByEmployee.get(record.contractor_employee_id) ?? [];
      list.push({
        requirementId: record.requirement_id,
        title: record.title,
        status: status === "complete" ? "complete" : status === "expiring" ? "expiring" : status === "expired" ? "expired" : "missing",
        expiresOn: record.expires_on,
      });
      recordsByEmployee.set(record.contractor_employee_id, list);
    }

    const requirementsByJobsite = new Map<string, Array<{ id: string; title: string }>>();
    for (const row of (contractorReqsResult.data ?? []) as Array<{ id: string; jobsite_id: string; title: string }>) {
      const list = requirementsByJobsite.get(row.jobsite_id) ?? [];
      list.push({ id: row.id, title: row.title });
      requirementsByJobsite.set(row.jobsite_id, list);
    }

    const expiredDocsByContractor = new Map<string, Array<{ title: string; docType?: string | null; expiresOn?: string | null }>>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const row of (docsResult.data ?? []) as Array<{ contractor_id: string; title: string; doc_type: string | null; expires_on: string | null }>) {
      if (!row.expires_on) continue;
      const exp = new Date(row.expires_on);
      if (Number.isNaN(exp.getTime()) || exp >= today) continue;
      const list = expiredDocsByContractor.get(row.contractor_id) ?? [];
      list.push({ title: row.title, docType: row.doc_type, expiresOn: row.expires_on });
      expiredDocsByContractor.set(row.contractor_id, list);
    }

    const programs = (programsResult.error ? [] : (programsResult.data ?? [])) as InductionProgramRow[];
    const inductionReqs = (inductionReqsResult.error ? [] : (inductionReqsResult.data ?? [])) as InductionRequirementRow[];
    const completions = (completionsResult.error ? [] : (completionsResult.data ?? [])) as InductionCompletionRow[];

    contractorRows = assignments.map((assignment) => {
      const employee = employeeById.get(assignment.contractor_employee_id) ?? {};
      const name = String(employee.full_name ?? "");
      const induction = evaluateInductionAccess({
        jobsiteId: assignment.jobsite_id,
        subjectUserId: null,
        visitorDisplayName: name,
        programs,
        requirements: inductionReqs,
        completions: completions.filter((c) => c.visitor_display_name?.trim().toLowerCase() === name.trim().toLowerCase()),
      });
      const input: ContractorReadinessInput = {
        assignmentId: assignment.id,
        employeeId: assignment.contractor_employee_id,
        name,
        email: String(employee.email ?? ""),
        contractorId: assignment.contractor_id,
        contractorName: assignment.contractor_id ? contractorNameById.get(assignment.contractor_id) ?? null : null,
        jobsiteId: assignment.jobsite_id,
        jobsiteName: jobsiteById.get(assignment.jobsite_id)?.name ?? "Jobsite",
        trade: String(employee.trade_specialty ?? ""),
        position: String(employee.job_title ?? ""),
        readinessStatus: typeof employee.readiness_status === "string" ? employee.readiness_status : null,
        requirements: requirementsByJobsite.get(assignment.jobsite_id) ?? [],
        records: recordsByEmployee.get(assignment.contractor_employee_id) ?? [],
        induction,
        expiredContractorDocuments: assignment.contractor_id ? expiredDocsByContractor.get(assignment.contractor_id) ?? [] : [],
      };
      return buildContractorReadinessRow(input);
    });
  }

  const operationalWindowDays = 30;
  const operationalSignals = await loadOperationalSignals({
    db: db as unknown as ReadinessQueryClient,
    companyId,
    jobsiteIds,
    sinceIso: new Date(Date.now() - operationalWindowDays * 24 * 60 * 60 * 1000).toISOString(),
  });

  const rows = applyOperationalSignalsToReadinessRows([...employeeRows, ...contractorRows], operationalSignals.signals)
    .filter((row) => !selectedTrade || row.trade.toLowerCase() === selectedTrade.toLowerCase())
    .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));

  return NextResponse.json({
    rows,
    summary: summarizeReadinessRows(rows),
    filters: {
      trades: uniqueSorted([...allRequirementRows.flatMap((row) => row.apply_trades ?? []), ...rows.map((row) => row.trade)]),
      subTrades: uniqueSorted(filteredForSubTrades.flatMap((row) => row.apply_sub_trades ?? [])),
      taskCodes: uniqueSorted(filteredForTaskCodes.flatMap((row) => row.apply_task_codes ?? [])).map((value) => ({
        value,
        label: humanizeTaskCode(value),
      })),
      jobsites: jobsites.map((row) => ({ id: row.id, name: row.name })),
    },
    selectedFilters: {
      ...matrixContext,
      jobsiteId: requestedJobsiteId,
    },
    metadata: {
      source: "live",
      generatedAt: new Date().toISOString(),
      directoryNotice: adminClient ? null : "Directory details are limited until SUPABASE_SERVICE_ROLE_KEY is configured.",
      operationalSignals: {
        windowDays: operationalWindowDays,
        jobsiteSignals: operationalSignals.signals.length,
        warnings: operationalSignals.warnings,
        inductionWarnings,
      },
      schemaMigrationNeeded:
        !reqFetch.applyColumnsAvailable || !reqFetch.taskScopeColumnsAvailable || !reqFetch.generatedColumnsAvailable,
    },
  });
}
