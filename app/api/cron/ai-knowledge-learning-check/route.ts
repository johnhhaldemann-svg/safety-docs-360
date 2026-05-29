import { NextResponse } from "next/server";
import { runAiKnowledgeLearningCheck } from "@/lib/aiKnowledgeMap/learningCheck";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 120;

function positiveInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("ai-knowledge-learning-check", async () => {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return {
        response: NextResponse.json({ error: "Service role client is required for AI learning checks." }, { status: 500 }),
        processedCount: 0,
      };
    }

    const url = new URL(request.url);
    const result = await runAiKnowledgeLearningCheck(admin, {
      trigger: "cron",
      force: url.searchParams.get("force") === "1",
      companyId: url.searchParams.get("companyId"),
      maxCompanies: positiveInteger(url.searchParams.get("maxCompanies"), 5, 25),
      maxDocuments: positiveInteger(url.searchParams.get("maxDocuments"), 16, 75),
      maxInternetSources: positiveInteger(url.searchParams.get("maxInternetSources"), 6, 25),
    });

    return {
      response: NextResponse.json(result),
      processedCount: result.companiesSeen,
      metadata: {
        skipped: result.skipped,
        runSlot: result.runSlot,
        documentsChecked: result.documentsChecked,
        internetSourcesChecked: result.internetSourcesChecked,
        candidatesCreated: result.candidatesCreated,
        failedSources: result.failedSources,
      },
    };
  });
}
