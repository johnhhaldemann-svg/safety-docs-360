import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

/** Returned from AI review API routes when the caller is not in {@link isDocumentAiReviewerRole}. */
export const DOCUMENT_AI_REVIEW_ROLE_FORBIDDEN_ERROR =
  "Document AI review can only be run by app admins, super admins, platform admins, or internal reviewers.";

/** Roles that may run in-app document AI review (GC program, CSEP, PSHSEP). */
export function isDocumentAiReviewerRole(role: string | null | undefined): boolean {
  const normalized = normalizeAppRole(role ?? "");
  return isAdminRole(role) || normalized === "internal_reviewer";
}
