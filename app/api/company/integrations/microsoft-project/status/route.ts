import { NextResponse } from "next/server";
import { getMicrosoftProjectStatus } from "@/lib/microsoftProject";
import {
  authorizeMicrosoftProjectRequest,
  demoMicrosoftProjectStatus,
  isDemoMicrosoftProjectRequest,
  runtime,
} from "../_shared";

export { runtime };

export async function GET(request: Request) {
  const scoped = await authorizeMicrosoftProjectRequest(request);
  if ("error" in scoped) return scoped.error;
  if (isDemoMicrosoftProjectRequest(scoped.auth)) {
    return NextResponse.json(demoMicrosoftProjectStatus);
  }

  const status = await getMicrosoftProjectStatus({
    supabase: scoped.auth.supabase,
    companyId: scoped.companyScope.companyId,
  });
  return NextResponse.json(status);
}
