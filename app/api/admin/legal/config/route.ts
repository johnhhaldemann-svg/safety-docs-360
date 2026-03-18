import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { normalizeAgreementConfig, getAgreementConfig, saveAgreementConfig } from "@/lib/legalSettings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const config = await getAgreementConfig(auth.supabase);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load agreement configuration.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const config = normalizeAgreementConfig(body);
    const result = await saveAgreementConfig({
      supabase: auth.supabase,
      actorUserId: auth.user.id,
      config,
    });

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save agreement configuration.",
      },
      { status: 500 }
    );
  }
}
