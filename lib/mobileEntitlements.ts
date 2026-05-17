import type { PermissionMap } from "@/lib/rbac";
import {
  canManageCompanyIncidents,
  canManageCompanyJsa,
  canManageCompanyPermits,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyFeatureAccess";
import { canManageObservations } from "@/lib/companyPermissions";

export const MOBILE_FEATURES = [
  "mobile_dashboard",
  "mobile_jobsites",
  "mobile_jsa",
  "mobile_field_issues",
  "mobile_field_audits",
  "mobile_permits",
  "mobile_incidents",
  "mobile_toolbox",
  "mobile_training",
  "mobile_documents",
  "mobile_safety_intelligence",
  "mobile_reports",
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
  const permitRequests = jsa || canManageCompanyPermits(role, permissionMap);
  const incidentReports = fieldIssues || canManageCompanyIncidents(role, permissionMap);
  const toolbox = jsa;
  const training = canViewCompanyTrainingMatrix(role, permissionMap);
  const documents = Boolean(
    permissionMap?.can_access_document_library ||
      permissionMap?.can_create_documents ||
      permissionMap?.can_submit_documents ||
      permissionMap?.can_view_all_company_data
  );
  const safetyIntelligence = Boolean(
    permissionMap?.can_access_safety_intelligence ||
      permissionMap?.can_view_analytics ||
      permissionMap?.can_view_all_company_data
  );
  const reports = Boolean(permissionMap?.can_view_reports || permissionMap?.can_view_all_company_data);
  const jobsites = Boolean(
    dashboard ||
      jsa ||
      fieldIssues ||
      fieldAudits ||
      permitRequests ||
      incidentReports ||
      permissionMap?.can_access_jobsites ||
      permissionMap?.can_view_all_company_data
  );
  const photos = fieldIssues || fieldAudits || jsa || permitRequests || incidentReports;
  const signatures = jsa;

  return {
    mobile_dashboard: dashboard,
    mobile_jobsites: jobsites,
    mobile_jsa: jsa,
    mobile_field_issues: fieldIssues,
    mobile_field_audits: fieldAudits,
    mobile_permits: permitRequests,
    mobile_incidents: incidentReports,
    mobile_toolbox: toolbox,
    mobile_training: training,
    mobile_documents: documents,
    mobile_safety_intelligence: safetyIntelligence,
    mobile_reports: reports,
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

  if (
    !resolved.mobile_field_issues &&
    !resolved.mobile_field_audits &&
    !resolved.mobile_jsa &&
    !resolved.mobile_permits &&
    !resolved.mobile_incidents
  ) {
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
