import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type LifecycleAction = "archive" | "restore" | "delete";

type LifecyclePayload = {
  action?: LifecycleAction;
};

type DocumentRow = {
  id: string;
  status: string | null;
  draft_file_path: string | null;
  final_file_path: string | null;
  file_path: string | null;
};

function getRestoredStatus(document: DocumentRow) {
  if (document.final_file_path) {
    return "approved";
  }

  return "submitted";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as LifecyclePayload | null;
  const action = body?.action;

  if (action !== "archive" && action !== "restore" && action !== "delete") {
    return NextResponse.json({ error: "Invalid lifecycle action." }, { status: 400 });
  }

  const { data: document, error: getError } = await auth.supabase
    .from("documents")
    .select("id, status, draft_file_path, final_file_path, file_path")
    .eq("id", id)
    .single<DocumentRow>();

  if (getError || !document) {
    return NextResponse.json(
      { error: getError?.message || "Document not found." },
      { status: 404 }
    );
  }

  if (action === "archive") {
    const archivedAt = new Date().toISOString();
    const { error: updateError } = await auth.supabase
      .from("documents")
      .update({
        status: "archived",
        archived_at: archivedAt,
        archived_by: auth.user.id,
        archived_by_email: auth.user.email ?? null,
        restored_at: null,
        restored_by: null,
        restored_by_email: null,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      status: "archived",
      archivedAt,
      archivedByEmail: auth.user.email ?? null,
    });
  }

  if (action === "restore") {
    const status = getRestoredStatus(document);
    const restoredAt = new Date().toISOString();
    const { error: updateError } = await auth.supabase
      .from("documents")
      .update({
        status,
        restored_at: restoredAt,
        restored_by: auth.user.id,
        restored_by_email: auth.user.email ?? null,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      status,
      restoredAt,
      restoredByEmail: auth.user.email ?? null,
    });
  }

  const filePaths = Array.from(
    new Set(
      [document.draft_file_path, document.final_file_path, document.file_path].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  if (filePaths.length > 0) {
    const { error: storageError } = await auth.supabase.storage
      .from("documents")
      .remove(filePaths);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await auth.supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    action,
    deletedId: id,
  });
}
