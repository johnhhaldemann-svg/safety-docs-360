import { NextResponse } from "next/server";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { runSafetyIntakePipeline } from "@/lib/safety-intelligence/ingestion/service";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_manage_daps", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  const isDemoRequest =
    resolved.role === "sales_demo" ||
    (resolved.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    return NextResponse.json({
      bucketRunId: `demo-bucket-run-${Date.now()}`,
      bucket: {
        id: "demo-bucket-1",
        bucketCode: "steel_erection",
        confidence: 0.96,
      },
      rules: {
        permitTriggers: ["hot_work", "critical_lift"],
        trainingRequirements: ["rigging_certification", "fall_protection"],
      },
      conflicts: {
        hasConflict: true,
        severity: "high",
        items: [
          {
            code: "HOTWORK_FUEL_PROXIMITY",
            rationale: "Fuel storage and hot work are in the same temporary zone.",
          },
        ],
      },
    });
  }
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const result = await runSafetyIntakePipeline({
      supabase: resolved.supabase,
      body,
      companyId: resolved.companyScope.companyId,
      defaultCompanyName: resolved.companyScope.companyName,
      actorUserId: resolved.user.id,
    });

    if (result.prepared.validationStatus === "rejected") {
      return NextResponse.json(
        {
          auditLogId: result.auditLogId,
          validationStatus: result.prepared.validationStatus,
          validationErrors: result.prepared.validationErrors,
          removedCompanyTokens: result.prepared.removedCompanyTokens,
          sanitizedPayload: result.prepared.sanitizedPayload,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      auditLogId: result.auditLogId,
      bucketId: result.bucketId,
      validationStatus: result.prepared.validationStatus,
      removedCompanyTokens: result.prepared.removedCompanyTokens,
      normalizedRecord: result.prepared.normalizedRecord,
      sanitizedPayload: result.prepared.sanitizedPayload,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to intake safety record." },
      { status: 500 }
    );
  }
}
