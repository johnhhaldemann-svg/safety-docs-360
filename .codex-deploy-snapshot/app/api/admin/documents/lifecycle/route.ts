import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type LifecycleAction = "archive" | "restore" | "delete";

type LifecyclePayload = {
  action?: LifecycleAction;
  ids?: string[];
};

type DocumentRow = {
  id: string;
  final_file_path: string | null;
  draft_file_path: string | null;
  file_path: string | null;
};

function normalizeIds(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => null)) as LifecyclePayload | null;
  const action = body?.action;
  const ids = normalizeIds(body?.ids);

  if (action !== "archive" && action !== "restore" && action !== "delete") {
    return NextResponse.json({ error: "Invalid lifecycle action." }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "At least one document ID is required." }, { status: 400 });
  }

  const { data: documents, error: getError } = await auth.supabase
    .from("documents")
    .select("id, final_file_path, draft_file_path, file_path")
    .in("id", ids);

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 500 });
  }

  const rows = (documents ?? []) as DocumentRow[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "No matching documents found." }, { status: 404 });
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
      .in("id", rows.map((row) => row.id));

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      count: rows.length,
    });
  }

  if (action === "restore") {
    const restoredAt = new Date().toISOString();
    const approvedIds = rows
      .filter((row) => Boolean(row.final_file_path))
      .map((row) => row.id);
    const submittedIds = rows
      .filter((row) => !row.final_file_path)
      .map((row) => row.id);

    if (approvedIds.length > 0) {
      const { error } = await auth.supabase
        .from("documents")
        .update({
          status: "approved",
          restored_at: restoredAt,
          restored_by: auth.user.id,
          restored_by_email: auth.user.email ?? null,
        })
        .in("id", approvedIds);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (submittedIds.length > 0) {
      const { error } = await auth.supabase
        .from("documents")
        .update({
          status: "submitted",
          restored_at: restoredAt,
          restored_by: auth.user.id,
          restored_by_email: auth.user.email ?? null,
        })
        .in("id", submittedIds);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      count: rows.length,
    });
  }

  const filePaths = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.draft_file_path, row.final_file_path, row.file_path].filter(
          (value): value is string => Boolean(value)
        )
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
    .in("id", rows.map((row) => row.id));

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    action,
    count: rows.length,
  });
}
