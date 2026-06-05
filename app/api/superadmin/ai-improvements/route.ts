import { NextResponse } from "next/server";
import {
  createAiImprovementRequest,
  listAiImprovementRequests,
} from "@/lib/superadmin/aiImprovementRequests";
import {
  getAiImprovementClient,
  requestIpAddress,
  requestUserAgent,
  requireAiImprovementSuperadmin,
} from "./_shared";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { recallApprovabilityBatch } from "@/lib/aiApprovalRecall";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 100);
  const client = getAiImprovementClient(auth.supabase);
  const requests = await listAiImprovementRequests(client, limit);

  // Attach an approvability recall verdict from the memory bank (best-effort).
  const memoryClient = createSupabaseAdminClient();
  const verdicts = memoryClient
    ? await recallApprovabilityBatch(
        memoryClient,
        "ai_improvement",
        requests.map((req) => ({
          id: req.id,
          sourceType: "ai_improvement_request",
          category: req.affected_area,
          content: [req.title, req.description].filter(Boolean).join(" — "),
        }))
      )
    : new Map();
  const requestsWithRecall = requests.map((req) => ({ ...req, recall: verdicts.get(req.id) ?? null }));

  return NextResponse.json(
    { requests: requestsWithRecall },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const auth = await requireAiImprovementSuperadmin(request);
  if (auth instanceof Response) return auth;
  if (!auth) return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });

  try {
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const client = getAiImprovementClient(auth.supabase);
    const improvement = await createAiImprovementRequest({
      client,
      input,
      actor: { id: auth.user.id, type: "user", role: auth.role },
      ipAddress: requestIpAddress(request),
      userAgent: requestUserAgent(request),
    });

    return NextResponse.json({ request: improvement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create AI improvement request." },
      { status: 400 }
    );
  }
}
