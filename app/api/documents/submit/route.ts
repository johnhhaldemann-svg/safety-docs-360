import { NextResponse } from "next/server";
import { generatePshsepDocx, type PSHSEPInput } from "@/app/api/pshsep/export/route";
import { generateCsepDocx } from "@/app/api/csep/export/route";
import { getUserAgreementRecord } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type SubmitPayload = {
  user_id?: string;
  document_type: string;
  project_name: string;
  form_data: Record<string, unknown>;
};

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request);

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
      getUserAgreementRecord(supabase, user.id),
      getAgreementConfig(supabase),
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
    let fileData: BodyInit | null = null;

    if (normalizedType === "CSEP") {
      const response = await generateCsepDocx({
        project_name,
        ...form_data,
      } as Parameters<typeof generateCsepDocx>[0]);
      fileData = response.body;
    } else {
      const response = await generatePshsepDocx({
        project_name,
        ...form_data,
      } as PSHSEPInput);
      fileData = response.body;
    }

    if (!fileData) {
      return NextResponse.json(
        { error: "Failed to generate the review draft." },
        { status: 500 }
      );
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
        draft_file_path: filePath,
      })
      .select("id")
      .single();

    if (insertError || !insertedDoc) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create document row." },
        { status: 500 }
      );
    }

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, fileData, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
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
    });
  } catch (error) {
    console.error("Submit route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
