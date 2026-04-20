import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { getDefaultAgreementConfig, getUserAgreementRecord } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { authorizeRequest } from "@/lib/rbac";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { serverLog } from "@/lib/serverLog";
import { ensureSafetyPlanGenerationContext } from "@/lib/safety-intelligence/documentIntake";
import { runSafetyPlanDocumentPipeline } from "@/lib/safety-intelligence/documents/pipeline";
import { renderSafetyPlanDocx } from "@/lib/safety-intelligence/documents/render";
import { renderGeneratedCsepDocx } from "@/lib/csepDocxRenderer";
import { syncGeneratedTrainingRequirements } from "@/lib/safety-intelligence/trainingProgram";
import { generateCsepDocx } from "@/app/api/csep/export/route";
import { generatePshsepDocx } from "@/app/api/pshsep/export/route";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

export const runtime = "nodejs";

type SubmitPayload = {
  user_id?: string;
  document_type: string;
  project_name: string;
  form_data: Record<string, unknown>;
  generated_document_id?: string;
  builder_input_hash?: string;
};

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function extractErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isMissingSafetyIntelligenceSchemaError(error: unknown) {
  const message = extractErrorMessage(error).toLowerCase();
  if (!message) return false;

  const schemaTokens = [
    "company_bucket_runs",
    "company_bucket_items",
    "company_ai_reviews",
    "company_generated_documents",
    "company_conflict_pairs",
    "company_training_requirements",
    "apply_sub_trades",
    "apply_task_codes",
    "is_generated",
    "generated_source_type",
    "generated_source_document_id",
    "generated_source_operation_key",
    "generated_document_id",
    "source_document_id",
  ];

  return (
    schemaTokens.some((token) => message.includes(token)) &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache") ||
      message.includes("column") ||
      message.includes("relation"))
  );
}

function isRecoverableSafetyPlanPipelineError(error: unknown) {
  if (isMissingSafetyIntelligenceSchemaError(error)) {
    return true;
  }

  const message = extractErrorMessage(error).toLowerCase();
  if (!message) return false;

  const permissionTokens = [
    "row-level security",
    "permission denied",
    "insufficient privilege",
    "not allowed",
    "jwt",
    "policy",
  ];

  const pipelineTokens = [
    "company_bucket_runs",
    "company_bucket_items",
    "company_conflict_pairs",
    "company_ai_reviews",
    "company_generated_documents",
    "company_training_requirements",
    "platform_rule_templates",
    "company_rule_overrides",
    "jobsite_rule_overrides",
  ];

  return (
    permissionTokens.some((token) => message.includes(token)) &&
    pipelineTokens.some((token) => message.includes(token))
  );
}

function parseContentDispositionFilename(value: string | null) {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const quotedMatch = value.match(/filename=\"([^\"]+)\"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }
  const bareMatch = value.match(/filename=([^;]+)/i);
  return bareMatch?.[1]?.trim() ?? null;
}

async function renderLegacyDraftFile(params: {
  normalizedType: string;
  formData: Record<string, unknown>;
  supabase: any;
}) {
  if (params.normalizedType === "CSEP") {
    const response = await generateCsepDocx(params.formData as Record<string, unknown>, {
      supabase: params.supabase,
    });
    const body = new Uint8Array(await response.arrayBuffer());
    const filename =
      parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
      "Project_CSEP.docx";
    return { body, filename };
  }

  const rendered = await generatePshsepDocx(params.formData as Record<string, unknown>, {
    supabase: params.supabase,
  });
  return {
    body: rendered.body,
    filename: rendered.filename,
  };
}

function isGeneratedSafetyPlanDraft(value: unknown): value is GeneratedSafetyPlanDraft {
  return Boolean(value) && typeof value === "object" && "sectionMap" in (value as Record<string, unknown>);
}

export async function POST(request: Request) {
  let createdDocumentId: string | null = null;
  try {
    const auth = await authorizeRequest(request, {
      requirePermission: "can_submit_documents",
    });

    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, user } = auth;

    const body = (await request.json()) as SubmitPayload;
    const document_type = normalizeRequiredString(body.document_type);
    const project_name = normalizeRequiredString(body.project_name);
    const form_data =
      body.form_data && typeof body.form_data === "object" ? body.form_data : null;

    if (!document_type || !project_name || !form_data) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (body.user_id && body.user_id !== user.id) {
      return NextResponse.json(
        { error: "Authenticated user does not match submission payload." },
        { status: 403 }
      );
    }

    const [agreementResult, agreementConfig] = await Promise.all([
      getUserAgreementRecord(supabase, user.id, user.user_metadata ?? undefined),
      getAgreementConfig(supabase).catch(() => getDefaultAgreementConfig()),
    ]);

    if (
      !agreementResult.data?.accepted_terms ||
      agreementResult.data?.terms_version !== agreementConfig.version
    ) {
      return NextResponse.json(
        {
          error:
            "You must accept the current Terms of Service, Liability Waiver, and Licensing Agreement before submitting documents.",
          termsVersion: agreementConfig.version,
        },
        { status: 403 }
      );
    }

    const normalizedType = document_type.trim().toUpperCase();
    const companyScope = await getCompanyScope({
      supabase,
      userId: user.id,
      fallbackTeam: auth.team,
      authUser: user,
    });

    if (!companyScope.companyId) {
      return NextResponse.json(
        { error: "No company workspace linked." },
        { status: 400 }
      );
    }

    const canonicalDocumentType = normalizedType === "CSEP" ? "csep" : "pshsep";
    const generationContext = ensureSafetyPlanGenerationContext({
      documentType: canonicalDocumentType,
      formData: {
        ...form_data,
        project_name,
      },
      companyId: companyScope.companyId,
      jobsiteId:
        typeof form_data.jobsite_id === "string" && form_data.jobsite_id.trim()
          ? form_data.jobsite_id.trim()
          : null,
    });
    const riskMemory = await buildRiskMemoryStructuredContext(
      supabase,
      companyScope.companyId,
      {
        jobsiteId: generationContext.siteContext.jobsiteId ?? null,
        days: 90,
      }
    ).catch((riskMemoryError) => {
      serverLog("warn", "document_submit_risk_memory_fallback", {
        userId: user.id,
        companyId: companyScope.companyId,
        documentType: normalizedType,
        message: extractErrorMessage(riskMemoryError).slice(0, 200),
      });
      return null;
    });
    let approvedPreviewDraft: GeneratedSafetyPlanDraft | null = null;
    let approvedPreviewBucketRunId: string | null = null;

    if (
      normalizedType === "CSEP" &&
      typeof body.generated_document_id === "string" &&
      body.generated_document_id.trim()
    ) {
      const currentBuilderInputHash = generationContext.builderInstructions?.builderInputHash ?? null;
      const requestedBuilderInputHash = normalizeRequiredString(body.builder_input_hash);

      if (!requestedBuilderInputHash || !currentBuilderInputHash) {
        return NextResponse.json(
          { error: "Generate and approve a current AI draft before submitting this CSEP." },
          { status: 409 }
        );
      }

      if (requestedBuilderInputHash !== currentBuilderInputHash) {
        return NextResponse.json(
          { error: "The builder changed after AI draft approval. Regenerate the AI draft before submitting." },
          { status: 409 }
        );
      }

      const previewResult = await supabase
        .from("company_generated_documents")
        .select("id, company_id, created_by, document_type, bucket_run_id, provenance, draft_json")
        .eq("id", body.generated_document_id.trim())
        .single();

      if (previewResult.error || !previewResult.data) {
        return NextResponse.json(
          { error: "Approved AI draft not found. Regenerate the AI draft before submitting." },
          { status: 404 }
        );
      }

      const previewRow = previewResult.data as Record<string, unknown>;
      const storedProvenance =
        previewRow.provenance && typeof previewRow.provenance === "object"
          ? (previewRow.provenance as Record<string, unknown>)
          : {};
      const storedBuilderInputHash = normalizeRequiredString(storedProvenance.builderInputHash);

      if (
        String(previewRow.company_id ?? "") !== companyScope.companyId ||
        String(previewRow.created_by ?? "") !== user.id ||
        String(previewRow.document_type ?? "").toLowerCase() !== "csep"
      ) {
        return NextResponse.json(
          { error: "Approved AI draft is not available for this company submission context." },
          { status: 403 }
        );
      }

      if (storedBuilderInputHash !== requestedBuilderInputHash) {
        return NextResponse.json(
          { error: "The approved AI draft is stale. Regenerate the AI draft before submitting." },
          { status: 409 }
        );
      }

      if (!isGeneratedSafetyPlanDraft(previewRow.draft_json)) {
        return NextResponse.json(
          { error: "Approved AI draft is incomplete. Regenerate the AI draft before submitting." },
          { status: 409 }
        );
      }

      approvedPreviewDraft = previewRow.draft_json;
      approvedPreviewBucketRunId =
        typeof previewRow.bucket_run_id === "string" && previewRow.bucket_run_id.trim()
          ? previewRow.bucket_run_id
          : null;
    }

    const safeProjectName = project_name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const documentId = crypto.randomUUID();
    const draftFileName = `${safeProjectName}_${normalizedType}_Draft.docx`;
    const filePath = `drafts/${user.id}/${documentId}/${draftFileName}`;

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        user_id: user.id,
        project_name,
        document_type,
        status: "submitted",
        company_id: companyScope.companyId,
        draft_file_path: filePath,
        file_name: draftFileName,
      })
      .select("id")
      .single();

    if (insertError || !insertedDoc) {
      serverLog("error", "document_submit_insert_failed", {
        userId: user.id,
        hasInsertError: Boolean(insertError),
      });
      return NextResponse.json(
        { error: insertError?.message || "Failed to create document row." },
        { status: 500 }
      );
    }
    createdDocumentId = insertedDoc.id;

    let fileData: Uint8Array;
    let generatedDocumentId: string | null = null;
    let bucketRunId: string | null = null;

    if (approvedPreviewDraft) {
      const rendered =
        normalizedType === "CSEP"
          ? await renderGeneratedCsepDocx(approvedPreviewDraft)
          : await renderSafetyPlanDocx(approvedPreviewDraft);
      fileData = rendered.body;
      generatedDocumentId = body.generated_document_id?.trim() ?? null;
      bucketRunId = approvedPreviewBucketRunId;

      await supabase
        .from("documents")
        .update({
          generated_document_id: generatedDocumentId,
        })
        .eq("id", insertedDoc.id);

      await syncGeneratedTrainingRequirements({
        supabase,
        companyId: companyScope.companyId,
        sourceDocumentId: insertedDoc.id,
        trainingProgram: approvedPreviewDraft.trainingProgram,
        actorUserId: user.id,
      }).catch((trainingError) => {
        serverLog("warn", "document_submit_preview_training_sync_failed", {
          userId: user.id,
          companyId: companyScope.companyId,
          documentId: insertedDoc.id,
          message: extractErrorMessage(trainingError).slice(0, 200),
        });
      });
    } else {
      try {
        const pipeline = await runSafetyPlanDocumentPipeline({
          supabase,
          actorUserId: user.id,
          companyId: companyScope.companyId,
          jobsiteId: generationContext.siteContext.jobsiteId ?? null,
          sourceDocumentId: insertedDoc.id,
          generationContext,
          intakePayload: {
            document_type: document_type.trim(),
            project_name: project_name.trim(),
            form_data,
          },
          riskMemorySummary: (riskMemory ?? null) as any,
        });
        const rendered =
          normalizedType === "CSEP"
            ? await renderGeneratedCsepDocx(pipeline.draft)
            : await renderSafetyPlanDocx(pipeline.draft);
        fileData = rendered.body;
        generatedDocumentId = pipeline.generatedDocumentId;
        bucketRunId = pipeline.bucketRunId;

        await supabase
          .from("documents")
          .update({
            generated_document_id: pipeline.generatedDocumentId,
          })
          .eq("id", insertedDoc.id);
      } catch (pipelineError) {
        if (!isRecoverableSafetyPlanPipelineError(pipelineError)) {
          throw pipelineError;
        }

        serverLog("warn", "document_submit_pipeline_schema_fallback", {
          userId: user.id,
          companyId: companyScope.companyId,
          documentType: normalizedType,
          message: extractErrorMessage(pipelineError).slice(0, 200),
        });

        const legacyDraft = await renderLegacyDraftFile({
          normalizedType,
          formData: form_data,
          supabase,
        });
        fileData = legacyDraft.body;
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, fileData, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      serverLog("error", "document_submit_storage_upload_failed", {
        userId: user.id,
        documentId: insertedDoc.id,
      });
      await supabase.from("documents").delete().eq("id", insertedDoc.id);

      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document_id: insertedDoc.id,
      draft_file_path: filePath,
      generated_document_id: generatedDocumentId,
      bucket_run_id: bucketRunId,
    });
  } catch (error) {
    if (createdDocumentId) {
      await authorizeRequest(request, {
        requirePermission: "can_submit_documents",
      })
        .then(async (auth) => {
          if ("error" in auth) return;
          await auth.supabase.from("documents").delete().eq("id", createdDocumentId);
        })
        .catch(() => undefined);
    }
    serverLog("error", "document_submit_unexpected_error", {
      errorKind: error instanceof Error ? error.name : "unknown",
      message: extractErrorMessage(error).slice(0, 200),
    });

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
