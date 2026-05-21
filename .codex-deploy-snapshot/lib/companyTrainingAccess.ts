import type { PermissionMap } from "@/lib/rbac";
import {
  canMutateCompanyTrainingRequirements as canMutateCompanyTrainingRequirementsFromFeatures,
  canViewCompanyTrainingMatrix as canViewCompanyTrainingMatrixFromFeatures,
} from "@/lib/companyFeatureAccess";

export function canViewCompanyTrainingMatrix(
  role: string | null | undefined,
  permissionMap?: PermissionMap | null
) {
  return canViewCompanyTrainingMatrixFromFeatures(role, permissionMap);
}

export function canMutateCompanyTrainingRequirements(
  role: string | null | undefined,
  permissionMap?: PermissionMap | null
) {
  return canMutateCompanyTrainingRequirementsFromFeatures(role, permissionMap);
}
