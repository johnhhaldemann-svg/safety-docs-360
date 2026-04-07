import { isApprovedDocumentStatus, isArchivedDocumentStatus } from "@/lib/documentStatus";
import { isAdminRole, isCompanyAdminRole, isCompanyRole } from "@/lib/rbac";

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
    if (isCompanyAdminRole(params.role) || params.role === "manager") {
      return params.companyScopeCompanyId
        ? doc.company_id === params.companyScopeCompanyId
        : doc.user_id === params.userId;
    }

    return (
      isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path)) &&
      (Boolean(
        params.companyScopeCompanyId &&
          doc.company_id === params.companyScopeCompanyId
      ) ||
        doc.user_id === params.userId ||
        params.purchasedDocumentIds.includes(doc.id))
    );
  }

  if (isAdminRole(params.role)) {
    return true;
  }

  return doc.user_id === params.userId;
}
