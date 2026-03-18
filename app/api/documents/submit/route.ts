import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePshsepDocx, type PSHSEPInput } from "@/app/api/pshsep/export/route";
import { generateCsepDocx } from "@/app/api/csep/export/route";

export const runtime = "nodejs";

type SubmitPayload = {
  user_id: string;
  document_type: string;
  project_name: string;
  form_data: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error: "Missing Supabase environment variables.",
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: !supabaseServiceRoleKey,
          },
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = (await request.json()) as SubmitPayload;
    const { user_id, document_type, project_name, form_data } = body;

    if (!user_id || !document_type || !project_name || !form_data) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id,
        project_name,
        document_type,
        status: "submitted",
      })
      .select("id")
      .single();

    if (insertError || !insertedDoc) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create document row." },
        { status: 500 }
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
      await supabase.from("documents").delete().eq("id", insertedDoc.id);

      return NextResponse.json(
        { error: "Failed to generate the review draft." },
        { status: 500 }
      );
    }

    const safeProjectName = project_name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const draftFileName = `${safeProjectName}_${normalizedType}_Draft.docx`;
    const filePath = `drafts/${user_id}/${insertedDoc.id}/${draftFileName}`;

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

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        draft_file_path: filePath,
      })
      .eq("id", insertedDoc.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
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
