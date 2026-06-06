import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Admin = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

/** Best-effort exact row count with an optional query builder; null on any error. */
async function countRows(
  admin: Admin,
  table: string,
  apply?: (q: any) => any
): Promise<number | null> {
  try {
    let q: any = admin.from(table).select("id", { count: "exact", head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

function sumDefined(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_review_documents"],
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role client is required for command center metrics." }, { status: 500 });
  }

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const deadlineHorizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const [
    // Findings by type (cross-tenant totals)
    correctiveActions,
    incidents,
    observations,
    inspections,
    // Inspections MTD vs prior month
    inspectionsThisMonth,
    inspectionsPrevMonth,
    // Review backlog
    pvSor,
    pvIncidents,
    pvCorrective,
    knowledgeCandidates,
    aiImprovements,
    ownerValidations,
    // Approval memory bank
    memoryTotal,
    memoryApproved,
    memoryRejected,
  ] = await Promise.all([
    countRows(admin, "company_corrective_actions"),
    countRows(admin, "company_incidents"),
    countRows(admin, "company_sor_records"),
    countRows(admin, "company_jobsite_audits"),
    countRows(admin, "company_jobsite_audits", (q) => q.gte("created_at", startOfMonth)),
    countRows(admin, "company_jobsite_audits", (q) => q.gte("created_at", startOfPrevMonth).lt("created_at", startOfMonth)),
    countRows(admin, "company_sor_records", (q) => q.eq("prediction_validation_status", "pending")),
    countRows(admin, "company_incidents", (q) => q.eq("prediction_validation_status", "pending")),
    countRows(admin, "company_corrective_actions", (q) => q.eq("prediction_validation_status", "pending")),
    countRows(admin, "ai_knowledge_ingest_candidates", (q) => q.in("validation_status", ["pending_review", "pending_second_approval"])),
    countRows(admin, "ai_improvement_requests", (q) => q.eq("status", "awaiting_super_admin_approval")),
    countRows(admin, "owner_manual_review_items", (q) => q.in("status", ["not_started", "needs_review"])),
    countRows(admin, "ai_approval_memory"),
    countRows(admin, "ai_approval_memory", (q) => q.eq("decision", "approved")),
    countRows(admin, "ai_approval_memory", (q) => q.eq("decision", "rejected")),
  ]);

  // Organizations needing attention — top by incident volume via SQL GROUP BY + JOIN.
  let topOrgs: Array<{ companyId: string; name: string; openIncidents: number }> = [];
  try {
    const { data: counts } = await admin.rpc("superadmin_top_incident_orgs", { limit_count: 5 });
    topOrgs = ((counts ?? []) as Array<{ company_id: string; company_name: string; incident_count: number }>).map((r) => ({
      companyId: r.company_id,
      name: r.company_name,
      openIncidents: r.incident_count,
    }));
  } catch {
    topOrgs = [];
  }

  // Upcoming compliance deadlines — soonest training/certification expirations.
  let deadlines: Array<{ title: string; dueDate: string; meta: string }> = [];
  try {
    const { data } = await admin
      .from("company_employee_training_records")
      .select("training_title, expires_on, provider")
      .gte("expires_on", nowIso)
      .lte("expires_on", deadlineHorizon)
      .order("expires_on", { ascending: true })
      .limit(6);
    deadlines = ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => row.expires_on)
      .map((row) => ({
        title: String(row.training_title ?? "Training expiration"),
        dueDate: String(row.expires_on),
        meta: String(row.provider ?? "Certification renewal"),
      }));
  } catch {
    deadlines = [];
  }

  return NextResponse.json(
    {
      metrics: {
        findingsByType: { correctiveActions, incidents, observations, inspections },
        inspectionsMtd: { current: inspectionsThisMonth, previous: inspectionsPrevMonth },
        reviewBacklog: {
          predictionValidation: sumDefined([pvSor, pvIncidents, pvCorrective]),
          knowledgeCandidates: knowledgeCandidates ?? 0,
          aiImprovements: aiImprovements ?? 0,
          ownerValidations: ownerValidations ?? 0,
        },
        approvalMemory: {
          total: memoryTotal ?? 0,
          approved: memoryApproved ?? 0,
          rejected: memoryRejected ?? 0,
        },
        topOrgs,
        deadlines,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
  );
}
