import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

export function canApproveGusLearning(role: string | null | undefined) {
  if (isAdminRole(role)) return true;
  return normalizeAppRole(role) === "company_admin";
}

export function canReviewGusLearning(role: string | null | undefined) {
  if (canApproveGusLearning(role)) return true;
  const normalized = normalizeAppRole(role);
  return normalized === "safety_manager" || normalized === "manager";
}

export function canRequestGusResearch(role: string | null | undefined) {
  if (canReviewGusLearning(role)) return true;
  const normalized = normalizeAppRole(role);
  return normalized === "project_manager" || normalized === "field_supervisor" || normalized === "foreman";
}

export function canAskGusVerifiedQuestions(role: string | null | undefined) {
  if (isAdminRole(role)) return true;
  return normalizeAppRole(role) !== "viewer";
}
