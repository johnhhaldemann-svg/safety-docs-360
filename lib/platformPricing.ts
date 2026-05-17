import type { AppPermission, PermissionMap } from "@/lib/rbac";

export const CSEP_LIMITED_TIER_KEY = "csep_limited";

export const ENTERPRISE_TIER_KEYS = [
  "site_launch",
  "professional_network",
  "enterprise_safety_intelligence",
  "black_label_enterprise",
] as const;

export type EnterpriseTierKey = (typeof ENTERPRISE_TIER_KEYS)[number];

export type PlatformFeatureKey =
  | "dashboard_command_center"
  | "jobsites"
  | "field_audits"
  | "field_work"
  | "training_certifications"
  | "document_generation"
  | "document_library"
  | "marketplace_templates"
  | "safety_intelligence"
  | "reports_analytics"
  | "billing"
  | "integrations"
  | "notifications_sms"
  | "executive_reporting"
  | "custom_ai_rules";

export type PlatformAddonKey =
  | "sms_text_alerts"
  | "advanced_notification_routing"
  | "professional_safety_review"
  | "monthly_executive_review_report"
  | "custom_document_templates"
  | "additional_document_pages"
  | "additional_jobsite"
  | "additional_users"
  | "implementation_onboarding"
  | "data_migration"
  | "api_integration_package"
  | "dedicated_support"
  | "training_package"
  | "custom_ai_rules_setup";

export type PlatformAddonSelection = {
  key: PlatformAddonKey;
  label: string;
  quantity: number;
  unitPriceCents: number | null;
  notes?: string;
};

export const ENTERPRISE_TIERS: Array<{
  key: EnterpriseTierKey;
  label: string;
  annualPriceCents: number;
  includedJobsites: number;
  includedUsers: number;
  customPrice?: boolean;
}> = [
  {
    key: "site_launch",
    label: "Tier 1 - Site Launch",
    annualPriceCents: 5000000,
    includedJobsites: 1,
    includedUsers: 25,
  },
  {
    key: "professional_network",
    label: "Tier 2 - Professional Network",
    annualPriceCents: 8500000,
    includedJobsites: 3,
    includedUsers: 75,
  },
  {
    key: "enterprise_safety_intelligence",
    label: "Tier 3 - Enterprise Safety Intelligence",
    annualPriceCents: 15000000,
    includedJobsites: 6,
    includedUsers: 200,
  },
  {
    key: "black_label_enterprise",
    label: "Tier 4 - Black Label Enterprise",
    annualPriceCents: 25000000,
    includedJobsites: 12,
    includedUsers: 500,
    customPrice: true,
  },
];

export const PLATFORM_FEATURES: Array<{
  key: PlatformFeatureKey;
  label: string;
  permissions: AppPermission[];
}> = [
  {
    key: "dashboard_command_center",
    label: "Dashboard / Command Center",
    permissions: ["can_view_dashboards"],
  },
  { key: "jobsites", label: "Jobsites", permissions: ["can_access_jobsites"] },
  {
    key: "field_audits",
    label: "Field Audits",
    permissions: ["can_access_field_audits"],
  },
  {
    key: "field_work",
    label: "Field Work",
    permissions: [
      "can_access_field_work",
      "can_manage_daps",
      "can_manage_observations",
      "can_verify_closures",
      "can_escalate_items",
    ],
  },
  {
    key: "training_certifications",
    label: "Training And Certifications",
    permissions: ["can_access_training"],
  },
  {
    key: "document_generation",
    label: "Document Generation / Upload",
    permissions: ["can_create_documents", "can_edit_documents", "can_submit_documents"],
  },
  {
    key: "document_library",
    label: "Document Library",
    permissions: ["can_access_document_library"],
  },
  {
    key: "marketplace_templates",
    label: "Marketplace / Templates",
    permissions: ["can_access_template_marketplace"],
  },
  {
    key: "safety_intelligence",
    label: "Safety Intelligence / Predictive Risk",
    permissions: ["can_access_safety_intelligence"],
  },
  {
    key: "reports_analytics",
    label: "Reports / Analytics",
    permissions: ["can_view_reports", "can_view_analytics"],
  },
  {
    key: "billing",
    label: "Billing",
    permissions: ["can_access_billing", "can_manage_billing"],
  },
  {
    key: "integrations",
    label: "Integrations",
    permissions: ["can_manage_company_users"],
  },
  { key: "notifications_sms", label: "Notifications / SMS", permissions: [] },
  { key: "executive_reporting", label: "Executive Reporting", permissions: [] },
  { key: "custom_ai_rules", label: "Custom AI Rules / Risk Engine", permissions: [] },
];

export const PLATFORM_ADDONS: Array<{ key: PlatformAddonKey; label: string }> = [
  { key: "sms_text_alerts", label: "SMS / Text Alert Package" },
  { key: "advanced_notification_routing", label: "Advanced Notification Routing" },
  { key: "professional_safety_review", label: "Professional Safety Review" },
  { key: "monthly_executive_review_report", label: "Monthly Executive Review Report" },
  { key: "custom_document_templates", label: "Custom Document Templates" },
  { key: "additional_document_pages", label: "Additional Document Pages" },
  { key: "additional_jobsite", label: "Additional Job Site" },
  { key: "additional_users", label: "Additional Users" },
  { key: "implementation_onboarding", label: "Implementation / Onboarding" },
  { key: "data_migration", label: "Data Migration" },
  { key: "api_integration_package", label: "API / Integration Package" },
  { key: "dedicated_support", label: "Dedicated Support Package" },
  { key: "training_package", label: "Training Package" },
  { key: "custom_ai_rules_setup", label: "Custom AI Rules / Risk Engine Setup" },
];

const featureKeys = new Set<string>(PLATFORM_FEATURES.map((feature) => feature.key));
const addonLabels = new Map(PLATFORM_ADDONS.map((addon) => [addon.key, addon.label] as const));

export function isEnterpriseTierKey(value: unknown): value is EnterpriseTierKey {
  return typeof value === "string" && (ENTERPRISE_TIER_KEYS as readonly string[]).includes(value);
}

export function getEnterpriseTier(key: unknown) {
  return ENTERPRISE_TIERS.find((tier) => tier.key === key) ?? ENTERPRISE_TIERS[1];
}

export function normalizeFeatureKeys(value: unknown): PlatformFeatureKey[] | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<PlatformFeatureKey>();
  for (const item of value) {
    if (typeof item !== "string" || !featureKeys.has(item) || seen.has(item as PlatformFeatureKey)) {
      continue;
    }
    seen.add(item as PlatformFeatureKey);
  }
  return [...seen];
}

export function normalizeAddonSelections(value: unknown): PlatformAddonSelection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: PlatformAddonSelection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? "").trim() as PlatformAddonKey;
    const label = String(row.label ?? "").trim() || addonLabels.get(key) || "";
    const quantity = Math.max(1, Math.floor(Number(row.quantity ?? 1)));
    const rawPrice = row.unitPriceCents;
    const unitPriceCents =
      rawPrice == null || rawPrice === ""
        ? null
        : Math.max(0, Math.floor(Number(rawPrice)));

    if (!addonLabels.has(key) || !label || !Number.isFinite(quantity)) {
      continue;
    }
    if (rawPrice != null && rawPrice !== "" && !Number.isFinite(Number(rawPrice))) {
      continue;
    }

    out.push({
      key,
      label,
      quantity,
      unitPriceCents,
      notes: String(row.notes ?? "").trim() || undefined,
    });
  }
  return out;
}

export function applyCompanyFeatureEntitlementsToPermissionMap(
  permissionMap: PermissionMap,
  enabledFeatureKeys: PlatformFeatureKey[] | null | undefined
): PermissionMap {
  if (enabledFeatureKeys == null) {
    return permissionMap;
  }

  const enabled = new Set(enabledFeatureKeys);
  const next = { ...permissionMap };
  for (const feature of PLATFORM_FEATURES) {
    if (enabled.has(feature.key)) continue;
    for (const permission of feature.permissions) {
      next[permission] = false;
    }
  }
  return next;
}
