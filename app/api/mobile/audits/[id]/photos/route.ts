import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isMultipartPhotoRequest, sanitizeMobileFileName, uploadMobilePhotoFromRequest } from "@/lib/mobilePhotoUpload";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return sanitizeMobileFileName(name);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  const { id } = await params;
  const audit = await auth.supabase
    .from("company_jobsite_audits")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (audit.error) return NextResponse.json({ error: audit.error.message || "Failed to load audit." }, { status: 500 });
  if (!audit.data) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(audit.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Audit access denied for this jobsite." }, { status: 403 });
  }

  const adminClient = createSupabaseAdminClient();
  const actorUserId = auth.user?.id ?? "";

  async function createAuditEvidenceCandidate(evidenceRow: Record<string, unknown>) {
    if (!adminClient) return { error: "Gateway service unavailable." };
    const candidateId = crypto.randomUUID();
    const { error } = await adminClient.from("ai_knowledge_ingest_candidates").insert({
      id: candidateId,
      company_id: companyScope.companyId,
      candidate_type: "node",
      source_table: "company_jobsite_audit_evidence",
      source_id: candidateId,
      source_record_id: candidateId,
      title: `Audit photo — ${id}`,
      semantic_summary: `Field audit evidence photo for audit ${id} pending gateway review.`,
      reason: "Mobile audit photo queued for Super Admin gateway review before database activation.",
      source_evidence: [
        {
          sourceTable: "company_jobsite_audit_evidence",
          sourceRecordId: candidateId,
          label: "Audit evidence photo",
          detail: `Photo uploaded for audit ${id}. File: ${evidenceRow.file_path}`,
        },
      ],
      proposed_payload: {
        sourceTable: "company_jobsite_audit_evidence",
        sourceId: candidateId,
        sourceRecordId: candidateId,
        companyId: companyScope.companyId,
        title: `Audit photo — ${id}`,
        nodeType: "observation",
        type: "observation",
        category: "field audit evidence",
        description: `Field audit evidence photo for audit ${id}.`,
        semanticSummary: `Audit evidence photo pending gateway activation.`,
        riskLevel: "unknown",
        riskScore: null,
        trade: null,
        project: null,
        sourceUrl: null,
        sourceDocument: String(evidenceRow.file_path ?? ""),
        metadata: {},
        vectorStatus: "pending",
        vectorCoordinates: { x: 0, y: 0, z: 0, cluster: "evidence" },
        confidenceScore: null,
        validationStatus: "pending_review",
        createdByType: "user",
      },
      confidence_score: null,
      validation_status: "pending_review",
      metadata: {
        evidenceText: `Audit evidence photo for audit ${id} pending gateway review.`,
        requiresHumanReview: true,
        trustedMemoryWrite: false,
        doesNotProveCompliance: true,
        gatewaySubmission: true,
        targetTable: "company_jobsite_audit_evidence",
        proposedRow: evidenceRow,
        submittedBy: actorUserId,
        auditId: id,
      },
      created_by_type: "user",
    });
    return { error: error?.message ?? null, candidateId };
  }

  if (isMultipartPhotoRequest(request)) {
    try {
      const photo = await uploadMobilePhotoFromRequest(
        request,
        `companies/${companyScope.companyId}/field-audits/${id}`
      );
      const evidenceRow = {
        company_id: companyScope.companyId,
        audit_id: id,
        jobsite_id: audit.data.jobsite_id ?? null,
        file_path: photo.filePath,
        file_name: photo.fileName,
        mime_type: photo.mimeType,
        created_by: actorUserId,
      };
      const { error: candidateErr, candidateId } = await createAuditEvidenceCandidate(evidenceRow);
      if (candidateErr) {
        return NextResponse.json({ error: candidateErr }, { status: 500 });
      }
      return NextResponse.json({ success: true, photo: { ...evidenceRow, id: candidateId, pendingGateway: true } });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
    }
  }

  const body = (await request.json().catch(() => null)) as { fileName?: string; mimeType?: string; filePath?: string } | null;
  const filePath = String(body?.filePath ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim() || filePath.split("/").pop() || "";
  if (filePath) {
    const evidenceRow = {
      company_id: companyScope.companyId,
      audit_id: id,
      jobsite_id: audit.data.jobsite_id ?? null,
      file_path: filePath,
      file_name: fileName,
      mime_type: String(body?.mimeType ?? "").trim() || null,
      created_by: actorUserId,
    };
    const { error: candidateErr, candidateId } = await createAuditEvidenceCandidate(evidenceRow);
    if (candidateErr) return NextResponse.json({ error: candidateErr }, { status: 500 });
    return NextResponse.json({ success: true, photo: { ...evidenceRow, id: candidateId, pendingGateway: true } });
  }

  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  if (!adminClient) return NextResponse.json({ error: "Missing storage configuration." }, { status: 500 });
  const path = `companies/${companyScope.companyId}/field-audits/${id}/${Date.now()}-${safeFileName}`;
  const signed = await adminClient.storage.from("documents").createSignedUploadUrl(path);
  if (signed.error || !signed.data?.token) {
    return NextResponse.json({ error: signed.error?.message || "Failed to create upload URL." }, { status: 500 });
  }
  return NextResponse.json({ bucket: "documents", path, token: signed.data.token, mimeType: body?.mimeType ?? null });
}
