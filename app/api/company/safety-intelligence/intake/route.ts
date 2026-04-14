import { NextResponse } from "next/server";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { runSafetyIntakePipeline } from "@/lib/safety-intelligence/ingestion/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_manage_daps", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
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
