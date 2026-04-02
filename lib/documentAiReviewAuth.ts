import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

/** Roles that may run in-app document AI review (GC program, CSEP, PSHSEP). */
export function isDocumentAiReviewerRole(role: string | null | undefined): boolean {
  const normalized = normalizeAppRole(role ?? "");
  return isAdminRole(role) || normalized === "internal_reviewer";
}
