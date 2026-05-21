import { NextResponse } from "next/server";
import {
  buildSurveyTestExportPayload,
  type SurveyTestFormData,
} from "@/lib/csepSurveyTest";
import { authorizeRequest } from "@/lib/rbac";
import { generateCsepDocx } from "@/app/api/csep/export/route";

export const runtime = "nodejs";

function requireSuperAdmin(role: string) {
  return role.trim().toLowerCase() === "super_admin";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SurveyTestFormData;
    return await generateCsepDocx(buildSurveyTestExportPayload(body), {
      supabase: auth.supabase,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Survey Test CSEP export.",
      },
      { status: 500 }
    );
  }
}
