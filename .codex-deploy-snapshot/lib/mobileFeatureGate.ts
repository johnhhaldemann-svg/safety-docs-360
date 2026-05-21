import { NextResponse } from "next/server";
import {
  resolveMobileFeatureMap,
  type MobileFeature,
  type MobileFeatureOverride,
} from "@/lib/mobileEntitlements";
import type { PermissionMap } from "@/lib/rbac";

type MobileFeatureAuth = {
  role: string;
  permissionMap?: PermissionMap | null;
  user: { id: string };
  supabase: {
    from: (table: string) => unknown;
  };
};

function isMissingEntitlementTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_mobile_feature_entitlements");
}

async function loadMobileFeatureOverrides(params: {
  auth: MobileFeatureAuth;
  companyId: string;
}) {
  const companyQuery = params.auth.supabase.from("company_mobile_feature_entitlements") as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        is: (column: string, value: null) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
      };
    };
  };

  const companyResult = await companyQuery
    .select("feature, enabled")
    .eq("company_id", params.companyId)
    .is("user_id", null);

  if (companyResult.error) {
    if (isMissingEntitlementTable(companyResult.error.message)) {
      return { companyOverrides: [], userOverrides: [] };
    }
    return { companyOverrides: [], userOverrides: [] };
  }

  const userQuery = params.auth.supabase.from("company_mobile_feature_entitlements") as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
      };
    };
  };
  const userResult = await userQuery
    .select("feature, enabled")
    .eq("company_id", params.companyId)
    .eq("user_id", params.auth.user.id);

  return {
    companyOverrides: (companyResult.data as MobileFeatureOverride[] | null) ?? [],
    userOverrides: !userResult.error ? ((userResult.data as MobileFeatureOverride[] | null) ?? []) : [],
  };
}

export async function requireMobileFeature(params: {
  auth: MobileFeatureAuth;
  companyId: string;
  feature: MobileFeature;
}) {
  const overrides = await loadMobileFeatureOverrides({
    auth: params.auth,
    companyId: params.companyId,
  });
  const featureMap = resolveMobileFeatureMap({
    role: params.auth.role,
    permissionMap: params.auth.permissionMap,
    companyOverrides: overrides.companyOverrides,
    userOverrides: overrides.userOverrides,
  });

  if (featureMap[params.feature]) return null;
  return NextResponse.json({ error: "Mobile feature is not enabled for this account." }, { status: 403 });
}
