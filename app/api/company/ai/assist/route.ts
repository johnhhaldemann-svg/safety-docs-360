import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canAccessCompanyMemoryAssist } from "@/lib/companyMemoryAccess";
import { runCompanyAiAssist, COMPANY_AI_ASSIST_DISCLAIMER } from "@/lib/companyMemory";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";
import { augmentStructuredContextWithRiskMemory } from "@/lib/riskMemory/structuredContext";

export const runtime = "nodejs";

function buildSalesDemoAssistText(surface: string, userMessage: string) {
  const area = (surface || "workspace").trim().replace(/[_-]+/g, " ").toLowerCase();
  const ask = userMessage.trim();
  const focus =
    ask.length > 0
      ? `Focus request: "${ask.length > 180 ? `${ask.slice(0, 177)}...` : ask}".`
      : "Focus request: general improvement guidance.";
  return [
    `Sales demo assist is active for ${area}.`,
    focus,
    "Recommended next steps:",
    "- Confirm high-risk work scope, permit links, and stop-work triggers before drafting.",
    "- Use plain, field-ready controls with owner and verification step for each hazard.",
    "- Prioritize recurring themes from demo analytics: fall protection, material handling, and electrical lockout.",
    "- End with a brief supervisor checklist for pre-task briefing and closeout verification.",
  ].join("\n");
}

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

  if (auth.role === "sales_demo") {
    return NextResponse.json({
      text: buildSalesDemoAssistText(surface, userMessage),
      disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
      retrieval: "none",
    });
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

  const mergedContext = await augmentStructuredContextWithRiskMemory(
    auth.supabase,
    companyScope.companyId,
    surface,
    structuredContext ?? null
  );

  try {
    const result = await runCompanyAiAssist(auth.supabase, companyScope.companyId, {
      surface,
      userMessage,
      structuredContext: mergedContext,
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
