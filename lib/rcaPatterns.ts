import { requestAiResponsesText } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PatternMatch = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  jobsite_name: string | null;
  created_at: string;
  has_rca: boolean;
};

export type RepeatPatternResult = {
  patternFound: boolean;
  /** Total matches in the look-back window (excluding current CA) */
  totalMatches: number;
  /** Matches at the same jobsite */
  sameJobsiteCount: number;
  /** Look-back window in days used for the query */
  windowDays: number;
  /** Up to 5 most recent matching CAs */
  recentMatches: PatternMatch[];
  /** AI-generated 1–2 sentence insight, or null if none generated */
  insight: string | null;
  /** Category that matched */
  category: string;
};

type RawCaRow = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
  rca_session_id: string | null;
  jobsite?: { name?: string } | null;
};

/**
 * Detects repeat incident patterns for a given corrective action.
 *
 * Looks back `windowDays` days for other CAs in the same company with the
 * same category. Flags the result if 2+ matches are found. Optionally widens
 * to 365 days if the 90-day window returns nothing.
 *
 * Always generates an AI insight when a pattern is found.
 */
export async function detectRepeatPatterns(params: {
  supabase: SupabaseClient;
  companyId: string;
  actionId: string;
  category: string;
  severity: string;
  jobsiteId: string | null;
  caTitle: string;
  windowDays?: number;
  generateInsight?: boolean;
}): Promise<RepeatPatternResult> {
  const {
    supabase,
    companyId,
    actionId,
    category,
    severity,
    jobsiteId,
    caTitle,
    windowDays = 90,
    generateInsight = true,
  } = params;

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("company_corrective_actions")
    .select(`
      id, title, category, severity, status, created_at, rca_session_id,
      jobsite:jobsite_id ( name )
    `)
    .eq("company_id", companyId)
    .eq("category", category)
    .eq("is_deleted", false)
    .neq("id", actionId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50);

  const matches = (rows ?? []) as RawCaRow[];

  // If the tight window found nothing, widen to a year for context
  let wideMatches: RawCaRow[] = [];
  let effectiveWindow = windowDays;
  if (matches.length === 0 && windowDays < 365) {
    effectiveWindow = 365;
    const wideCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: wideRows } = await supabase
      .from("company_corrective_actions")
      .select(`
        id, title, category, severity, status, created_at, rca_session_id,
        jobsite:jobsite_id ( name )
      `)
      .eq("company_id", companyId)
      .eq("category", category)
      .eq("is_deleted", false)
      .neq("id", actionId)
      .gte("created_at", wideCutoff)
      .order("created_at", { ascending: false })
      .limit(20);
    wideMatches = (wideRows ?? []) as RawCaRow[];
  }

  const allMatches = matches.length > 0 ? matches : wideMatches;
  const totalMatches = allMatches.length;

  const sameJobsiteCount = jobsiteId
    ? 0 // jobsite matching done via join — simplified: count all for now
    : 0;

  const recentMatches: PatternMatch[] = allMatches.slice(0, 5).map((row) => {
    const jobsite = Array.isArray(row.jobsite) ? row.jobsite[0] : row.jobsite;
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      severity: row.severity,
      status: row.status,
      jobsite_name: (jobsite as { name?: string } | null)?.name ?? null,
      created_at: row.created_at,
      has_rca: Boolean(row.rca_session_id),
    };
  });

  const patternFound = totalMatches >= 2;

  let insight: string | null = null;

  if (patternFound && generateInsight && totalMatches > 0) {
    const matchSummary = recentMatches
      .map(
        (m, i) =>
          `${i + 1}. "${m.title}" — ${m.severity} severity, status: ${m.status}${m.jobsite_name ? `, at ${m.jobsite_name}` : ""}, recorded ${new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      )
      .join("\n");

    const insightPrompt = [
      "You are a safety professional reviewing repeat incident patterns.",
      "Write 1–2 concise sentences noting the pattern and what it suggests for this investigation.",
      "Be direct and actionable. Do not use bullet points. Do not repeat the counts verbatim.",
      "",
      `Current incident: "${caTitle}" — category: ${category.replace(/_/g, " ")}, severity: ${severity}`,
      `Similar incidents in the last ${effectiveWindow} days (${totalMatches} total):`,
      matchSummary,
    ].join("\n");

    const model =
      process.env.RCA_AI_MODEL?.trim() ||
      process.env.COMPANY_AI_MODEL?.trim() ||
      resolveCompanyAiDefaultModel("gpt-4o-mini");

    try {
      const res = await requestAiResponsesText({
        model,
        input: insightPrompt,
        surface: "corrective-actions.rca-pattern-insight",
        maxAttempts: 2,
      });
      insight = res.text?.trim() || null;
    } catch {
      insight = null;
    }
  }

  return {
    patternFound,
    totalMatches,
    sameJobsiteCount,
    windowDays: effectiveWindow,
    recentMatches,
    insight,
    category,
  };
}
