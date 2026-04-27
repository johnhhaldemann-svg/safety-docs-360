import { NextResponse } from "next/server";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { runSafetyIntelligenceDocumentPipeline } from "@/lib/safety-intelligence/documents/pipeline";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { parseRawTaskInput } from "@/lib/safety-intelligence/validation/intake";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";
import type { JsonObject } from "@/types/safety-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  const isDemoRequest =
    resolved.role === "sales_demo" ||
    (resolved.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const url = new URL(request.url);
    const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
    const documents = [
      {
        id: "demo-generated-doc-1",
        document_type: "jsa",
        title: "North Tower Steel Pick - JSA Draft",
        status: "pending_review",
        generated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        jobsite_id: "demo-jobsite-1",
      },
      {
        id: "demo-generated-doc-2",
        document_type: "permit",
        title: "Hot Work Permit Package - East Core",
        status: "approved",
        generated_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        jobsite_id: "demo-jobsite-1",
      },
      {
        id: "demo-generated-doc-3",
        document_type: "pshsep",
        title: "Warehouse Retrofit - PSHSEP Revision B",
        status: "pending_review",
        generated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        jobsite_id: "demo-jobsite-2",
      },
      {
        id: "demo-generated-doc-4",
        document_type: "work_plan",
        title: "Night Shift Lift Window Work Plan",
        status: "draft",
        generated_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
        jobsite_id: "demo-jobsite-2",
      },
    ].filter((item) => !jobsiteId || item.jobsite_id === jobsiteId);
    return NextResponse.json({
      documents: documents.map(({ jobsite_id: _jobsiteId, ...item }) => item),
    });
  }
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ documents: [] });
  }

  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
  let query = resolved.supabase
    .from("company_generated_documents")
    .select("id, document_type, title, status, generated_at, created_at")
    .eq("company_id", resolved.companyScope.companyId)
    .order("generated_at", { ascending: false })
    .limit(20);
  if (jobsiteId) {
    query = query.eq("jobsite_id", jobsiteId);
  }

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load generated documents." }, { status: 500 });
  }

  return NextResponse.json({ documents: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  const isDemoRequest =
    resolved.role === "sales_demo" ||
    (resolved.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const documentType = String(body?.documentType ?? "jsa");
    return NextResponse.json({
      generatedDocumentId: `demo-generated-${Date.now()}`,
      bucketRunId: "demo-bucket-run-1",
      aiReviewId: "demo-ai-review-1",
      bucket: { id: "demo-bucket-1", bucketCode: "steel_erection", confidence: 0.96 },
      rules: { permitTriggers: ["hot_work", "critical_lift"] },
      conflicts: {
        hasConflict: true,
        severity: "high",
        items: [{ code: "CRANE_ELECTRICAL_OVERLAP", rationale: "Temporary power in swing radius." }],
      },
      document: {
        id: "demo-generated-doc-1",
        document_type: documentType,
        title: "Demo safety draft generated from Safety Intelligence",
        status: "pending_review",
        generated_at: new Date().toISOString(),
        sections: [
          {
            heading: "Scope",
            body: "Structural steel and erection package for active crane pick window.",
          },
          {
            heading: "Critical controls",
            body: "Exclusion zones, signal person, permit verification, and weather hold points.",
          },
          {
            heading: "Crew briefing",
            body: "Daily pre-task briefing with trade leads and toolbox acknowledgement sign-off.",
          },
        ],
      },
      risk: {
        summary: "High-risk overlap detected; maintain exclusion controls and permit sequencing before release.",
        exposures: ["line_of_fire", "fall_from_height"],
        missingControls: ["fuel-staging-fire-watch-tag"],
        trendPatterns: ["repeat_conflict_hot_work_staging"],
        riskScores: [{ scope: "task", score: 82, band: "high" }],
        forecastConflicts: ["Potential crane + energized overhead conflict in PM shift."],
        correctiveActions: ["Validate LOTO boundary before crane setup."],
      },
    });
  }
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseRawTaskInput(body.input ?? body);
    const documentType = String(body.documentType ?? "jsa") as Parameters<typeof runSafetyIntelligenceDocumentPipeline>[0]["documentType"];
    const riskMemory = await buildRiskMemoryStructuredContext(resolved.supabase, resolved.companyScope.companyId, {
      jobsiteId: input.jobsiteId ?? null,
      days: 90,
    });

    const pipeline = await runSafetyIntelligenceDocumentPipeline({
      supabase: resolved.supabase,
      actorUserId: resolved.user.id,
      input: { ...input, companyId: resolved.companyScope.companyId },
      documentType,
      riskMemorySummary: (riskMemory ?? null) as JsonObject | null,
    });

    return NextResponse.json(pipeline);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate document pipeline." },
      { status: 400 }
    );
  }
}
