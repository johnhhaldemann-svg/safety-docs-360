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

/** JSON string matching {@link parseCsepWeatherSectionAiResponse} so CSEP "Smart fill weather" works for sales_demo. */
function buildSalesDemoCsepWeatherAssistJson() {
  return JSON.stringify({
    monitoringSources: ["NOAA Weather Radio", "Site wind meter", "GC weather and lightning alerts"],
    communicationMethods: ["Supervisor radio", "GC portal notices", "Start-of-shift huddle"],
    highWindThresholdText:
      "Suspend decking, picks, and loose material when sustained winds exceed 25 mph or gusts exceed 35 mph; GC concurrence before restart.",
    lightningShelterNotes:
      "Use designated hard shelters only; vehicles and open sheds are not shelter. Lower crane boom and clear steel when within site lightning policy.",
    lightningRadiusMiles: 8,
    lightningAllClearMinutes: 30,
    heatTriggerText:
      "Heat index at or above 90°F triggers hydrated rotations, shade breaks every 45 minutes, and buddy checks.",
    coldTriggerText:
      "Wind chill below 15°F triggers cold PPE verification, equipment warm-up, and 10-minute warm shelters each hour.",
    tornadoStormShelterNotes:
      "Account for all personnel in marked refuge; radio GC when warning expires and before returning to steel or crane work.",
    unionAccountabilityNotes:
      "Stewards confirm crew acknowledgment of weather holds; superintendent signs daily readiness log.",
    dailyReviewNotes:
      "Review forecast at shift start and after lunch; update board with wind/lightning status for crane and picks.",
    projectOverrideNotes: ["Riverfront exposure can exceed forecast—spot-read wind at deck edge before erection."],
    highWindControls: ["Secure deck bundles", "Pause crane and MEWP", "Inspect perimeter netting"],
    heatControls: ["Ice water and electrolytes", "Misting respite area"],
    coldControls: ["Heated break room", "Fuel gel checks"],
    tornadoStormControls: ["Siren and radio cascade", "Crane boom tied per ERP"],
    environmentalControls: ["Dust control when winds drop after hold"],
    contractorResponsibilityNotes: ["Superintendent stops work and notifies GC within 15 minutes of threshold breach."],
  });
}

function normalizeAssistContextString(context: unknown): string | null {
  if (typeof context === "string" && context.trim()) {
    return context;
  }
  if (context !== undefined && context !== null && typeof context === "object") {
    try {
      return JSON.stringify(context);
    } catch {
      return null;
    }
  }
  return null;
}

function getCsepAiSectionKindFromContext(contextJson: string | null): string | null {
  if (!contextJson) return null;
  try {
    const parsed = JSON.parse(contextJson) as { ai_section?: { kind?: string } };
    const kind = parsed?.ai_section?.kind;
    return typeof kind === "string" ? kind : null;
  } catch {
    return null;
  }
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
    const contextJson = normalizeAssistContextString(body.context);
    const aiKind = getCsepAiSectionKindFromContext(contextJson);
    if (surface === "csep" && aiKind === "weather") {
      return NextResponse.json({
        text: buildSalesDemoCsepWeatherAssistJson(),
        disclaimer: COMPANY_AI_ASSIST_DISCLAIMER,
        retrieval: "none",
      });
    }
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
