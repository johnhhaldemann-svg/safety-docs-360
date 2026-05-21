import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

/** `documents.document_type` for files the GC requires the subcontractor to follow (beyond OSHA). */
export const GC_REQUIRED_PROGRAM_DOCUMENT_TYPE = "GC Required Program";

/** Platform / internal reviewers who may approve GC program uploads (company users never see the file until approved). */
export function canReviewGcProgramDocumentRole(role: string | null | undefined): boolean {
  const normalized = normalizeAppRole(role ?? "");
  return isAdminRole(role) || normalized === "internal_reviewer";
}
