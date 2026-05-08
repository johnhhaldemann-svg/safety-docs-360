import { NextResponse } from "next/server";
import { runMicrosoftProjectSync } from "@/lib/microsoftProject";
import {
  authorizeMicrosoftProjectRequest,
  isDemoMicrosoftProjectRequest,
  runtime,
} from "../_shared";

export { runtime };

export async function POST(request: Request) {
  const scoped = await authorizeMicrosoftProjectRequest(request, { requireManage: true });
  if ("error" in scoped) return scoped.error;
  if (isDemoMicrosoftProjectRequest(scoped.auth)) {
    return NextResponse.json({
      status: "succeeded",
      projectsSeen: 2,
      projectsImported: 2,
      tasksSeen: 8,
      tasksImported: 8,
      assignmentsSeen: 4,
      assignmentsImported: 4,
      warnings: [],
    });
  }

  try {
    const result = await runMicrosoftProjectSync({
      supabase: scoped.auth.supabase,
      companyId: scoped.companyScope.companyId,
      actorUserId: scoped.auth.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Microsoft Project sync failed." },
      { status: 500 }
    );
  }
}
