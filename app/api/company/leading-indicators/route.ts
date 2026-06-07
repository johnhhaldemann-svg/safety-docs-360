import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/company/leading-indicators?days=30&siteId=
// Returns aggregated leading safety indicator metrics.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_access_field_work"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(7, parseInt(url.searchParams.get("days") ?? "30", 10)));
  const siteId = url.searchParams.get("siteId") ?? null;

  const companyId = companyScope.companyId;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const now = new Date().toISOString();

  const db = auth.supabase;

  // ── Parallel queries ──────────────────────────────────────────────────────

  const [
    nearMissResult,
    positiveObsResult,
    negativeObsResult,
    openCaResult,
    overdueCaResult,
    closedCaResult,
    totalCaResult,
    incidentTrendResult,
    sifResult,
  ] = await Promise.all([
    // Near-misses reported
    (() => {
      let q = db.from("company_incidents").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).eq("category", "near_miss").gte("occurred_at", since);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Positive safety observations
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).eq("observation_type", "positive").gte("created_at", since);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Negative observations / hazards identified
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).in("observation_type", ["negative"]).gte("created_at", since);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Open corrective actions
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).in("status", ["open", "in_progress"]);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Overdue corrective actions
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).in("status", ["open", "in_progress"]).lt("due_at", now);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Closed corrective actions in window
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).eq("status", "closed").gte("updated_at", since);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Total corrective actions created in window
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).gte("created_at", since);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // Incident trend: last N periods
    (() => {
      let q = db.from("company_incidents")
        .select("occurred_at, category, severity")
        .eq("company_id", companyId).gte("occurred_at", since)
        .order("occurred_at", { ascending: true });
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),

    // SIF-potential items
    (() => {
      let q = db.from("corrective_actions").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).eq("sif_potential", "yes").gte("created_at", since);
      if (siteId) q = q.eq("jobsite_id", siteId);
      return q;
    })(),
  ]);

  const nearMissCount = nearMissResult.count ?? 0;
  const positiveObsCount = positiveObsResult.count ?? 0;
  const negativeObsCount = negativeObsResult.count ?? 0;
  const openCaCount = openCaResult.count ?? 0;
  const overdueCaCount = overdueCaResult.count ?? 0;
  const closedCaCount = closedCaResult.count ?? 0;
  const totalCaCount = totalCaResult.count ?? 0;
  const sifCount = sifResult.count ?? 0;

  // CA closure rate
  const closureRate = totalCaCount > 0 ? Math.round((closedCaCount / totalCaCount) * 100) : null;

  // Observation ratio (positive / total)
  const totalObs = positiveObsCount + negativeObsCount;
  const obsPositiveRate = totalObs > 0 ? Math.round((positiveObsCount / totalObs) * 100) : null;

  // Incident trend bucketed by week
  const incidents = (incidentTrendResult.data ?? []) as Array<{ occurred_at: string; category: string; severity: string }>;
  const weekBuckets: Record<string, { nearMiss: number; incident: number; firstAid: number }> = {};
  for (const inc of incidents) {
    const d = new Date(inc.occurred_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekBuckets[key]) weekBuckets[key] = { nearMiss: 0, incident: 0, firstAid: 0 };
    if (inc.category === "near_miss") weekBuckets[key].nearMiss++;
    else if (inc.category === "incident") weekBuckets[key].incident++;
    else if (inc.category === "first_aid") weekBuckets[key].firstAid++;
  }

  const trendData = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, counts]) => ({ week, ...counts }));

  function overdueScore(overdue: number, open: number) {
    if (open === 0) return 100;
    return Math.max(0, Math.round(100 - (overdue / open) * 100));
  }

  const metrics = {
    windowDays: days,
    siteId: siteId ?? null,
    nearMissReported: nearMissCount,
    positiveObservations: positiveObsCount,
    negativeObservations: negativeObsCount,
    obsPositiveRate,
    openCorrectiveActions: openCaCount,
    overdueCorrectiveActions: overdueCaCount,
    closedCorrectiveActions: closedCaCount,
    totalCorrectiveActionsCreated: totalCaCount,
    caClosureRate: closureRate,
    sifPotentialItems: sifCount,
    scores: {
      caClosureRate: closureRate,
      onTimeCompletion: overdueScore(overdueCaCount, openCaCount),
      observationActivity: Math.min(100, Math.round((totalObs / Math.max(1, days / 7)) * 10)),
      nearMissReporting: Math.min(100, Math.round((nearMissCount / Math.max(1, days / 7)) * 20)),
    },
    trend: trendData,
  };

  return NextResponse.json(metrics);
}
