import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRequest(request, { requireAdmin: true });

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const { supabase, user } = auth;

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, project_name, user_id, status, draft_file_path")
      .eq("id", id)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document record not found." },
        { status: 404 }
      );
    }

    if (!doc.draft_file_path) {
      return NextResponse.json(
        { error: "draft_file_path is empty for this document." },
        { status: 404 }
      );
    }

    if (doc.status?.trim().toLowerCase() === "archived") {
      return NextResponse.json(
        { error: "This document is archived and cannot be downloaded." },
        { status: 404 }
      );
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from("documents")
      .download(doc.draft_file_path);

    if (fileError || !fileData) {
      return NextResponse.json(
        {
          error: "Storage file could not be downloaded.",
          draft_file_path: doc.draft_file_path,
          storage_error: fileError?.message ?? null,
        },
        { status: 404 }
      );
    }

    await logDocumentDownload({
      supabase,
      documentId: doc.id,
      actorUserId: user.id,
      ownerUserId: doc.user_id ?? null,
      fileKind: "draft",
      ipAddress: getClientIpAddress(request),
      metadata: {
        route: "admin_draft_download",
        project_name: doc.project_name ?? null,
      },
    });

    const safeName = `${doc.project_name || "PSHSEP"}_Draft.docx`.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    return new NextResponse(fileData, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch (error) {
    console.error("Download route error:", error);

    return NextResponse.json(
      { error: "Unexpected download route error." },
      { status: 500 }
    );
  }
}
