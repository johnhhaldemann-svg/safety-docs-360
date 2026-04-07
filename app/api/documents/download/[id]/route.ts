import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { downloadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import { checkFixedWindowRateLimit, contentTypeFromFilenameHint } from "@/lib/rateLimit";

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

    const { supabase, user } = auth;
    const { id } = await context.params;

    const ip = getClientIpAddress(request) ?? "unknown";
    const limit = checkFixedWindowRateLimit(`admin_draft_download:${user.id}:${ip}`, {
      windowMs: 60_000,
      max: 40,
    });
    if (!limit.ok) {
      const res = NextResponse.json(
        { error: "Too many download requests. Try again shortly." },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(limit.retryAfterSec));
      return res;
    }

    const adminClient = createSupabaseAdminClient();
    const docClient = adminClient ?? supabase;

    const { data: doc, error: docError } = await docClient
      .from("documents")
      .select("id, project_name, user_id, status, draft_file_path")
      .eq("id", id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document record not found." }, { status: 404 });
    }

    if (!doc.draft_file_path?.trim()) {
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

    const downloaded = await downloadDocumentsBucketObject(doc.draft_file_path);
    if (!downloaded.ok) {
      return NextResponse.json(
        {
          error: downloaded.error,
          draft_file_path: doc.draft_file_path,
        },
        { status: downloaded.status }
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

    const pathHint = doc.draft_file_path.split("/").pop() ?? "";
    const contentType = contentTypeFromFilenameHint(pathHint);
    const safeName = `${doc.project_name || "PSHSEP"}_Draft${pathHint.match(/\.[^.]+$/)?.[0] ?? ".docx"}`.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    return new NextResponse(new Uint8Array(downloaded.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch (error) {
    console.error("Download route error:", error);

    return NextResponse.json({ error: "Unexpected download route error." }, { status: 500 });
  }
}
