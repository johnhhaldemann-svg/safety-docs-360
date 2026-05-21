import { CompanySurfaceClient } from "../companies/[companyId]/_components/company-surface-client";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export default async function DocumentsPage() {
  const supabase = await createSupabaseRouteHandlerClient();
  if (!supabase) {
    return (
      <InlineMessage tone="warning">
        The company documents workspace could not connect to the server session.
      </InlineMessage>
    );
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return (
      <InlineMessage tone="warning">
        Sign in again to open the company documents workspace.
      </InlineMessage>
    );
  }

  const scope = await getCompanyScope({
    supabase,
    userId: user.id,
    fallbackTeam: (user.user_metadata as { team?: string } | undefined)?.team ?? "General",
    authUser: user,
  });

  if (!scope.companyId) {
    return (
      <InlineMessage tone="warning">
        No company workspace is linked to this account yet.
      </InlineMessage>
    );
  }

  return (
    <CompanySurfaceClient
      companyId={scope.companyId}
      surface="documents"
      title="Documents"
      description="Company-scoped documents, generated reports, and shared files."
    />
  );
}
