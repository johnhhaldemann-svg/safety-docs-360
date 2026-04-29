import type { PermissionMap } from "@/lib/rbac";
import { canManageCompanyJsa } from "@/lib/companyFeatureAccess";
import { canManageObservations } from "@/lib/companyPermissions";

export const MOBILE_FEATURES = [
  "mobile_dashboard",
  "mobile_jsa",
  "mobile_field_issues",
  "mobile_field_audits",
  "mobile_photos",
  "mobile_signatures",
] as const;

export type MobileFeature = (typeof MOBILE_FEATURES)[number];
export type MobileFeatureMap = Record<MobileFeature, boolean>;

export type MobileFeatureOverride = {
  feature: string | null;
  enabled: boolean | null;
};

function isMobileFeature(feature: string): feature is MobileFeature {
  return (MOBILE_FEATURES as readonly string[]).includes(feature);
}

function baseFeatureMap(role: string, permissionMap?: PermissionMap | null): MobileFeatureMap {
  const dashboard = Boolean(
    permissionMap?.can_view_dashboards ||
      permissionMap?.can_view_all_company_data ||
      permissionMap?.can_view_analytics
  );
  const jsa = canManageCompanyJsa(role, permissionMap);
  const fieldIssues = canManageObservations(role);
  const fieldAudits = canManageObservations(role);
  const photos = fieldIssues || fieldAudits || jsa;
  const signatures = jsa;

  return {
    mobile_dashboard: dashboard,
    mobile_jsa: jsa,
    mobile_field_issues: fieldIssues,
    mobile_field_audits: fieldAudits,
    mobile_photos: photos,
    mobile_signatures: signatures,
  };
}

export function resolveMobileFeatureMap(params: {
  role: string;
  permissionMap?: PermissionMap | null;
  companyOverrides?: readonly MobileFeatureOverride[] | null;
  userOverrides?: readonly MobileFeatureOverride[] | null;
}): MobileFeatureMap {
  const resolved = baseFeatureMap(params.role, params.permissionMap);

  for (const override of [
    ...(params.companyOverrides ?? []),
    ...(params.userOverrides ?? []),
  ]) {
    const feature = String(override.feature ?? "").trim();
    if (!isMobileFeature(feature)) continue;
    resolved[feature] = Boolean(override.enabled);
  }

  if (!resolved.mobile_field_issues && !resolved.mobile_field_audits && !resolved.mobile_jsa) {
    resolved.mobile_photos = false;
  }
  if (!resolved.mobile_jsa) {
    resolved.mobile_signatures = false;
  }

  return resolved;
}

export function visibleMobileFeatures(featureMap: MobileFeatureMap): MobileFeature[] {
  return MOBILE_FEATURES.filter((feature) => featureMap[feature]);
}

export function canAccessMobileFeature(
  featureMap: MobileFeatureMap,
  feature: MobileFeature
) {
  return Boolean(featureMap[feature]);
}
