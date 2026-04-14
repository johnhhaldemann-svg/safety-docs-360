import { NextResponse } from "next/server";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { loadMergedTradeLibrary } from "@/lib/safety-intelligence/library";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ trades: [] });
  }

  const trades = await loadMergedTradeLibrary(resolved.supabase, resolved.companyScope.companyId);
  return NextResponse.json({ trades });
}

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_manage_daps", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(body?.code ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const name = String(body?.name ?? "").trim();
  if (!code || !name) {
    return NextResponse.json({ error: "code and name are required." }, { status: 400 });
  }

  const result = await resolved.supabase
    .from("company_trades")
    .insert({
      company_id: resolved.companyScope.companyId,
      code,
      name,
      description: String(body?.description ?? "").trim() || null,
      hazard_families: Array.isArray(body?.hazardFamilies) ? body?.hazardFamilies : [],
      required_controls: Array.isArray(body?.requiredControls) ? body?.requiredControls : [],
      permit_triggers: Array.isArray(body?.permitTriggers) ? body?.permitTriggers : [],
      training_requirements: Array.isArray(body?.trainingRequirements) ? body?.trainingRequirements : [],
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
      created_by: resolved.user.id,
      updated_by: resolved.user.id,
    })
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to save company trade." }, { status: 500 });
  }

  return NextResponse.json({ trade: result.data });
}
