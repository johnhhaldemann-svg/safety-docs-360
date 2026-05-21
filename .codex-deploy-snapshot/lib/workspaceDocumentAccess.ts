import { uuidMatches } from "@/lib/companyScope";
import { isApprovedDocumentStatus, isArchivedDocumentStatus } from "@/lib/documentStatus";
import { isAdminRole, isCompanyRole, isCompanyWorkspaceOversightRole } from "@/lib/rbac";

type DocAccessRow = {
  id: string;
  status?: string | null;
  final_file_path?: string | null;
  user_id?: string | null;
  company_id?: string | null;
};

/**
 * Mirrors visibility rules in GET /api/workspace/documents for whether a row may appear
 * in the requester’s library list (used to gate excerpt preview).
 */
export function canRequestWorkspaceDocumentExcerpt(
  doc: DocAccessRow,
  params: {
    role: string;
    userId: string;
    companyScopeCompanyId: string | null;
    purchasedDocumentIds: string[];
  }
): boolean {
  if (isArchivedDocumentStatus(doc.status)) {
    return false;
  }

  if (isCompanyRole(params.role)) {
    if (isCompanyWorkspaceOversightRole(params.role)) {
      return params.companyScopeCompanyId
        ? uuidMatches(doc.company_id, params.companyScopeCompanyId)
        : uuidMatches(doc.user_id, params.userId);
    }

    const purchased = params.purchasedDocumentIds.some((pid) =>
      uuidMatches(pid, doc.id)
    );

    return (
      isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path)) &&
      (Boolean(
        params.companyScopeCompanyId &&
          uuidMatches(doc.company_id, params.companyScopeCompanyId)
      ) ||
        uuidMatches(doc.user_id, params.userId) ||
        purchased)
    );
  }

  if (isAdminRole(params.role)) {
    return true;
  }

  return uuidMatches(doc.user_id, params.userId);
}
