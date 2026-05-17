import { recordCompanySecurityEvent } from "@/lib/companySecurityEvents";

type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

function isMissingDownloadAuditError(error?: { message?: string | null } | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    message.includes("document_downloads") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

export async function logDocumentDownload(params: {
  supabase: SupabaseLikeClient;
  documentId: string;
  actorUserId: string;
  ownerUserId?: string | null;
  fileKind: "draft" | "final" | "preview";
  companyId?: string | null;
  actorRole?: string | null;
  filePath?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const result = await (
    params.supabase.from("document_downloads") as unknown as {
      insert: (
        values: Record<string, unknown>
      ) => PromiseLike<{ error: { message?: string | null } | null }>;
    }
  ).insert({
    document_id: params.documentId,
    actor_user_id: params.actorUserId,
    owner_user_id: params.ownerUserId ?? null,
    file_kind: params.fileKind,
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? {},
  });

  if (params.companyId) {
    await recordCompanySecurityEvent({
      supabase: params.supabase,
      companyId: params.companyId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole ?? null,
      eventType: "file_downloaded",
      resourceType: "document",
      resourceId: params.documentId,
      title: "Document downloaded",
      detail: `${params.fileKind} document access was recorded.`,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: {
        ...params.metadata,
        fileKind: params.fileKind,
        filePath: params.filePath ?? null,
      },
    });
  }

  if (isMissingDownloadAuditError(result.error)) {
    return { skipped: true, error: null };
  }

  return {
    skipped: false,
    error: result.error,
  };
}
