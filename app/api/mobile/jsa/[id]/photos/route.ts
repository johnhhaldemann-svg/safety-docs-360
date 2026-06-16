import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isMultipartPhotoRequest, uploadMobilePhotoFromRequest } from "@/lib/mobilePhotoUpload";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
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
  const jsa = await auth.supabase
    .from("company_jsas")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (jsa.error) return NextResponse.json({ error: jsa.error.message || "Failed to load JSA." }, { status: 500 });
  if (!jsa.data) return NextResponse.json({ error: "JSA not found." }, { status: 404 });

  const adminClient = createSupabaseAdminClient();
  const actorUserId = auth.user?.id ?? "";

  async function createJsaEvidenceCandidate(evidenceRow: Record<string, unknown>) {
    if (!adminClient) return { error: "Gateway service unavailable.", candidateId: null };
    const candidateId = crypto.randomUUID();
    const { error } = await adminClient.from("ai_knowledge_ingest_candidates").insert({
      id: candidateId,
      company_id: companyScope.companyId,
      candidate_type: "node",
      source_table: "company_jsa_evidence",
      source_id: candidateId,
      source_record_id: candidateId,
      title: `JSA photo — ${id}`,
      semantic_summary: `JSA evidence photo for JSA ${id} pending gateway review.`,
      reason: "Mobile JSA photo queued for Super Admin gateway review before database activation.",
      source_evidence: [
        {
          sourceTable: "company_jsa_evidence",
          sourceRecordId: candidateId,
          label: "JSA evidence photo",
          detail: `Photo uploaded for JSA ${id}. File: ${evidenceRow.file_path}`,
        },
      ],
      proposed_payload: {
        sourceTable: "company_jsa_evidence",
        sourceId: candidateId,
        sourceRecordId: candidateId,
        companyId: companyScope.companyId,
        title: `JSA photo — ${id}`,
        nodeType: "observation",
        type: "observation",
        category: "jsa evidence",
        description: `JSA evidence photo for JSA ${id}.`,
        semanticSummary: `JSA evidence photo pending gateway activation.`,
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
        evidenceText: `JSA evidence photo for JSA ${id} pending gateway review.`,
        requiresHumanReview: true,
        trustedMemoryWrite: false,
        doesNotProveCompliance: true,
        gatewaySubmission: true,
        targetTable: "company_jsa_evidence",
        proposedRow: evidenceRow,
        submittedBy: actorUserId,
        jsaId: id,
      },
      created_by_type: "user",
    });
    return { error: error?.message ?? null, candidateId };
  }

  if (isMultipartPhotoRequest(request)) {
    try {
      const photo = await uploadMobilePhotoFromRequest(request, `companies/${companyScope.companyId}/jsas/${id}`);
      const evidenceRow = {
        company_id: companyScope.companyId,
        jsa_id: id,
        jobsite_id: jsa.data.jobsite_id ?? null,
        file_path: photo.filePath,
        file_name: photo.fileName,
        mime_type: photo.mimeType,
        created_by: actorUserId,
      };
      const { error: candidateErr, candidateId } = await createJsaEvidenceCandidate(evidenceRow);
      if (candidateErr) {
        return NextResponse.json({ error: candidateErr }, { status: 500 });
      }
      return NextResponse.json({ success: true, photo: { ...evidenceRow, id: candidateId, pendingGateway: true } });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
    }
  }

  const body = (await request.json().catch(() => null)) as {
    fileName?: string;
    mimeType?: string;
    filePath?: string;
  } | null;
  const filePath = String(body?.filePath ?? "").trim();
  if (filePath) {
    const evidenceRow = {
      company_id: companyScope.companyId,
      jsa_id: id,
      jobsite_id: jsa.data.jobsite_id ?? null,
      file_path: filePath,
      file_name: String(body?.fileName ?? "").trim() || filePath.split("/").pop() || "photo",
      mime_type: String(body?.mimeType ?? "").trim() || null,
      created_by: actorUserId,
    };
    const { error: candidateErr, candidateId } = await createJsaEvidenceCandidate(evidenceRow);
    if (candidateErr) {
      return NextResponse.json({ error: candidateErr }, { status: 500 });
    }
    return NextResponse.json({ success: true, photo: { ...evidenceRow, id: candidateId, pendingGateway: true } });
  }

  const fileName = sanitizeFileName(String(body?.fileName ?? "").trim());
  if (!fileName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  if (!adminClient) return NextResponse.json({ error: "Missing storage configuration." }, { status: 500 });
  const path = `companies/${companyScope.companyId}/jsas/${id}/${Date.now()}-${fileName}`;
  const signed = await adminClient.storage.from("documents").createSignedUploadUrl(path);
  if (signed.error || !signed.data?.token) {
    return NextResponse.json({ error: signed.error?.message || "Failed to create upload URL." }, { status: 500 });
  }
  return NextResponse.json({ bucket: "documents", path, token: signed.data.token, mimeType: body?.mimeType ?? null });
}
