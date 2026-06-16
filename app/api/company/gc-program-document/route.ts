import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest } from "@/lib/rbac";
import {
  GC_REQUIRED_PROGRAM_DOCUMENT_TYPE,
  canReviewGcProgramDocumentRole,
} from "@/lib/gcRequiredProgram";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 40 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._\-() ]+/g, "_").slice(0, 180) || "upload";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ document: null, pendingReview: false });
  }

  const staff = canReviewGcProgramDocumentRole(auth.role);

  const { data, error } = await auth.supabase
    .from("documents")
    .select(
      "id, document_title, file_name, file_path, file_size, created_at, uploaded_by, notes, status, final_file_path"
    )
    .eq("company_id", companyScope.companyId)
    .eq("document_type", GC_REQUIRED_PROGRAM_DOCUMENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load GC program document." },
      { status: 500 }
    );
  }

  const row = data as {
    id?: string;
    status?: string | null;
    final_file_path?: string | null;
    created_at?: string | null;
  } | null;

  if (!row) {
    return NextResponse.json({ document: null, pendingReview: false });
  }

  if (staff) {
    return NextResponse.json({ document: data, pendingReview: false, staffView: true });
  }

  const approved = isApprovedDocumentStatus(row.status, Boolean(row.final_file_path));
  if (approved) {
    return NextResponse.json({ document: data, pendingReview: false });
  }

  return NextResponse.json({
    document: null,
    pendingReview: true,
    submittedAt: row.created_at ?? null,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents"],
  });
  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "Your account must be linked to a company workspace to upload this document." },
      { status: 400 }
    );
  }

  const companyId = companyScope.companyId;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const titleRaw = formData?.get("title");
  const projectNameRaw = formData?.get("project_name");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A non-empty file is required." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB).` },
      { status: 400 }
    );
  }

  const documentTitle =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim().slice(0, 200)
      : "GC-required program document";

  const projectNameFromForm =
    typeof projectNameRaw === "string" && projectNameRaw.trim()
      ? projectNameRaw.trim().slice(0, 200)
      : "";
  const projectName =
    projectNameFromForm || documentTitle || "GC-required program";

  const { data: existingRows, error: listError } = await auth.supabase
    .from("documents")
    .select("id, file_path")
    .eq("company_id", companyId)
    .eq("document_type", GC_REQUIRED_PROGRAM_DOCUMENT_TYPE);

  if (listError) {
    return NextResponse.json(
      { error: listError.message || "Could not check existing uploads." },
      { status: 500 }
    );
  }

  const previous = (existingRows ?? []) as Array<{ id: string; file_path?: string | null }>;
  for (const row of previous) {
    if (row.file_path) {
      await auth.supabase.storage.from("documents").remove([row.file_path]);
    }
  }
  if (previous.length > 0) {
    await auth.supabase
      .from("documents")
      .delete()
      .eq("company_id", companyId)
      .eq("document_type", GC_REQUIRED_PROGRAM_DOCUMENT_TYPE);
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `companies/${companyId}/gc-required-program/${randomUUID()}-${safeName}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await auth.supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || "Upload to storage failed." },
      { status: 500 }
    );
  }

  const { data: inserted, error: insertError } = await auth.supabase
    .from("documents")
    .insert({
      user_id: auth.user.id,
      project_name: projectName,
      document_title: documentTitle,
      title: documentTitle,
      document_type: GC_REQUIRED_PROGRAM_DOCUMENT_TYPE,
      category: "GC Compliance",
      status: "pending_gateway",
      notes:
        "Document required by the General Contractor for this company to follow on the project, in addition to OSHA and other regulatory requirements.",
      company_id: companyId,
      file_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      uploaded_by: auth.user.email ?? null,
      final_file_path: null,
    })
    .select("id, created_at, document_title")
    .single();

  if (insertError || !inserted) {
    await auth.supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json(
      { error: insertError?.message || "Failed to save document record." },
      { status: 500 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    await auth.supabase.from("documents").delete().eq("id", (inserted as { id: string }).id);
    await auth.supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: "Gateway service unavailable." }, { status: 500 });
  }

  const { error: candidateError } = await adminClient
    .from("ai_knowledge_ingest_candidates")
    .insert({
      company_id: companyId,
      candidate_type: "node",
      source_table: "documents",
      source_id: (inserted as { id: string }).id,
      source_record_id: (inserted as { id: string }).id,
      title: `${GC_REQUIRED_PROGRAM_DOCUMENT_TYPE} — ${documentTitle}`,
      semantic_summary: `GC-required program document "${documentTitle}" queued for gateway review.`,
      reason: "GC-required program document queued for Super Admin gateway review before database activation.",
      source_evidence: [
        {
          sourceTable: "documents",
          sourceRecordId: (inserted as { id: string }).id,
          label: "GC program document",
          detail: `GC-required program document "${documentTitle}" uploaded by ${auth.user.email ?? auth.user.id}. File: ${storagePath}`,
        },
      ],
      proposed_payload: {
        sourceTable: "documents",
        sourceId: (inserted as { id: string }).id,
        sourceRecordId: (inserted as { id: string }).id,
        companyId,
        title: documentTitle,
        nodeType: "document",
        type: "document",
        category: "GC Compliance",
        description: `GC-required program document: ${documentTitle}`,
        semanticSummary: `GC-required program document "${documentTitle}" pending gateway activation.`,
        riskLevel: "moderate",
        riskScore: null,
        trade: null,
        project: projectName,
        sourceUrl: null,
        sourceDocument: storagePath,
        metadata: {},
        vectorStatus: "pending",
        vectorCoordinates: { x: 0, y: 0, z: 0, cluster: "document" },
        confidenceScore: null,
        validationStatus: "pending_review",
        createdByType: "user",
      },
      confidence_score: null,
      validation_status: "pending_review",
      metadata: {
        evidenceText: `GC-required program document "${documentTitle}" pending gateway review.`,
        requiresHumanReview: true,
        trustedMemoryWrite: false,
        doesNotProveCompliance: true,
        submittedBy: auth.user.id,
        documentId: (inserted as { id: string }).id,
        storagePath,
        documentTitle,
        projectName,
      },
      created_by_type: "user",
    });

  if (candidateError) {
    await auth.supabase.from("documents").delete().eq("id", (inserted as { id: string }).id);
    await auth.supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: "Failed to queue document for gateway review." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pendingReview: true,
    submittedAt: (inserted as { created_at?: string })?.created_at ?? null,
  });
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents"],
  });
  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const { data: rows, error: listError } = await auth.supabase
    .from("documents")
    .select("id, file_path, status, final_file_path")
    .eq("company_id", companyScope.companyId)
    .eq("document_type", GC_REQUIRED_PROGRAM_DOCUMENT_TYPE);

  if (listError) {
    return NextResponse.json({ error: listError.message || "Failed to list documents." }, { status: 500 });
  }

  const list = (rows ?? []) as Array<{
    id: string;
    file_path?: string | null;
    status?: string | null;
    final_file_path?: string | null;
  }>;

  const pendingOnly = list.filter(
    (row) => {
      const s = (row.status ?? "").trim().toLowerCase();
      return (s === "submitted" || s === "pending_gateway") && !row.final_file_path;
    }
  );

  if (pendingOnly.length === 0) {
    return NextResponse.json(
      {
        error:
          "Only a pending submission can be removed here. Approved GC documents stay on file until an administrator archives them.",
      },
      { status: 400 }
    );
  }

  for (const row of pendingOnly) {
    if (row.file_path) {
      await auth.supabase.storage.from("documents").remove([row.file_path]);
    }
  }

  const { error: delError } = await auth.supabase
    .from("documents")
    .delete()
    .eq("company_id", companyScope.companyId)
    .eq("document_type", GC_REQUIRED_PROGRAM_DOCUMENT_TYPE)
    .in("status", ["submitted", "pending_gateway"]);

  if (delError) {
    return NextResponse.json({ error: delError.message || "Failed to remove records." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
