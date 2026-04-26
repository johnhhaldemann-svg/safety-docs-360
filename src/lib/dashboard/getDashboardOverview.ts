import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getCompanyScope } from "@/lib/companyScope";
import { normalizeDocumentStatus } from "@/lib/documentStatus";
import type {
  ContractorRiskScore,
  CorrectiveActionStatus,
  DashboardAiInsight,
  DashboardOverview,
  DashboardOverviewRiskLevel,
  DashboardSummary,
  DocumentReadiness,
  EngineHealthItem,
  PermitCompliance,
  RiskCategory,
  RiskSeverityBand,
  TrendDirection,
  TrendPoint,
} from "./types";
import { generateDashboardInsights, rulesInsightsToAiInsights } from "./generateDashboardInsights";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isMissingRelationError(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    m.includes("not find the '") ||
    m.includes("permission denied for relation") ||
    m.includes("pgrst")
  );
}

function nowIso() {
  return new Date().toISOString();
}

function clampScore(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseDay(value?: string | null): Date | null {
  if (!value || !ISO_DAY.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultRange(params?: { startDate?: string; endDate?: string }) {
  const end = parseDay(params?.endDate) ?? new Date();
  const start =
    parseDay(params?.startDate) ??
    new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function severityRank(s?: string | null): number {
  const v = (s ?? "").toLowerCase();
  if (v === "critical") return 4;
  if (v === "high") return 3;
  if (v === "medium" || v === "moderate") return 2;
  if (v === "low") return 1;
  return 0;
}

function bandRank(s: RiskSeverityBand): number {
  return severityRank(s);
}

function matchesRiskSeverity(severity: string | null | undefined, level: DashboardOverviewRiskLevel): boolean {
  if (level === "all") return true;
  const s = (severity ?? "").toLowerCase();
  if (level === "high") return s === "high" || s === "critical";
  if (level === "medium") return s === "medium" || s === "moderate";
  if (level === "low") return s === "low" || s === "" || !severity;
  return true;
}

function toRiskSeverityBand(s?: string | null): RiskSeverityBand {
  const r = severityRank(s);
  if (r >= 4) return "critical";
  if (r >= 3) return "high";
  if (r >= 2) return "medium";
  return "low";
}

function isClosedCorrective(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "closed" || s === "verified_closed" || s === "corrected";
}

function isActiveCorrective(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return !isClosedCorrective(s) && s !== "archived";
}

function isHighRiskObservation(row: { severity?: string | null; status?: string | null }) {
  const sev = (row.severity ?? "").toLowerCase();
  const st = (row.status ?? "").toLowerCase();
  return sev === "high" || sev === "critical" || st === "stop_work" || st === "escalated";
}

function weekStartUtc(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const diff = (dow + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  return x.toISOString().slice(0, 10);
}

function emptyDocumentReadiness(): DocumentReadiness {
  return {
    draft: 0,
    submitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    missingRequired: 0,
    expiringSoon: 0,
  };
}

function emptySummary(): DashboardSummary {
  return {
    safetyHealthScore: 100,
    openHighRiskItems: 0,
    overdueCorrectiveActions: 0,
    incidentCount: 0,
    nearMissCount: 0,
    permitComplianceRate: 0,
    jsaCompletionRate: 0,
    trainingReadinessRate: 0,
    documentReadinessRate: 0,
  };
}

function yellowEngine(moduleName: string, message: string, route?: string): EngineHealthItem {
  return {
    moduleName,
    status: "yellow",
    lastChecked: nowIso(),
    message,
    route,
  };
}

function greenEngine(moduleName: string, message: string, route?: string): EngineHealthItem {
  return {
    moduleName,
    status: "green",
    lastChecked: nowIso(),
    message,
    route,
  };
}

function redEngine(moduleName: string, message: string, route?: string): EngineHealthItem {
  return {
    moduleName,
    status: "red",
    lastChecked: nowIso(),
    message,
    route,
  };
}

function emptyOverview(params: {
  engineHealth: EngineHealthItem[];
  aiInsights: DashboardAiInsight[];
}): DashboardOverview {
  return {
    summary: emptySummary(),
    incidentTrend: [],
    observationTrend: [],
    correctiveActionStatus: { open: 0, overdue: 0, closed: 0, averageDaysToClose: null },
    topRisks: [],
    contractorRiskScores: [],
    permitCompliance: [],
    documentReadiness: emptyDocumentReadiness(),
    engineHealth: params.engineHealth,
    aiInsights: params.aiInsights,
    overdueCorrectiveSamples: [],
    observationCategoryTop: [],
    credentialGaps: { expiredCredentials: 0, expiringSoonCredentials: 0 },
  };
}

type TableLoad<T> = { ok: true; data: T } | { ok: false; missing: boolean; message?: string };

async function loadTableRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  /** Supabase filter builder — typed loosely so missing columns/tables fail softly at runtime. */
  build: (q: {
    eq: (column: string, value: string | boolean) => unknown;
    gte: (column: string, value: string) => unknown;
    lte: (column: string, value: string) => unknown;
    in: (column: string, values: string[]) => unknown;
  }) => unknown
): Promise<TableLoad<T[]>> {
  try {
    const q0 = supabase.from(table as never).select(select) as unknown as {
      eq: (column: string, value: string | boolean) => unknown;
      gte: (column: string, value: string) => unknown;
      lte: (column: string, value: string) => unknown;
      in: (column: string, values: string[]) => unknown;
    };
    const res = (await build(q0)) as { data: T[] | null; error: { message?: string } | null };
    if (res.error) {
      if (isMissingRelationError(res.error.message)) {
        return { ok: false, missing: true, message: res.error.message ?? undefined };
      }
      return { ok: false, missing: false, message: res.error.message ?? "query failed" };
    }
    return { ok: true, data: (res.data ?? []) as T[] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, missing: isMissingRelationError(msg), message: msg };
  }
}

function buildTrendBuckets(
  start: Date,
  end: Date,
  useWeek: boolean
): Map<string, { positive: number; negative: number; incidents: number; nearMisses: number }> {
  const map = new Map<string, { positive: number; negative: number; incidents: number; nearMisses: number }>();
  const step = useWeek ? 7 * 86400000 : 86400000;
  for (let t = start.getTime(); t <= end.getTime(); t += step) {
    const d = new Date(t);
    const key = useWeek ? weekStartUtc(d) : d.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { positive: 0, negative: 0, incidents: 0, nearMisses: 0 });
    }
  }
  return map;
}

function bucketForDate(d: Date, useWeek: boolean) {
  return useWeek ? weekStartUtc(d) : d.toISOString().slice(0, 10);
}

/**
 * Builds a {@link DashboardOverview} from live Supabase data for the signed-in user.
 *
 * **Server-only:** uses {@link createSupabaseRouteHandlerClient} (cookies). Call from
 * Server Components or Route Handlers — not from client bundles.
 *
 * Never throws: on failure, returns zeros/empty collections plus engine-health diagnostics.
 */
export async function getDashboardOverview(params?: {
  jobsiteId?: string;
  /** When set (jobsite-limited users without a single jobsite), restrict rows to these jobsite ids. */
  jobsiteIdAllowlist?: string[] | null;
  contractorId?: string;
  startDate?: string;
  endDate?: string;
  riskLevel?: DashboardOverviewRiskLevel;
}): Promise<DashboardOverview> {
  const { start, end } = defaultRange(params);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const useWeek = end.getTime() - start.getTime() > 45 * 86400000;

  const supabase = await createSupabaseRouteHandlerClient();
  if (!supabase) {
    return emptyOverview({
      engineHealth: [redEngine("Supabase connection", "Server Supabase client could not be created (URL/keys/cookies).")],
      aiInsights: [
        {
          id: "insight-no-client",
          title: "Dashboard data is unavailable",
          body: "The application could not open a Supabase session on the server. Sign in again after confirming environment configuration.",
        },
      ],
    });
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authErr || !user) {
    return emptyOverview({
      engineHealth: [
        yellowEngine("Supabase connection", "Connected, but no authenticated user was found for this request."),
      ],
      aiInsights: [
        {
          id: "insight-auth",
          title: "Sign in to load company analytics",
          body: "Dashboard overview requires an authenticated session with a company workspace.",
          href: "/login",
        },
      ],
    });
  }

  const scope = await getCompanyScope({
    supabase,
    userId: user.id,
    fallbackTeam: (user.user_metadata as { team?: string } | undefined)?.team ?? "General",
    authUser: user,
  });

  if (!scope.companyId) {
    return emptyOverview({
      engineHealth: [
        yellowEngine(
          "Company workspace",
          "No company_id could be resolved for this account yet. Link a company membership or role row."
        ),
      ],
      aiInsights: [
        {
          id: "insight-scope",
          title: "Company scope is not ready",
          body: "Attach this user to a company workspace to load incidents, permits, and training signals.",
        },
      ],
    });
  }

  const companyId = scope.companyId;
  const jobsiteId = params?.jobsiteId?.trim() || null;
  const jobsiteIdAllowlist =
    !jobsiteId && params?.jobsiteIdAllowlist && params.jobsiteIdAllowlist.length > 0 ? params.jobsiteIdAllowlist : null;
  const contractorId = params?.contractorId?.trim() || null;
  const riskLevel: DashboardOverviewRiskLevel = params?.riskLevel ?? "all";

  const missingTables: string[] = [];
  const engine: EngineHealthItem[] = [greenEngine("Supabase connection", "Session resolved; queries run under RLS.")];

  type RowFilter = {
    eq: (c: string, v: string | boolean) => RowFilter;
    gte: (c: string, v: string) => RowFilter;
    lte: (c: string, v: string) => RowFilter;
    in: (c: string, vals: string[]) => RowFilter;
  };

  const withCompanyAndWindow = (q: RowFilter) => {
    let c = q.eq("company_id", companyId);
    if (jobsiteId) c = c.eq("jobsite_id", jobsiteId);
    else if (jobsiteIdAllowlist) c = c.in("jobsite_id", jobsiteIdAllowlist);
    return c.gte("created_at", startIso).lte("created_at", endIso);
  };

  const correctiveLoad = await loadTableRows<{
    id: string;
    status?: string | null;
    severity?: string | null;
    category?: string | null;
    observation_type?: string | null;
    due_at?: string | null;
    closed_at?: string | null;
    created_at?: string | null;
    jobsite_id?: string | null;
  }>(
    supabase,
    "company_corrective_actions",
    "id,status,severity,category,observation_type,due_at,closed_at,created_at,jobsite_id",
    (q) => withCompanyAndWindow(q as RowFilter)
  );

  if (!correctiveLoad.ok) {
    if (correctiveLoad.missing) {
      missingTables.push("company_corrective_actions");
      engine.push(
        yellowEngine(
          "Corrective actions (observations)",
          "Data source is not connected yet (table missing or not exposed to this role)."
        )
      );
    } else {
      engine.push(
        yellowEngine("Corrective actions (observations)", correctiveLoad.message ?? "Query failed.", "/field-id-exchange")
      );
    }
  } else {
    engine.push(greenEngine("Corrective actions (observations)", "Loaded corrective action / observation rows."));
  }

  const incidentsLoad = await loadTableRows<{
    id: string;
    category?: string | null;
    severity?: string | null;
    status?: string | null;
    created_at?: string | null;
    jobsite_id?: string | null;
  }>(supabase, "company_incidents", "id,category,severity,status,created_at,jobsite_id", (q) =>
    withCompanyAndWindow(q as RowFilter)
  );

  if (!incidentsLoad.ok) {
    if (incidentsLoad.missing) {
      missingTables.push("company_incidents");
      engine.push(yellowEngine("Incidents", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("Incidents", incidentsLoad.message ?? "Query failed.", "/incidents"));
    }
  } else {
    engine.push(greenEngine("Incidents", "Loaded incident and near-miss records."));
  }

  const permitsLoad = await loadTableRows<{
    id: string;
    permit_type?: string | null;
    status?: string | null;
    due_at?: string | null;
    created_at?: string | null;
    jobsite_id?: string | null;
  }>(supabase, "company_permits", "id,permit_type,status,due_at,created_at,jobsite_id", (q) =>
    withCompanyAndWindow(q as RowFilter)
  );

  if (!permitsLoad.ok) {
    if (permitsLoad.missing) {
      missingTables.push("company_permits");
      engine.push(yellowEngine("Permits", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("Permits", permitsLoad.message ?? "Query failed.", "/permits"));
    }
  } else {
    engine.push(greenEngine("Permits", "Loaded permit rows."));
  }

  const jsasLoad = await loadTableRows<{ id: string; status?: string | null; created_at?: string | null }>(
    supabase,
    "company_jsas",
    "id,status,created_at",
    (q) => withCompanyAndWindow(q as RowFilter)
  );

  if (!jsasLoad.ok) {
    if (jsasLoad.missing) {
      missingTables.push("company_jsas");
      engine.push(yellowEngine("JSAs (daily plans)", "Data source is not connected yet (JSAs may still be syncing)."));
    } else {
      engine.push(yellowEngine("JSAs (daily plans)", jsasLoad.message ?? "Query failed."));
    }
  } else {
    engine.push(greenEngine("JSAs (daily plans)", "Loaded JSA / daily activity plan headers."));
  }

  const jsaActivitiesLoad = await loadTableRows<{
    id: string;
    status?: string | null;
    created_at?: string | null;
    work_date?: string | null;
  }>(supabase, "company_jsa_activities", "id,status,created_at,work_date", (q) =>
    withCompanyAndWindow(q as RowFilter)
  );

  if (!jsaActivitiesLoad.ok) {
    if (jsaActivitiesLoad.missing) {
      missingTables.push("company_jsa_activities");
      engine.push(yellowEngine("JSA activities", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("JSA activities", jsaActivitiesLoad.message ?? "Query failed."));
    }
  } else {
    engine.push(greenEngine("JSA activities", "Loaded JSA activity rows."));
  }

  const sorLoad = await loadTableRows<{ id: string; created_at?: string | null }>(
    supabase,
    "company_sor_records",
    "id,created_at",
    (q) => {
      const r = q as RowFilter;
      return r.eq("company_id", companyId).eq("is_deleted", false).gte("created_at", startIso).lte("created_at", endIso);
    }
  );

  if (!sorLoad.ok) {
    if (sorLoad.missing) {
      missingTables.push("company_sor_records");
      engine.push(yellowEngine("SOR records", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("SOR records", sorLoad.message ?? "Query failed."));
    }
  } else {
    engine.push(greenEngine("SOR records", "Loaded safety observation report rows."));
  }

  const contractorsLoad = await loadTableRows<{ id: string; name?: string | null; active?: boolean | null }>(
    supabase,
    "company_contractors",
    "id,name,active",
    (q) => (q as RowFilter).eq("company_id", companyId)
  );

  if (!contractorsLoad.ok) {
    if (contractorsLoad.missing) {
      missingTables.push("company_contractors");
      engine.push(yellowEngine("Contractors", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("Contractors", contractorsLoad.message ?? "Query failed.", "/company-contractors"));
    }
  } else {
    engine.push(greenEngine("Contractors", "Loaded contractor directory rows.", "/company-contractors"));
  }

  const trainingReqLoad = await loadTableRows<{ id: string }>(supabase, "company_training_requirements", "id", (q) =>
    (q as RowFilter).eq("company_id", companyId)
  );

  if (!trainingReqLoad.ok) {
    if (trainingReqLoad.missing) {
      missingTables.push("company_training_requirements");
      engine.push(yellowEngine("Training requirements", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("Training requirements", trainingReqLoad.message ?? "Query failed.", "/training-matrix"));
    }
  } else {
    engine.push(greenEngine("Training requirements", "Loaded training requirement definitions.", "/training-matrix"));
  }

  const documentsLoad = await loadTableRows<{
    id: string;
    status?: string | null;
    draft_file_path?: string | null;
    final_file_path?: string | null;
    created_at?: string | null;
    company_id?: string | null;
  }>(supabase, "documents", "id,status,draft_file_path,final_file_path,created_at,company_id", (q) => {
    const r = q as RowFilter;
    return r.eq("company_id", companyId).gte("created_at", startIso).lte("created_at", endIso);
  });

  if (!documentsLoad.ok) {
    if (documentsLoad.missing) {
      missingTables.push("documents");
      engine.push(yellowEngine("Documents", "Data source is not connected yet."));
    } else {
      engine.push(yellowEngine("Documents", documentsLoad.message ?? "Query failed.", "/library"));
    }
  } else {
    engine.push(greenEngine("Documents", "Loaded document rows for readiness.", "/library"));
  }

  /** Storage probe (RLS may still deny listing — treat as yellow, not a crash). */
  try {
    const { error: stErr } = await supabase.storage.from("documents").list("", { limit: 1 });
    if (stErr) {
      engine.push(yellowEngine("Document storage bucket", stErr.message || "Could not list bucket `documents`.", "/library"));
    } else {
      engine.push(greenEngine("Document storage bucket", "`documents` bucket responded to a minimal list."));
    }
  } catch (e) {
    engine.push(
      yellowEngine("Document storage bucket", e instanceof Error ? e.message : "Storage probe failed.", "/library")
    );
  }

  engine.push(
    greenEngine(
      "Dashboard data service",
      "Overview aggregation completed without throwing; missing modules are flagged above."
    )
  );

  engine.push(
    yellowEngine(
      "Document export & AI review routes",
      "HTTP reachability of internal routes is not probed here to avoid self-fetch coupling. Use monitoring or manual checks for `/api/...` export and AI review endpoints."
    )
  );

  let correctiveRows = correctiveLoad.ok ? correctiveLoad.data : [];
  let incidentRows = incidentsLoad.ok ? incidentsLoad.data : [];
  if (riskLevel !== "all") {
    correctiveRows = correctiveRows.filter((row) => matchesRiskSeverity(row.severity, riskLevel));
    incidentRows = incidentRows.filter((row) => matchesRiskSeverity(row.severity, riskLevel));
  }
  const permitRows = permitsLoad.ok ? permitsLoad.data : [];
  const jsaRows = jsasLoad.ok ? jsasLoad.data : [];
  const jsaActRows = jsaActivitiesLoad.ok ? jsaActivitiesLoad.data : [];
  const sorRows = sorLoad.ok ? sorLoad.data : [];
  const contractorRows = (contractorsLoad.ok ? contractorsLoad.data : []).filter((c) => {
    if (c.active === false) return false;
    if (!contractorId) return true;
    return c.id === contractorId;
  });
  const trainingReqCount = trainingReqLoad.ok ? trainingReqLoad.data.length : 0;
  const documentRows = documentsLoad.ok ? documentsLoad.data : [];

  const now = Date.now();
  let open = 0;
  let overdue = 0;
  let closed = 0;
  const closureDays: number[] = [];

  for (const row of correctiveRows) {
    if (isClosedCorrective(row.status)) {
      closed += 1;
      if (row.closed_at && row.created_at) {
        const c = (new Date(row.closed_at).getTime() - new Date(row.created_at).getTime()) / 86400000;
        if (Number.isFinite(c) && c >= 0) closureDays.push(c);
      }
    } else if (isActiveCorrective(row.status)) {
      open += 1;
      if (row.due_at && new Date(row.due_at).getTime() < now) overdue += 1;
    }
  }

  const correctiveActionStatus: CorrectiveActionStatus = {
    open,
    overdue,
    closed,
    averageDaysToClose:
      closureDays.length > 0
        ? Number((closureDays.reduce((a, b) => a + b, 0) / closureDays.length).toFixed(1))
        : null,
  };

  let openHighRiskItems = 0;
  for (const row of correctiveRows) {
    if (isActiveCorrective(row.status) && isHighRiskObservation(row)) openHighRiskItems += 1;
  }

  let incidentCount = 0;
  let nearMissCount = 0;
  for (const row of incidentRows) {
    const cat = (row.category ?? "").toLowerCase();
    if (cat === "near_miss") nearMissCount += 1;
    else if (cat === "incident") incidentCount += 1;
    else if (cat) incidentCount += 1;
  }

  const permitBuckets = new Map<string, { required: number; completed: number; missing: number }>();
  for (const p of permitRows) {
    const type = (p.permit_type ?? "general").trim() || "general";
    const b = permitBuckets.get(type) ?? { required: 0, completed: 0, missing: 0 };
    b.required += 1;
    const st = (p.status ?? "").toLowerCase();
    if (st === "closed") b.completed += 1;
    else if (st === "expired" || (p.due_at && new Date(p.due_at).getTime() < now && st !== "closed")) {
      b.missing += 1;
    }
    permitBuckets.set(type, b);
  }

  const permitCompliance: PermitCompliance[] = [...permitBuckets.entries()].map(([permitType, b]) => {
    const complianceRate = b.required > 0 ? clampScore((100 * b.completed) / b.required) : 0;
    return {
      permitType,
      required: b.required,
      completed: b.completed,
      missing: b.missing,
      complianceRate,
    };
  });

  const totalPermits = permitRows.length;
  const closedPermits = permitRows.filter((p) => (p.status ?? "").toLowerCase() === "closed").length;
  const permitComplianceRate = totalPermits > 0 ? clampScore((100 * closedPermits) / totalPermits) : 0;

  const jsaCompleted = jsaRows.filter((r) => (r.status ?? "").toLowerCase() === "closed").length;
  const jsaTotal = jsaRows.length;
  const actCompleted = jsaActRows.filter((r) => (r.status ?? "").toLowerCase() === "completed").length;
  const actTotal = jsaActRows.length;
  const denom = jsaTotal + actTotal;
  const jsaCompletionRate = denom > 0 ? clampScore((100 * (jsaCompleted + actCompleted)) / denom) : 0;

  const docReadiness = emptyDocumentReadiness();
  for (const d of documentRows) {
    const norm = normalizeDocumentStatus(d.status, Boolean(d.final_file_path));
    if (norm === "draft") docReadiness.draft += 1;
    else if (norm === "submitted") docReadiness.underReview += 1;
    else if (norm === "approved") docReadiness.approved += 1;
    else if (norm === "archived") docReadiness.rejected += 1;
    else docReadiness.submitted += 1;
  }
  const docTotal =
    docReadiness.draft +
    docReadiness.submitted +
    docReadiness.underReview +
    docReadiness.approved +
    docReadiness.rejected;
  const documentReadinessRate = docTotal > 0 ? clampScore((100 * docReadiness.approved) / docTotal) : 0;

  /** Proxy until per-user certification coverage is wired: more defined requirements implies more coverage work. */
  const trainingReadinessRate =
    trainingReqCount === 0 ? 100 : clampScore(Math.max(40, 100 - Math.min(45, trainingReqCount * 3)));

  const missingPermits = permitRows.filter((p) => {
    const st = (p.status ?? "").toLowerCase();
    return st !== "closed" && p.due_at && new Date(p.due_at).getTime() < now;
  }).length;

  let score = 100;
  score -= Math.min(25, overdue * 3);
  score -= Math.min(20, openHighRiskItems * 4);
  score -= Math.min(20, (incidentCount + nearMissCount) * 2);
  score -= Math.min(15, missingPermits * 2);
  score -= Math.min(15, trainingReqCount > 0 && trainingReadinessRate < 85 ? 12 : 0);
  score -= Math.min(10, documentReadinessRate < 70 && docTotal > 0 ? 10 : 0);
  score -= Math.min(8, Math.floor(sorRows.length / 25));
  const safetyHealthScore = clampScore(score);

  const summary: DashboardSummary = {
    safetyHealthScore,
    openHighRiskItems,
    overdueCorrectiveActions: overdue,
    incidentCount,
    nearMissCount,
    permitComplianceRate,
    jsaCompletionRate,
    trainingReadinessRate,
    documentReadinessRate,
  };

  const obsBuckets = buildTrendBuckets(start, end, useWeek);
  for (const row of correctiveRows) {
    if (!row.created_at) continue;
    const dt = new Date(row.created_at);
    const key = bucketForDate(dt, useWeek);
    if (!obsBuckets.has(key)) obsBuckets.set(key, { positive: 0, negative: 0, incidents: 0, nearMisses: 0 });
    const b = obsBuckets.get(key)!;
    const ot = (row.observation_type ?? "").toLowerCase();
    if (ot === "positive") b.positive += 1;
    else b.negative += 1;
  }

  const observationTrend: TrendPoint[] = [];
  for (const [date, b] of [...obsBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (b.positive > 0) observationTrend.push({ date, value: b.positive, label: "Positive" });
    if (b.negative > 0) observationTrend.push({ date, value: b.negative, label: "Negative / other" });
  }

  const incBuckets = buildTrendBuckets(start, end, useWeek);
  for (const row of incidentRows) {
    if (!row.created_at) continue;
    const dt = new Date(row.created_at);
    const key = bucketForDate(dt, useWeek);
    if (!incBuckets.has(key)) incBuckets.set(key, { positive: 0, negative: 0, incidents: 0, nearMisses: 0 });
    const b = incBuckets.get(key)!;
    const cat = (row.category ?? "").toLowerCase();
    if (cat === "near_miss") b.nearMisses += 1;
    else b.incidents += 1;
  }

  const incidentTrend: TrendPoint[] = [];
  for (const [date, b] of [...incBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (b.incidents > 0) incidentTrend.push({ date, value: b.incidents, label: "Incidents" });
    if (b.nearMisses > 0) incidentTrend.push({ date, value: b.nearMisses, label: "Near misses" });
  }

  const riskMap = new Map<string, { count: number; maxSev: number }>();
  const bump = (key: string, sev: string | null | undefined) => {
    const cur = riskMap.get(key) ?? { count: 0, maxSev: 0 };
    cur.count += 1;
    cur.maxSev = Math.max(cur.maxSev, severityRank(sev));
    riskMap.set(key, cur);
  };
  for (const row of correctiveRows) {
    bump((row.category ?? "uncategorized").toLowerCase(), row.severity);
  }
  for (const row of incidentRows) {
    bump((row.category ?? "incident").toLowerCase(), row.severity);
  }

  const topRisks: RiskCategory[] = [...riskMap.entries()]
    .map(([name, v]) => ({
      name: name.replace(/_/g, " "),
      count: v.count,
      severity: toRiskSeverityBand(
        v.maxSev >= 4 ? "critical" : v.maxSev >= 3 ? "high" : v.maxSev >= 2 ? "medium" : "low"
      ),
      trend: "flat" as TrendDirection,
      recommendation:
        v.maxSev >= 3
          ? "Escalate field verification and short-loop management review for this theme."
          : "Track leading indicators weekly and confirm controls are actually in use.",
    }))
    .sort((a, b) => b.count - a.count || bandRank(b.severity) - bandRank(a.severity))
    .slice(0, 12);

  type ContractorDocRow = {
    contractor_id: string;
    verification_status?: string | null;
    expires_on?: string | null;
    doc_type?: string | null;
  };

  const contractorDocsLoad = await loadTableRows<ContractorDocRow>(supabase, "company_contractor_documents", "contractor_id,verification_status,expires_on,doc_type", (q) =>
    (q as RowFilter).eq("company_id", companyId)
  );

  if (!contractorDocsLoad.ok && contractorDocsLoad.missing) {
    missingTables.push("company_contractor_documents");
    engine.push(yellowEngine("Contractor documents", "Data source is not connected yet."));
  } else if (!contractorDocsLoad.ok) {
    engine.push(yellowEngine("Contractor documents", contractorDocsLoad.message ?? "Query failed."));
  } else {
    engine.push(greenEngine("Contractor documents", "Loaded contractor compliance documents."));
  }

  const contractorEvalLoad = await loadTableRows<{
    contractor_id: string;
    score?: number | null;
    evaluated_at?: string | null;
  }>(supabase, "company_contractor_evaluations", "contractor_id,score,evaluated_at", (q) =>
    (q as RowFilter).eq("company_id", companyId)
  );

  if (!contractorEvalLoad.ok && contractorEvalLoad.missing) {
    missingTables.push("company_contractor_evaluations");
    engine.push(yellowEngine("Contractor evaluations", "Data source is not connected yet."));
  } else if (!contractorEvalLoad.ok) {
    engine.push(yellowEngine("Contractor evaluations", contractorEvalLoad.message ?? "Query failed."));
  } else {
    engine.push(greenEngine("Contractor evaluations", "Loaded contractor evaluation history."));
  }

  const docsByContractor = new Map<string, ContractorDocRow[]>();
  if (contractorDocsLoad.ok) {
    for (const d of contractorDocsLoad.data) {
      const list = docsByContractor.get(d.contractor_id) ?? [];
      list.push(d);
      docsByContractor.set(d.contractor_id, list);
    }
  }

  const latestEval = new Map<string, number>();
  if (contractorEvalLoad.ok) {
    const sorted = [...contractorEvalLoad.data].sort(
      (a, b) =>
        new Date(String(b.evaluated_at ?? 0)).getTime() - new Date(String(a.evaluated_at ?? 0)).getTime()
    );
    for (const e of sorted) {
      if (!latestEval.has(e.contractor_id) && typeof e.score === "number" && Number.isFinite(e.score)) {
        latestEval.set(e.contractor_id, e.score);
      }
    }
  }

  const contractorRiskScores: ContractorRiskScore[] = contractorRows.map((c) => {
    const docs = docsByContractor.get(c.id) ?? [];
    const openItems = docs.filter((d) => (d.verification_status ?? "").toLowerCase() === "pending").length;
    const overdueItems = docs.filter((d) => {
      if (!d.expires_on) return false;
      return new Date(d.expires_on).getTime() < now && (d.verification_status ?? "").toLowerCase() !== "approved";
    }).length;
    const permitLike = docs.filter((d) => {
      const t = (d.doc_type ?? "").toLowerCase();
      return t === "coi" || t === "license" || t === "wcb";
    });
    const permitApproved = permitLike.filter((d) => (d.verification_status ?? "").toLowerCase() === "approved").length;
    const permitCompliance = permitLike.length > 0 ? clampScore((100 * permitApproved) / permitLike.length) : 100;
    const approvedAll = docs.filter((d) => (d.verification_status ?? "").toLowerCase() === "approved").length;
    const trainingCompliance = docs.length > 0 ? clampScore((100 * approvedAll) / docs.length) : 100;

    const rawEval = latestEval.get(c.id);
    let base = 35;
    if (rawEval != null && Number.isFinite(rawEval)) {
      base = rawEval <= 10 ? rawEval * 10 : clampScore(rawEval);
    }
    const riskScore = clampScore(
      Math.min(
        100,
        base + openItems * 4 + overdueItems * 6 + (100 - permitCompliance) * 0.2 + (100 - trainingCompliance) * 0.2
      )
    );

    return {
      contractorName: (c.name ?? "Unnamed contractor").trim() || "Unnamed contractor",
      riskScore,
      openItems,
      overdueItems,
      observations: 0,
      incidents: 0,
      trainingCompliance,
      permitCompliance,
    };
  });

  const overdueCorrectiveSamples = correctiveRows
    .filter((row) => {
      if (!isActiveCorrective(row.status)) return false;
      if (!row.due_at) return false;
      return new Date(row.due_at).getTime() < now;
    })
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      category: row.category,
      due_at: row.due_at,
      observation_type: row.observation_type,
    }));

  const observationCategoryMap = new Map<string, number>();
  for (const row of correctiveRows) {
    const k = (row.category ?? "uncategorized").trim() || "uncategorized";
    observationCategoryMap.set(k, (observationCategoryMap.get(k) ?? 0) + 1);
  }
  const observationCategoryTop = [...observationCategoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name: name.replace(/_/g, " "), count }));

  let expiredCredentials = 0;
  let expiringSoonCredentials = 0;
  const soonMs = now + 30 * 86400000;
  if (contractorDocsLoad.ok) {
    for (const d of contractorDocsLoad.data) {
      if (!d.expires_on) continue;
      const t = new Date(d.expires_on).getTime();
      if (!Number.isFinite(t)) continue;
      if (t < now) expiredCredentials += 1;
      else if (t <= soonMs) expiringSoonCredentials += 1;
    }
  }
  const credentialGaps = { expiredCredentials, expiringSoonCredentials };

  const overviewForInsights: DashboardOverview = {
    summary,
    incidentTrend,
    observationTrend,
    correctiveActionStatus,
    topRisks,
    contractorRiskScores,
    permitCompliance,
    documentReadiness: docReadiness,
    engineHealth: engine,
    aiInsights: [],
    overdueCorrectiveSamples,
    observationCategoryTop,
    credentialGaps,
  };
  const aiInsights = rulesInsightsToAiInsights(
    generateDashboardInsights(overviewForInsights, {
      missingTables,
      sorCountInWindow: sorRows.length,
    })
  );

  return {
    summary,
    incidentTrend,
    observationTrend,
    correctiveActionStatus,
    topRisks,
    contractorRiskScores,
    permitCompliance,
    documentReadiness: docReadiness,
    engineHealth: engine,
    aiInsights,
    overdueCorrectiveSamples,
    observationCategoryTop,
    credentialGaps,
  };
}
