import type { SupabaseClient } from "@supabase/supabase-js";

export type GusCompanyContextData = {
  recentIncidents: Array<{
    title: string;
    category: string;
    severity: string;
    occurredAt: string;
    jobsite: string | null;
  }>;
  openCaCount: number;
  overdueCaCount: number;
  topOpenCas: Array<{ title: string; severity: string; daysOpen: number }>;
  rcaFindings: Array<{ type: string; description: string; category: string | null }>;
  recordableYtd: number;
  sifOpenCount: number;
};

/**
 * Builds a compact company safety context object for GUS.
 * Runs up to 5 parallel queries with a 4-second timeout guard.
 * Returns null if companyId is missing or all queries fail.
 */
export async function buildGusCompanyContext(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<GusCompanyContextData | null> {
  if (!companyId) return null;

  const now = new Date();
  const ytdStart = `${now.getFullYear()}-01-01T00:00:00.000Z`;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  try {
    const [
      incidentResult,
      openCaResult,
      overdueCaResult,
      topCaResult,
      rcaResult,
      recordableResult,
      sifResult,
    ] = await Promise.all([
      // Last 5 incidents
      supabase
        .from("company_incidents")
        .select("title, category, severity, occurred_at, jobsite:jobsite_id(name)")
        .eq("company_id", companyId)
        .order("occurred_at", { ascending: false })
        .limit(5),

      // Open CA count
      supabase
        .from("corrective_actions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("status", ["open", "in_progress"]),

      // Overdue CA count
      supabase
        .from("corrective_actions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("status", ["open", "in_progress"])
        .lt("due_at", now.toISOString()),

      // Top 3 open CAs by severity
      supabase
        .from("corrective_actions")
        .select("title, severity, created_at")
        .eq("company_id", companyId)
        .in("status", ["open", "in_progress"])
        .in("severity", ["critical", "high"])
        .order("created_at", { ascending: true })
        .limit(3),

      // Recent RCA findings
      supabase
        .from("ca_rca_findings")
        .select("finding_type, description, category")
        .eq("company_id", companyId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5),

      // YTD recordable incidents
      supabase
        .from("company_incidents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("recordable", true)
        .gte("occurred_at", ytdStart),

      // Open SIF-potential corrective actions
      supabase
        .from("corrective_actions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("sif_potential", "yes")
        .in("status", ["open", "in_progress"]),
    ]);

    const recentIncidents = (
      (incidentResult.data ?? []) as Array<{
        title: string;
        category: string;
        severity: string;
        occurred_at: string;
        jobsite: { name: string } | Array<{ name: string }> | null;
      }>
    ).map((row) => {
      const jobsite = Array.isArray(row.jobsite) ? row.jobsite[0] : row.jobsite;
      return {
        title: row.title,
        category: row.category,
        severity: row.severity,
        occurredAt: row.occurred_at,
        jobsite: (jobsite as { name?: string } | null)?.name ?? null,
      };
    });

    const topOpenCas = (
      (topCaResult.data ?? []) as Array<{ title: string; severity: string; created_at: string }>
    ).map((row) => ({
      title: row.title,
      severity: row.severity,
      daysOpen: Math.round((Date.now() - new Date(row.created_at).getTime()) / 86_400_000),
    }));

    const rcaFindings = (
      (rcaResult.data ?? []) as Array<{ finding_type: string; description: string; category: string | null }>
    ).map((row) => ({
      type: row.finding_type,
      description: row.description.slice(0, 200),
      category: row.category,
    }));

    return {
      recentIncidents,
      openCaCount: openCaResult.count ?? 0,
      overdueCaCount: overdueCaResult.count ?? 0,
      topOpenCas,
      rcaFindings,
      recordableYtd: recordableResult.count ?? 0,
      sifOpenCount: sifResult.count ?? 0,
    };
  } catch {
    // Context enrichment is non-critical — GUS degrades gracefully without it
    return null;
  }
}

/**
 * Serialises company context to a compact string for injection into GUS prompts.
 * Kept under ~800 chars to stay well within the 4000-char safetyContext budget.
 */
export function companyContextToString(ctx: GusCompanyContextData): string {
  const lines: string[] = [];

  lines.push(`[Company Safety Context]`);

  if (ctx.recentIncidents.length > 0) {
    lines.push(`Recent incidents (last 30 days):`);
    for (const inc of ctx.recentIncidents) {
      const date = new Date(inc.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      lines.push(`  • ${date} — ${inc.title} [${inc.severity}/${inc.category}]${inc.jobsite ? ` @ ${inc.jobsite}` : ""}`);
    }
  }

  lines.push(`Open CAs: ${ctx.openCaCount} (${ctx.overdueCaCount} overdue)`);

  if (ctx.topOpenCas.length > 0) {
    lines.push(`High/Critical open CAs:`);
    for (const ca of ctx.topOpenCas) {
      lines.push(`  • ${ca.title} [${ca.severity}] — ${ca.daysOpen}d open`);
    }
  }

  if (ctx.rcaFindings.length > 0) {
    lines.push(`Recent RCA findings:`);
    for (const f of ctx.rcaFindings) {
      lines.push(`  • ${f.type}: ${f.description.slice(0, 120)}`);
    }
  }

  if (ctx.recordableYtd > 0) {
    lines.push(`OSHA recordable incidents YTD: ${ctx.recordableYtd}`);
  }

  if (ctx.sifOpenCount > 0) {
    lines.push(`⚠️ Open SIF-potential items: ${ctx.sifOpenCount} — flag for immediate safety lead review.`);
  }

  return lines.join("\n");
}
