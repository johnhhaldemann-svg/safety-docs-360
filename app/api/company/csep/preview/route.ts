import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import { getCsepExportValidationDetail, isCsepExportValidationError } from "@/lib/csepExportValidation";
import { renderGeneratedCsepDocx } from "@/lib/csep/csep-renderer";
import { demoCompanyProfile } from "@/lib/demoWorkspace";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";
import { authorizeRequest } from "@/lib/rbac";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { serverLog } from "@/lib/serverLog";
import { ensureSafetyPlanGenerationContext } from "@/lib/safety-intelligence/documentIntake";
import { runSafetyPlanDocumentPipeline } from "@/lib/safety-intelligence/documents/pipeline";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { JsonObject } from "@/types/safety-intelligence";

export const runtime = "nodejs";

function extractErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, {
      requireAnyPermission: ["can_create_documents", "can_edit_documents"],
    });

    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const formData =
      body.form_data && typeof body.form_data === "object"
        ? (body.form_data as Record<string, unknown>)
        : (body as Record<string, unknown>);
    const projectName =
      typeof body.project_name === "string" && body.project_name.trim()
        ? body.project_name.trim()
        : typeof formData.project_name === "string" && formData.project_name.trim()
          ? formData.project_name.trim()
          : "";

    if (!projectName || !formData) {
      return NextResponse.json({ error: "Project name and form data are required." }, { status: 400 });
    }

    const isDemoCsepPreviewRequest =
      auth.role === "sales_demo" ||
      (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
    const admin = createSupabaseAdminClient();
    const supabase: SupabaseClient = isDemoCsepPreviewRequest
      ? (admin ?? auth.supabase)
      : auth.supabase;
    if (isDemoCsepPreviewRequest && typeof supabase.from !== "function") {
      return NextResponse.json(
        {
          error:
            "Full CSEP preview uses the same generator as production. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment (or use a normal cloud login session) so the draft pipeline can run.",
        },
        { status: 503 }
      );
    }

    let companyScope = await getCompanyScope({
      supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });
    if (!companyScope.companyId && isDemoCsepPreviewRequest) {
      companyScope = {
        companyId: demoCompanyProfile.id,
        companyName: demoCompanyProfile.name?.trim() || "Demo company",
        source: "team_fallback",
      } as unknown as Awaited<ReturnType<typeof getCompanyScope>>;
    }

    if (!companyScope.companyId) {
      return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
    }

    const generationContext = ensureSafetyPlanGenerationContext({
      documentType: "csep",
      formData: {
        ...formData,
        project_name: projectName,
      },
      companyId: companyScope.companyId,
      jobsiteId:
        typeof formData.jobsite_id === "string" && formData.jobsite_id.trim()
          ? formData.jobsite_id.trim()
          : null,
    });
    generationContext.documentProfile.source = "csep_preview";

    const riskMemory = await buildRiskMemoryStructuredContext(
      supabase,
      companyScope.companyId,
      {
        jobsiteId: generationContext.siteContext.jobsiteId ?? null,
        days: 90,
      }
    ).catch((riskMemoryError) => {
      serverLog("warn", "company_csep_preview_risk_memory_fallback", {
        userId: auth.user.id,
        companyId: companyScope.companyId,
        message: extractErrorMessage(riskMemoryError).slice(0, 200),
      });
      return null;
    });

    const pipeline = await runSafetyPlanDocumentPipeline({
      supabase,
      actorUserId: auth.user.id,
      companyId: companyScope.companyId,
      jobsiteId: generationContext.siteContext.jobsiteId ?? null,
      sourceDocumentId: null,
      generationContext,
      intakePayload: {
        document_type: "CSEP",
        project_name: projectName,
        form_data: formData,
      },
      riskMemorySummary: (riskMemory ?? null) as JsonObject | null,
    });

    let structuredDraft = pipeline.draft;
    try {
      structuredDraft = buildStructuredCsepDraft(pipeline.draft);
    } catch {
      structuredDraft = pipeline.draft;
    }

    try {
      await renderGeneratedCsepDocx(pipeline.draft, { footerCompanyName: companyScope.companyName });
    } catch (renderError) {
      if (isCsepExportValidationError(renderError)) {
        return NextResponse.json(
          {
            error: `This CSEP draft is not ready for final issue: ${getCsepExportValidationDetail(
              renderError
            )} Update the builder inputs and regenerate the draft.`,
          },
          { status: 409 }
        );
      }
      throw renderError;
    }

    return NextResponse.json({
      generated_document_id: pipeline.generatedDocumentId,
      builder_input_hash: generationContext.builderInstructions?.builderInputHash ?? null,
      draft: structuredDraft,
      html_preview: pipeline.document.htmlPreview,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate CSEP preview." },
      { status: 400 }
    );
  }
}
