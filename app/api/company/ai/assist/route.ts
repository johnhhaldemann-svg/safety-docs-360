import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canAccessCompanyMemoryAssist } from "@/lib/companyMemoryAccess";
import { runCompanyAiAssist, COMPANY_AI_ASSIST_DISCLAIMER } from "@/lib/companyMemory";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canAccessCompanyMemoryAssist(auth.role)) {
    return NextResponse.json({ error: "You do not have access to the company AI assistant." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`company-ai-assist:${auth.user.id}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many AI requests. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company context for AI assist." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessage = typeof body.message === "string" ? body.message : "";
  const surface = typeof body.surface === "string" ? body.surface : "default";
  const structuredContext =
    typeof body.context === "string" ? body.context : body.context === null ? null : undefined;
  const topK = typeof body.topK === "number" ? body.topK : undefined;

  try {
    const result = await runCompanyAiAssist(auth.supabase, companyScope.companyId, {
      surface,
      userMessage,
      structuredContext: structuredContext ?? null,
      topK,
    });

    serverLog("info", "company_ai_assist", {
      companyId: companyScope.companyId,
      userId: auth.user.id,
      surface,
      retrieval: result.retrieval,
    });

    return NextResponse.json({
      text: result.text,
      disclaimer: result.disclaimer,
      retrieval: result.retrieval,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI assist failed.";
    serverLog("error", "company_ai_assist_error", {
      companyId: companyScope.companyId,
      userId: auth.user.id,
      message: msg.slice(0, 200),
    });
    return NextResponse.json(
      { error: msg, disclaimer: COMPANY_AI_ASSIST_DISCLAIMER },
      { status: 500 }
    );
  }
}
