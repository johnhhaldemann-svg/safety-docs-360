import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { autoAssignSchedulePermits } from "@/lib/schedulePermitAutoAssignment";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 120;

type JobsiteRow = {
  id: string;
  company_id: string;
  status: string | null;
};

type CronJobsiteResult =
  | {
      companyId: string;
      jobsiteId: string;
      status: "processed";
      createdPermits: number;
      skippedPermits: number;
      unassignedPermits: number;
    }
  | {
      companyId: string;
      jobsiteId: string;
      status: "failed";
      error: string;
    };

function isActiveJobsite(row: JobsiteRow) {
  const status = String(row.status ?? "").trim().toLowerCase();
  return !["archived", "closed", "completed", "inactive"].includes(status);
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("ai-engine-permit-auto-assign", async () => {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return {
      response: NextResponse.json(
        { error: "Missing Supabase service role key for AI permit auto-assignment." },
        { status: 500 }
      ),
    };
  }

  const jobsiteResult = await adminClient
    .from("company_jobsites")
    .select("id, company_id, status")
    .is("archived_at", null)
    .limit(500);

  if (jobsiteResult.error) {
    return {
      response: NextResponse.json(
        { error: jobsiteResult.error.message || "Failed to load jobsites." },
        { status: 500 }
      ),
    };
  }

  const jobsites = ((jobsiteResult.data ?? []) as JobsiteRow[]).filter(isActiveJobsite);
  const results: CronJobsiteResult[] = [];

  for (const jobsite of jobsites) {
    const result = await autoAssignSchedulePermits({
      supabase: adminClient,
      profileClient: adminClient,
      companyId: jobsite.company_id,
      jobsiteId: jobsite.id,
      scope: "weekly",
      actorUserId: null,
    });

    if (result.success) {
      results.push({
        companyId: jobsite.company_id,
        jobsiteId: jobsite.id,
        status: "processed",
        createdPermits: result.createdPermits.length,
        skippedPermits: result.skippedPermits.length,
        unassignedPermits: result.unassignedPermits.length,
      });
      continue;
    }

    results.push({
      companyId: jobsite.company_id,
      jobsiteId: jobsite.id,
      status: "failed",
      error: result.error,
    });
  }

  const failed = results.filter((result) => result.status === "failed").length;
  return {
    response: NextResponse.json(
      {
      ok: failed === 0,
      scope: "weekly",
      attempted: results.length,
      succeeded: results.length - failed,
      failed,
      createdPermits: results.reduce((sum, result) => sum + (result.status === "processed" ? result.createdPermits : 0), 0),
      skippedPermits: results.reduce((sum, result) => sum + (result.status === "processed" ? result.skippedPermits : 0), 0),
      unassignedPermits: results.reduce((sum, result) => sum + (result.status === "processed" ? result.unassignedPermits : 0), 0),
      results,
      },
      { status: failed > 0 ? 500 : 200 }
    ),
    processedCount: results.length,
    metadata: {
      succeeded: results.length - failed,
      failed,
      createdPermits: results.reduce((sum, result) => sum + (result.status === "processed" ? result.createdPermits : 0), 0),
    },
  };
  });
}
