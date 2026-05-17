import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { recordCompanySecurityEvent } from "@/lib/companySecurityEvents";
import { getClientIpAddress } from "@/lib/legal";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_reports",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const filePath = String(body?.filePath ?? "").trim();
  if (!filePath) {
    return NextResponse.json({ error: "Report file path is required." }, { status: 400 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const companyPrefix = `companies/${companyScope.companyId}/`;
  if (!filePath.startsWith(companyPrefix)) {
    return NextResponse.json({ error: "Report file is outside this company workspace." }, { status: 403 });
  }

  const storageClient = createSupabaseAdminClient() ?? auth.supabase;
  const signed = await storageClient.storage.from("documents").createSignedUrl(filePath, 120);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message || "Failed to create report export link." },
      { status: 500 }
    );
  }

  await recordCompanySecurityEvent({
    supabase: storageClient,
    companyId: companyScope.companyId,
    actorUserId: auth.user.id,
    actorRole: auth.role,
    eventType: "report_export_link_created",
    resourceType: "report",
    resourceId: filePath,
    title: "Report export link created",
    detail: "A signed report export link was created.",
    ipAddress: getClientIpAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      filePath,
      bucket: "documents",
      signedUrlTtlSeconds: 120,
    },
  });

  return NextResponse.json({ signedUrl: signed.data.signedUrl });
}
