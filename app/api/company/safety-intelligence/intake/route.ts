import { NextResponse } from "next/server";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { buildSmartSafetyAiReviewContext } from "@/lib/safety-intelligence/engine/orchestrator";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { runSafetyIntakePipeline } from "@/lib/safety-intelligence/ingestion/service";
import { persistBucketRun } from "@/lib/safety-intelligence/repository";
import { parseRawTaskInput } from "@/lib/safety-intelligence/validation/intake";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";
import type {
  JsonObject,
  NormalizedSafetyIntakeRecord,
  RawTaskInput,
  SafetyIngestionSourceType,
} from "@/types/safety-intelligence";

export const runtime = "nodejs";

function hasRawTaskShape(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("taskTitle" in value || "sourceModule" in value)
  );
}

function sourceModuleFromIngestion(sourceType: SafetyIngestionSourceType): RawTaskInput["sourceModule"] {
  if (sourceType === "jsa") return "company_jsa_activity";
  if (sourceType === "permit") return "company_permit";
  if (sourceType === "incident_report") return "company_incident";
  return "manual";
}

function rawInputFromNormalizedRecord(record: NormalizedSafetyIntakeRecord, metadata: JsonObject): RawTaskInput {
  return {
    companyId: record.companyId,
    jobsiteId: record.jobsiteId ?? null,
    sourceModule: sourceModuleFromIngestion(record.sourceType),
    sourceId: record.sourceRecordId ?? null,
    tradeCode: record.trade ?? null,
    taskCode: record.category ?? null,
    taskTitle: record.title,
    description: record.description ?? record.summary ?? null,
    hazardCategories: record.category ? [record.category] : [],
    startsAt: record.eventAt ?? record.sourceCreatedAt,
    endsAt: record.validTo ?? null,
    metadata: {
      ...metadata,
      sourceType: record.sourceType,
      severity: record.severity,
      reportedAt: record.reportedAt ?? null,
      dueAt: record.dueAt ?? null,
      validFrom: record.validFrom ?? null,
      payload: record.payload,
    },
  };
}

async function persistSmartSafetyIntake(params: {
  resolved: SafetyIntelligenceAuthorized;
  input: RawTaskInput;
  auditLogId?: string | null;
  bucketId?: string | null;
}) {
  const riskMemory = await buildRiskMemoryStructuredContext(
    params.resolved.supabase,
    params.input.companyId,
    {
      jobsiteId: params.input.jobsiteId ?? null,
      days: 90,
    }
  );
  const bucket = buildBucketedWorkItem(params.input);
  const setup = await buildSmartSafetyAiReviewContext({
    input: params.input,
    bucket,
    riskMemorySummary: (riskMemory ?? null) as JsonObject | null,
    supabase: params.resolved.supabase,
  });
  const bucketRunId = await persistBucketRun(
    params.resolved.supabase,
    params.input,
    setup.bucket,
    setup.rules,
    setup.conflicts,
    params.resolved.user.id
  );

  return {
    auditLogId: params.auditLogId ?? null,
    bucketId: params.bucketId ?? null,
    bucketRunId,
    bucket: setup.bucket,
    rules: setup.rules,
    conflicts: setup.conflicts,
    smartSafetyProvenance: {
      ...(setup.reviewContext.smartSafetyProvenance ?? {
        version: "1.0.0",
        stages: setup.stages,
        inputHash: "",
      }),
      bucketRunId,
      auditLogId: params.auditLogId ?? null,
      bucketId: params.bucketId ?? null,
    },
  };
}

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
    const body = (await request.json()) as Record<string, unknown>;
    const candidate = (body.input ?? body) as unknown;
    if (hasRawTaskShape(candidate)) {
      const input = {
        ...parseRawTaskInput(candidate),
        companyId: resolved.companyScope.companyId,
      };
      const result = await persistSmartSafetyIntake({
        resolved,
        input,
      });
      return NextResponse.json({
        ...result,
        validationStatus: "accepted",
        removedCompanyTokens: [],
      });
    }

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

    if (!result.prepared.normalizedRecord) {
      return NextResponse.json(
        { error: "Accepted intake did not produce a normalized record." },
        { status: 500 }
      );
    }

    const input = rawInputFromNormalizedRecord(result.prepared.normalizedRecord, {
      auditLogId: result.auditLogId,
      bucketId: result.bucketId,
      removedCompanyTokens: result.prepared.removedCompanyTokens,
    });
    const smartSafety = await persistSmartSafetyIntake({
      resolved,
      input,
      auditLogId: result.auditLogId,
      bucketId: result.bucketId,
    });

    return NextResponse.json({
      ...smartSafety,
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
