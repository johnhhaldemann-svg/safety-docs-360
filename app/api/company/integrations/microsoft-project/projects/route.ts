import { NextResponse } from "next/server";
import {
  authorizeMicrosoftProjectRequest,
  demoMicrosoftProjectRows,
  isDemoMicrosoftProjectRequest,
  runtime,
} from "../_shared";

export { runtime };

export async function GET(request: Request) {
  const scoped = await authorizeMicrosoftProjectRequest(request);
  if ("error" in scoped) return scoped.error;
  if (isDemoMicrosoftProjectRequest(scoped.auth)) {
    return NextResponse.json(demoMicrosoftProjectRows);
  }

  const projects = await scoped.auth.supabase
    .from("company_microsoft_project_sources")
    .select(
      "id, source_system, source_project_id, name, project_number, status, start_date, end_date, owner_name, owner_email, jobsite_id, last_seen_at"
    )
    .eq("company_id", scoped.companyScope.companyId)
    .order("last_seen_at", { ascending: false })
    .limit(100);

  const tasks = await scoped.auth.supabase
    .from("company_microsoft_project_tasks")
    .select("id, project_source_id, source_task_id, title, status, percent_complete, priority, start_at, due_at, completed_at")
    .eq("company_id", scoped.companyScope.companyId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(250);

  if (projects.error) {
    return NextResponse.json({ error: projects.error.message || "Failed to load Microsoft Project imports." }, { status: 500 });
  }
  if (tasks.error) {
    return NextResponse.json({ error: tasks.error.message || "Failed to load Microsoft Project tasks." }, { status: 500 });
  }

  return NextResponse.json({ projects: projects.data ?? [], tasks: tasks.data ?? [] });
}
