import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

type AuthorizeResult = Awaited<ReturnType<typeof authorizeRequest>>;
type AuthorizeSuccess = Exclude<AuthorizeResult, { error: Response }>;
export type SafetyIntelligenceAuthorized = AuthorizeSuccess & {
  companyScope: Awaited<ReturnType<typeof getCompanyScope>>;
};

export async function authorizeSafetyIntelligenceRequest(
  request: Request,
  options: Parameters<typeof authorizeRequest>[1] = {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data"],
  }
) {
  const auth = await authorizeRequest(request, options);
  if ("error" in auth) {
    return auth;
  }
  const resolved = auth as AuthorizeSuccess;

  const companyScope = await getCompanyScope({
    supabase: resolved.supabase,
    userId: resolved.user.id,
    fallbackTeam: resolved.team,
    authUser: resolved.user,
  });

  return {
    ...resolved,
    companyScope,
  };
}
