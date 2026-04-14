import { NextResponse } from "next/server";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ conflicts: [] });
  }

  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;

  let query = resolved.supabase
    .from("company_conflict_pairs")
    .select("id, conflict_code, conflict_type, severity, status, rationale, recommended_controls, overlap_scope, updated_at")
    .eq("company_id", resolved.companyScope.companyId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (jobsiteId) {
    query = query.eq("jobsite_id", jobsiteId);
  }

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load live conflicts." }, { status: 500 });
  }

  return NextResponse.json({ conflicts: result.data ?? [] });
}
