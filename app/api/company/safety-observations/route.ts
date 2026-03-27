import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { canManageObservations } from "@/lib/companyPermissions";
import { parseSafetyObservationBody } from "@/lib/safety-observations/validate";
import type { SafetyObservationKpis, SafetyObservationRow } from "@/lib/safety-observations/types";

export const runtime = "nodejs";

const LIST_SELECT =
  "id,company_id,jobsite_id,project_id,title,description,observation_type,category,subcategory,severity,status,trade,location,assigned_to,created_by,closed_by,due_date,closed_at,photo_urls,tags,corrective_action,immediate_action_taken,created_at,updated_at";

function startOfIsoWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countScoped(
  supabase: any,
  companyId: string,
  jobsiteScope: { restricted: boolean; jobsiteIds: string[] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any
) {
  let q = supabase.from("safety_observations").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return 0;
    q = q.in("jobsite_id", jobsiteScope.jobsiteIds);
  }
  q = apply(q);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_dashboards",
      "can_view_analytics",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!companyScope.companyId) {
    const emptyKpis: SafetyObservationKpis = {
      totalObservations: 0,
      openHazards: 0,
      highCriticalOpen: 0,
      positiveObservations: 0,
      nearMisses: 0,
      closedThisWeek: 0,
    };
    return NextResponse.json({
      observations: [],
      total: 0,
      page: 1,
      pageSize: 20,
      kpis: emptyKpis,
    });
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const observation_type = searchParams.get("observation_type")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const subcategory = searchParams.get("subcategory")?.trim() ?? "";
  const severity = searchParams.get("severity")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const jobsite_id = searchParams.get("jobsite_id")?.trim() ?? "";
  const days = Number(searchParams.get("days") ?? "365");
  const since = new Date(Date.now() - Math.max(1, Math.min(days, 730)) * 24 * 60 * 60 * 1000).toISOString();

  const weekStart = startOfIsoWeek(new Date());

  let kpis: SafetyObservationKpis;
  try {
    const supa = auth.supabase;
    const companyId = companyScope.companyId;

    const totalObservations = await countScoped(supa, companyId, jobsiteScope, (q) => q.gte("created_at", since));

    const openHazards = await countScoped(supa, companyId, jobsiteScope, (q) =>
      q
        .eq("observation_type", "Hazard")
        .neq("status", "Closed")
        .gte("created_at", since)
    );

    const highCriticalOpen = await countScoped(supa, companyId, jobsiteScope, (q) =>
      q
        .neq("status", "Closed")
        .in("severity", ["High", "Critical"])
        .gte("created_at", since)
    );

    const positiveObservations = await countScoped(supa, companyId, jobsiteScope, (q) =>
      q.eq("observation_type", "Positive").gte("created_at", since)
    );

    const nearMisses = await countScoped(supa, companyId, jobsiteScope, (q) =>
      q.eq("observation_type", "Near_Miss").gte("created_at", since)
    );

    const closedThisWeek = await countScoped(supa, companyId, jobsiteScope, (q) =>
      q.not("closed_at", "is", null).gte("closed_at", weekStart)
    );

    kpis = {
      totalObservations,
      openHazards,
      highCriticalOpen,
      positiveObservations,
      nearMisses,
      closedThisWeek,
    };
  } catch {
    return NextResponse.json({ error: "Failed to compute safety observation metrics." }, { status: 500 });
  }

  let listQuery = auth.supabase
    .from("safety_observations")
    .select(LIST_SELECT, { count: "exact" })
    .eq("company_id", companyScope.companyId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({
        observations: [],
        total: 0,
        page,
        pageSize,
        kpis,
      });
    }
    listQuery = listQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  if (search) {
    const safe = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    listQuery = listQuery.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (observation_type) listQuery = listQuery.eq("observation_type", observation_type);
  if (category) listQuery = listQuery.eq("category", category);
  if (subcategory) listQuery = listQuery.eq("subcategory", subcategory);
  if (severity) listQuery = listQuery.eq("severity", severity);
  if (status) listQuery = listQuery.eq("status", status);
  if (jobsite_id) listQuery = listQuery.eq("jobsite_id", jobsite_id);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  listQuery = listQuery.range(from, to);

  const listResult = await listQuery;
  if (listResult.error) {
    if (listResult.error.message?.toLowerCase().includes("safety_observations")) {
      return NextResponse.json(
        { error: "Safety observations table not found. Apply latest migrations.", code: "schema" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: listResult.error.message || "Failed to load observations." }, { status: 500 });
  }

  const observations = (listResult.data ?? []) as SafetyObservationRow[];
  const total = listResult.count ?? observations.length;

  return NextResponse.json({
    observations,
    total,
    page,
    pageSize,
    kpis,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageObservations(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to create safety observations." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseSafetyObservationBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(parsed.value.jobsite_id, jobsiteScope)) {
    return NextResponse.json({ error: "Jobsite access denied for this observation." }, { status: 403 });
  }

  const insertRow = {
    company_id: companyScope.companyId,
    jobsite_id: parsed.value.jobsite_id,
    project_id: parsed.value.project_id,
    title: parsed.value.title,
    description: parsed.value.description,
    observation_type: parsed.value.observation_type,
    category: parsed.value.category,
    subcategory: parsed.value.subcategory,
    severity: parsed.value.severity,
    status: parsed.value.status,
    trade: parsed.value.trade,
    location: parsed.value.location,
    immediate_action_taken: parsed.value.immediate_action_taken,
    corrective_action: parsed.value.corrective_action,
    assigned_to: parsed.value.assigned_to,
    due_date: parsed.value.due_date,
    photo_urls: parsed.value.photo_urls,
    linked_dap_id: parsed.value.linked_dap_id,
    linked_jsa_id: parsed.value.linked_jsa_id,
    linked_incident_id: parsed.value.linked_incident_id,
    created_by: auth.user.id,
  };

  const insertResult = await auth.supabase.from("safety_observations").insert(insertRow).select("id").single();
  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message || "Insert failed." }, { status: 500 });
  }

  const id = insertResult.data?.id as string | undefined;
  if (id) {
    await auth.supabase.from("safety_observation_updates").insert({
      observation_id: id,
      update_type: "Comment",
      message: "Observation created.",
      created_by: auth.user.id,
    });
  }

  const full = await auth.supabase.from("safety_observations").select(LIST_SELECT).eq("id", id!).single();
  return NextResponse.json({ observation: full.data }, { status: 201 });
}
