import { NextResponse } from "next/server";
import { buildMicrosoftAuthorizeUrl } from "@/lib/microsoftProject";
import {
  authorizeMicrosoftProjectRequest,
  isDemoMicrosoftProjectRequest,
} from "../_shared";

export const runtime = "nodejs";

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/company-integrations";
}

export async function POST(request: Request) {
  const scoped = await authorizeMicrosoftProjectRequest(request, { requireManage: true });
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const returnTo = safeReturnTo(body?.returnTo);

  if (isDemoMicrosoftProjectRequest(scoped.auth)) {
    return NextResponse.json({ authorizationUrl: `${returnTo}?microsoftProject=demo-connected` });
  }

  const dataverseEnvironmentUrl =
    typeof body?.dataverseEnvironmentUrl === "string" ? body.dataverseEnvironmentUrl : null;

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
