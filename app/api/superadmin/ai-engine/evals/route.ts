import { NextResponse } from "next/server";
import { getAiEngineEvalSummary } from "@/lib/superadmin/aiEngineOperations";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  return NextResponse.json(getAiEngineEvalSummary());
}
