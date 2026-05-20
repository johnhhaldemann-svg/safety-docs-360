import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope, uuidMatches } from "@/lib/companyScope";
import {
  buildSearchFacets,
  filterSearchResults,
  normalizeSearchQuery,
  type SearchResultInput,
} from "@/lib/companySearch";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import {
  listMarketplaceDocumentPurchases,
  purchasedMarketplaceDocumentIds,
} from "@/lib/marketplaceDocumentPurchases";
import { authorizeRequest, isCompanyWorkspaceOversightRole } from "@/lib/rbac";
import { formatSafetyBlueprintDocumentType } from "@/lib/safetyBlueprintLabels";

export const runtime = "nodejs";

type DbRow = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value.trim() || fallback;
  if (value == null) return fallback;
  return String(value).trim() || fallback;
}

function iso(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function addIfAllowed(params: {
  inputs: SearchResultInput[];
  row: DbRow;
  jobsiteId?: string | null;
  jobsiteMap: Map<string, string>;
  requestedJobsiteId: string | null;
  allowedJobsiteIds: Set<string> | null;
  input: Omit<SearchResultInput, "jobsiteName">;
}) {
  const rowJobsiteId = params.jobsiteId ?? (typeof params.row.jobsite_id === "string" ? params.row.jobsite_id : null);

  if (params.requestedJobsiteId && !uuidMatches(rowJobsiteId, params.requestedJobsiteId)) {
    return;
  }

  if (params.allowedJobsiteIds && rowJobsiteId && !params.allowedJobsiteIds.has(rowJobsiteId)) {
    return;
  }

  if (params.allowedJobsiteIds && !rowJobsiteId && params.input.type !== "document" && params.input.type !== "training" && params.input.type !== "contractor" && params.input.type !== "company_memory") {
    return;
  }

  params.inputs.push({
    ...params.input,
    jobsiteName: rowJobsiteId ? params.jobsiteMap.get(rowJobsiteId) ?? null : null,
  });
}

async function loadRows(
  query: PromiseLike<{ data: unknown; error: { message?: string | null } | null }>,
  warnings: string[],
  label: string
) {
  const result = await query;
  if (result.error) {
    warnings.push(`${label}: ${result.error.message ?? "query failed"}`);
    return [];
  }
  return ((result.data as DbRow[] | null) ?? []).filter(Boolean);
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_document_library",
      "can_access_jobsites",
      "can_access_field_work",
      "can_view_analytics",
      "can_view_dashboards",
      "can_view_reports",
      "can_view_all_company_data",
    ],
  });
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = normalizeSearchQuery(searchParams.get("q"));
  const requestedJobsiteId = searchParams.get("jobsiteId")?.trim() || null;
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100));
  const types = new Set(
    (searchParams.get("types") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  if (auth.role === "sales_demo") {
    const demo: SearchResultInput[] = [
      {
        id: "demo-jobsite",
        type: "jobsite",
        title: "North Tower",
        subtitle: "Active demo project",
        status: "active",
        updatedAt: new Date().toISOString(),
        href: "/jobsites/demo-jobsite/overview",
        jobsiteName: "North Tower",
        sourceTable: "company_jobsites",
        fields: [{ label: "Project", value: "North Tower steel erection" }],
      },
      {
        id: "demo-risk",
        type: "field_issue",
        title: "Open leading-edge observation",
        subtitle: "High risk field signal",
        status: "open",
        updatedAt: new Date().toISOString(),
        href: "/field-id-exchange",
        jobsiteName: "North Tower",
        sourceTable: "company_sor_records",
        fields: [{ label: "Description", value: "leading edge guardrail gap" }],
      },
    ];
    const results = filterSearchResults({ inputs: demo, query: q, types, limit });
    return NextResponse.json({ results, facets: buildSearchFacets(results, q), warnings: [] });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ results: [], facets: buildSearchFacets([], q), warning: "No company workspace is linked to this account yet." });
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (requestedJobsiteId && !isJobsiteAllowed(requestedJobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only search assigned jobsites." }, { status: 403 });
  }

  const allowedJobsiteIds = jobsiteScope.restricted ? new Set(jobsiteScope.jobsiteIds) : null;
  const warnings: string[] = [];
  const companyId = companyScope.companyId;

  const jobsites = await loadRows(
    auth.supabase
      .from("company_jobsites")
      .select("id, name, project_number, jobsite_number, location, status, project_manager, safety_lead, updated_at, created_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(120),
    warnings,
    "jobsites"
  );
  const jobsiteMap = new Map(jobsites.map((row) => [String(row.id), text(row.name, "Jobsite")]));
  const inputs: SearchResultInput[] = [];

  for (const row of jobsites) {
    const id = text(row.id);
    if (!id || (allowedJobsiteIds && !allowedJobsiteIds.has(id))) continue;
    if (requestedJobsiteId && !uuidMatches(id, requestedJobsiteId)) continue;
    inputs.push({
      id,
      type: "jobsite",
      title: text(row.name, "Untitled jobsite"),
      subtitle: [row.project_number, row.jobsite_number, row.location].map((value) => text(value)).filter(Boolean).join(" | ") || null,
      status: text(row.status, "active"),
      updatedAt: iso(row.updated_at ?? row.created_at),
      href: `/jobsites/${encodeURIComponent(id)}/overview`,
      jobsiteName: text(row.name, "Jobsite"),
      sourceTable: "company_jobsites",
      fields: [
        { label: "Name", value: row.name },
        { label: "Project number", value: row.project_number },
        { label: "Jobsite number", value: row.jobsite_number },
        { label: "Location", value: row.location },
        { label: "Project manager", value: row.project_manager },
        { label: "Safety lead", value: row.safety_lead },
      ],
    });
  }

  const purchaseResult = await listMarketplaceDocumentPurchases(auth.supabase, companyId);
  const purchasedDocumentIds = !purchaseResult.error
    ? purchasedMarketplaceDocumentIds(purchaseResult.data)
    : [];

  const [
    documents,
    generatedDocuments,
    sorRecords,
    correctiveActions,
    incidents,
    permits,
    jsas,
    training,
    contractors,
    memoryItems,
    riskRecommendations,
  ] = await Promise.all([
    loadRows(
      auth.supabase
        .from("documents")
        .select("id, company_id, user_id, document_title, title, project_name, file_name, document_type, category, status, notes, final_file_path, updated_at, created_at")
        .or(`company_id.eq.${companyId},user_id.eq.${auth.user.id}${purchasedDocumentIds.length ? `,id.in.(${purchasedDocumentIds.join(",")})` : ""}`)
        .order("updated_at", { ascending: false })
        .limit(160),
      warnings,
      "documents"
    ),
    loadRows(
      auth.supabase
        .from("company_generated_documents")
        .select("id, jobsite_id, document_type, title, status, updated_at, created_at, generated_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(80),
      warnings,
      "generated documents"
    ),
    loadRows(
      auth.supabase
        .from("company_sor_records")
        .select("id, project, location, trade, category, subcategory, description, severity, status, updated_at, created_at, date, is_deleted")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .neq("status", "superseded")
        .order("updated_at", { ascending: false })
        .limit(160),
      warnings,
      "field issues"
    ),
    loadRows(
      auth.supabase
        .from("company_corrective_actions")
        .select("id, jobsite_id, title, description, severity, priority, status, workflow_status, category, observation_type, updated_at, created_at, is_deleted")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .limit(160),
      warnings,
      "corrective actions"
    ),
    loadRows(
      auth.supabase
        .from("company_incidents")
        .select("id, jobsite_id, title, description, status, severity, category, injury_type, body_part, updated_at, created_at, occurred_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(120),
      warnings,
      "incidents"
    ),
    loadRows(
      auth.supabase
        .from("company_permits")
        .select("id, jobsite_id, permit_type, title, status, severity, category, stop_work_status, assignment_rationale, updated_at, created_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(120),
      warnings,
      "permits"
    ),
    loadRows(
      auth.supabase
        .from("company_jsas")
        .select("id, jobsite_id, title, description, status, severity, category, updated_at, created_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(120),
      warnings,
      "JSAs"
    ),
    loadRows(
      auth.supabase
        .from("company_training_requirements")
        .select("id, title, match_keywords, match_fields, apply_trades, apply_positions, is_generated, updated_at, created_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(140),
      warnings,
      "training requirements"
    ),
    loadRows(
      auth.supabase
        .from("company_contractors")
        .select("id, name, notes, active, updated_at, created_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(120),
      warnings,
      "contractors"
    ),
    loadRows(
      auth.supabase
        .from("company_memory_items")
        .select("id, source, title, body, metadata, updated_at, created_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(80),
      warnings,
      "company memory"
    ),
    loadRows(
      auth.supabase
        .from("company_risk_ai_recommendations")
        .select("id, jobsite_id, kind, title, body, confidence, dismissed, created_at")
        .eq("company_id", companyId)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(80),
      warnings,
      "risk recommendations"
    ),
  ]);

  for (const row of documents) {
    const id = text(row.id);
    if (!id) continue;
    const isPurchased = purchasedDocumentIds.some((purchasedId) => uuidMatches(purchasedId, id));
    const companyOwned = uuidMatches(text(row.company_id), companyId);
    const ownDocument = uuidMatches(text(row.user_id), auth.user.id);
    if (!isCompanyWorkspaceOversightRole(auth.role) && !isPurchased && !ownDocument && !companyOwned) continue;
    const type = isPurchased && !companyOwned ? "marketplace_template" : "document";
    inputs.push({
      id,
      type,
      title: row.document_title ?? row.title ?? row.project_name ?? row.file_name,
      subtitle: [formatSafetyBlueprintDocumentType(text(row.document_type)), row.category, isPurchased ? "Purchased template" : null].map((value) => text(value)).filter(Boolean).join(" | ") || null,
      status: row.status,
      updatedAt: iso(row.updated_at ?? row.created_at),
      href: `/library?doc=${encodeURIComponent(id)}`,
      jobsiteName: null,
      sourceTable: "documents",
      fields: [
        { label: "Title", value: row.document_title ?? row.title },
        { label: "Project", value: row.project_name },
        { label: "File", value: row.file_name },
        { label: "Type", value: row.document_type },
        { label: "Category", value: row.category },
        { label: "Notes", value: row.notes },
      ],
    });
  }

  for (const row of generatedDocuments) {
    const id = text(row.id);
    if (!id) continue;
    addIfAllowed({
      inputs,
      row,
      jobsiteMap,
      requestedJobsiteId,
      allowedJobsiteIds,
      input: {
        id,
        type: "generated_document",
        title: row.title,
        subtitle: formatSafetyBlueprintDocumentType(text(row.document_type)),
        status: row.status,
        updatedAt: iso(row.updated_at ?? row.generated_at ?? row.created_at),
        href: `/safety-intelligence?document=${encodeURIComponent(id)}`,
        sourceTable: "company_generated_documents",
        fields: [
          { label: "Title", value: row.title },
          { label: "Type", value: row.document_type },
          { label: "Status", value: row.status },
        ],
      },
    });
  }

  for (const row of sorRecords) {
    const id = text(row.id);
    if (!id) continue;
    if (requestedJobsiteId) continue;
    inputs.push({
      id,
      type: "field_issue",
      title: text(row.description, "Field issue").slice(0, 120),
      subtitle: [row.project, row.location, row.trade, row.category].map((value) => text(value)).filter(Boolean).join(" | ") || null,
      status: text(row.status, "open"),
      updatedAt: iso(row.updated_at ?? row.created_at ?? row.date),
      href: `/field-id-exchange?sor=${encodeURIComponent(id)}`,
      jobsiteName: text(row.project) || null,
      sourceTable: "company_sor_records",
      fields: [
        { label: "Description", value: row.description },
        { label: "Project", value: row.project },
        { label: "Location", value: row.location },
        { label: "Trade", value: row.trade },
        { label: "Category", value: row.category },
        { label: "Severity", value: row.severity },
      ],
    });
  }

  for (const row of correctiveActions) {
    const id = text(row.id);
    if (!id) continue;
    addIfAllowed({
      inputs,
      row,
      jobsiteMap,
      requestedJobsiteId,
      allowedJobsiteIds,
      input: {
        id,
        type: "corrective_action",
        title: row.title,
        subtitle: [row.category, row.observation_type, row.priority].map((value) => text(value)).filter(Boolean).join(" | ") || null,
        status: row.workflow_status ?? row.status,
        updatedAt: iso(row.updated_at ?? row.created_at),
        href: `/field-id-exchange?action=${encodeURIComponent(id)}`,
        sourceTable: "company_corrective_actions",
        fields: [
          { label: "Title", value: row.title },
          { label: "Description", value: row.description },
          { label: "Category", value: row.category },
          { label: "Observation type", value: row.observation_type },
          { label: "Severity", value: row.severity },
          { label: "Priority", value: row.priority },
        ],
      },
    });
  }

  for (const row of incidents) {
    const id = text(row.id);
    if (!id) continue;
    addIfAllowed({
      inputs,
      row,
      jobsiteMap,
      requestedJobsiteId,
      allowedJobsiteIds,
      input: {
        id,
        type: "incident",
        title: row.title,
        subtitle: [row.category, row.severity, row.injury_type, row.body_part].map((value) => text(value)).filter(Boolean).join(" | ") || null,
        status: row.status,
        updatedAt: iso(row.updated_at ?? row.occurred_at ?? row.created_at),
        href: `/incidents?id=${encodeURIComponent(id)}`,
        sourceTable: "company_incidents",
        fields: [
          { label: "Title", value: row.title },
          { label: "Description", value: row.description },
          { label: "Category", value: row.category },
          { label: "Injury type", value: row.injury_type },
          { label: "Body part", value: row.body_part },
        ],
      },
    });
  }

  for (const row of permits) {
    const id = text(row.id);
    if (!id) continue;
    addIfAllowed({
      inputs,
      row,
      jobsiteMap,
      requestedJobsiteId,
      allowedJobsiteIds,
      input: {
        id,
        type: "permit",
        title: row.title ?? row.permit_type,
        subtitle: [row.permit_type, row.category, row.stop_work_status].map((value) => text(value)).filter(Boolean).join(" | ") || null,
        status: row.status,
        updatedAt: iso(row.updated_at ?? row.created_at),
        href: `/permits?id=${encodeURIComponent(id)}`,
        sourceTable: "company_permits",
        fields: [
          { label: "Title", value: row.title },
          { label: "Permit type", value: row.permit_type },
          { label: "Category", value: row.category },
          { label: "Rationale", value: row.assignment_rationale },
        ],
      },
    });
  }

  for (const row of jsas) {
    const id = text(row.id);
    if (!id) continue;
    addIfAllowed({
      inputs,
      row,
      jobsiteMap,
      requestedJobsiteId,
      allowedJobsiteIds,
      input: {
        id,
        type: "jsa",
        title: row.title,
        subtitle: [row.category, row.severity].map((value) => text(value)).filter(Boolean).join(" | ") || null,
        status: row.status,
        updatedAt: iso(row.updated_at ?? row.created_at),
        href: `/jsa?id=${encodeURIComponent(id)}`,
        sourceTable: "company_jsas",
        fields: [
          { label: "Title", value: row.title },
          { label: "Description", value: row.description },
          { label: "Category", value: row.category },
        ],
      },
    });
  }

  for (const row of training) {
    const id = text(row.id);
    if (!id) continue;
    inputs.push({
      id,
      type: "training",
      title: row.title,
      subtitle: [row.apply_trades, row.apply_positions].map((value) => text(value)).filter(Boolean).join(" | ") || null,
      status: row.is_generated ? "generated" : "configured",
      updatedAt: iso(row.updated_at ?? row.created_at),
      href: `/training-matrix?requirement=${encodeURIComponent(id)}`,
      jobsiteName: null,
      sourceTable: "company_training_requirements",
      fields: [
        { label: "Title", value: row.title },
        { label: "Keywords", value: row.match_keywords },
        { label: "Trades", value: row.apply_trades },
        { label: "Positions", value: row.apply_positions },
      ],
    });
  }

  for (const row of contractors) {
    const id = text(row.id);
    if (!id) continue;
    inputs.push({
      id,
      type: "contractor",
      title: row.name,
      subtitle: row.notes,
      status: row.active === false ? "inactive" : "active",
      updatedAt: iso(row.updated_at ?? row.created_at),
      href: `/company-contractors/${encodeURIComponent(id)}`,
      jobsiteName: null,
      sourceTable: "company_contractors",
      fields: [
        { label: "Name", value: row.name },
        { label: "Notes", value: row.notes },
      ],
    });
  }

  for (const row of memoryItems) {
    const id = text(row.id);
    if (!id) continue;
    inputs.push({
      id,
      type: "company_memory",
      title: row.title,
      subtitle: row.source,
      status: "memory",
      updatedAt: iso(row.updated_at ?? row.created_at),
      href: `/command-center?memory=${encodeURIComponent(id)}`,
      jobsiteName: null,
      sourceTable: "company_memory_items",
      fields: [
        { label: "Title", value: row.title },
        { label: "Body", value: row.body },
        { label: "Source", value: row.source },
      ],
    });
  }

  for (const row of riskRecommendations) {
    const id = text(row.id);
    if (!id) continue;
    addIfAllowed({
      inputs,
      row,
      jobsiteMap,
      requestedJobsiteId,
      allowedJobsiteIds,
      input: {
        id,
        type: "risk_recommendation",
        title: row.title,
        subtitle:
          [row.kind, row.confidence ? `Confidence ${row.confidence}` : null]
            .map((item) => text(item))
            .filter(Boolean)
            .join(" | ") || null,
        status: "open",
        updatedAt: iso(row.created_at),
        href: `/settings/risk-memory?recommendation=${encodeURIComponent(id)}`,
        sourceTable: "company_risk_ai_recommendations",
        fields: [
          { label: "Title", value: row.title },
          { label: "Body", value: row.body },
          { label: "Kind", value: row.kind },
          { label: "Confidence", value: row.confidence },
        ],
      },
    });
  }

  const results = filterSearchResults({ inputs, query: q, types, limit });
  return NextResponse.json({
    results,
    facets: buildSearchFacets(results, q),
    warnings,
  });
}
