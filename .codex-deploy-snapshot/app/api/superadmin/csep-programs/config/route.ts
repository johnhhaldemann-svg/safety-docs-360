import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCsepProgramConfig, saveCsepProgramConfig } from "@/lib/csepProgramSettings";
import { normalizeCsepProgramConfig } from "@/lib/csepPrograms";

export const runtime = "nodejs";

function requireSuperAdmin(role: string) {
  return role.trim().toLowerCase() === "super_admin";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const config = await getCsepProgramConfig(auth.supabase);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load CSEP program settings.",
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

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const config = normalizeCsepProgramConfig(body);
    const result = await saveCsepProgramConfig({
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
          error instanceof Error ? error.message : "Failed to save CSEP program settings.",
      },
      { status: 500 }
    );
  }
}
