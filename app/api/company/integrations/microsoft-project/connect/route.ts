import { NextResponse } from "next/server";
import { buildMicrosoftAuthorizeUrl } from "@/lib/microsoftProject";
import {
  authorizeMicrosoftProjectRequest,
  isDemoMicrosoftProjectRequest,
} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const scoped = await authorizeMicrosoftProjectRequest(request, { requireManage: true });
  if ("error" in scoped) return scoped.error;
  if (isDemoMicrosoftProjectRequest(scoped.auth)) {
    return NextResponse.json({ authorizationUrl: "/company-integrations?microsoftProject=demo-connected" });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const dataverseEnvironmentUrl =
    typeof body?.dataverseEnvironmentUrl === "string" ? body.dataverseEnvironmentUrl : null;
  const returnTo = typeof body?.returnTo === "string" ? body.returnTo : "/company-integrations";

  try {
    const authUrl = buildMicrosoftAuthorizeUrl({
      companyId: scoped.companyScope.companyId,
      userId: scoped.auth.user.id,
      dataverseEnvironmentUrl,
      returnTo,
    });
    return NextResponse.json(authUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Microsoft connector is not configured." },
      { status: 503 }
    );
  }
}
