import { NextResponse } from "next/server";
import { authorizeRequest, formatAppRole, getUserRoleContext } from "@/lib/rbac";
import { getDefaultAgreementConfig, getUserAgreementRecord } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";

export const runtime = "nodejs";

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Unnamed User";
}

type AgreementAuditRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  acceptedTerms: boolean;
  acceptedAt: string | null;
  ipAddress: string | null;
  termsVersion: string | null;
  isCurrentVersion: boolean;
  createdAt: string | null;
};

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const usersResult = await auth.supabase.auth.admin.listUsers();

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }

  const agreementConfig = await getAgreementConfig(auth.supabase).catch(() =>
    getDefaultAgreementConfig()
  );

  const rows = await Promise.all(
    (usersResult.data.users ?? []).map(async (user) => {
      const [roleContext, agreementResult] = await Promise.all([
        getUserRoleContext({
          supabase: auth.supabase,
          user,
        }),
        getUserAgreementRecord(
          auth.supabase,
          user.id,
          user.user_metadata ?? undefined
        ),
      ]);

      const row: AgreementAuditRow = {
        id: user.id,
        name: getDisplayName(user),
        email: user.email ?? "",
        role: formatAppRole(roleContext.role),
        team: roleContext.team,
        acceptedTerms: Boolean(agreementResult.data?.accepted_terms),
        acceptedAt: agreementResult.data?.accepted_at ?? null,
        ipAddress: agreementResult.data?.ip_address ?? null,
        termsVersion: agreementResult.data?.terms_version ?? null,
        isCurrentVersion: agreementResult.data?.terms_version === agreementConfig.version,
        createdAt: user.created_at ?? null,
      };

      return row;
    })
  );

  const acceptedCount = rows.filter((row) => row.acceptedTerms).length;
  const currentVersionCount = rows.filter(
    (row) => row.acceptedTerms && row.isCurrentVersion
  ).length;
  const outdatedCount = rows.filter(
    (row) => row.acceptedTerms && !row.isCurrentVersion
  ).length;
  const pendingCount = rows.filter((row) => !row.acceptedTerms).length;

  return NextResponse.json({
    termsVersion: agreementConfig.version,
    summary: {
      totalUsers: rows.length,
      acceptedCount,
      pendingCount,
      currentVersionCount,
      outdatedCount,
    },
    agreements: rows.sort((a, b) => {
      const aTime = a.acceptedAt ? new Date(a.acceptedAt).getTime() : 0;
      const bTime = b.acceptedAt ? new Date(b.acceptedAt).getTime() : 0;
      return bTime - aTime;
    }),
  });
}
