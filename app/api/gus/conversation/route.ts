import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  parseGusConversationRequest,
  runGusConversation,
} from "@/lib/gus/gusConversation";
import { updateGusSafetyPreferenceMemory } from "@/lib/gus/gusMemory";
import { authorizeRequest } from "@/lib/rbac";
import { buildGusCompanyContext, companyContextToString } from "@/lib/gus/gusCompanyContext";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = parseGusConversationRequest(body);

  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid Gus conversation payload.", details: parsed.errors },
      { status: 400 },
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  }).catch(() => ({ companyId: null }));
  const requestContext = parsed.request.context ?? {};
  const companyId = companyScope.companyId ?? requestContext.companyId ?? null;
  const jobsiteId = requestContext.jobsiteId ?? null;

  // Enrich GUS with live company safety data (non-blocking; degrades gracefully on failure)
  const companyCtx = await buildGusCompanyContext(auth.supabase, companyId).catch(() => null);
  const companySafetySnapshot = companyCtx ? companyContextToString(companyCtx) : undefined;

  const result = await runGusConversation({
    ...parsed.request,
    context: {
      ...requestContext,
      companyId: companyId ?? undefined,
      jobsiteId: jobsiteId ?? undefined,
      userId: auth.user.id,
      // Hydrate known GUS context fields from live data
      openCorrectiveActionCount: companyCtx?.openCaCount ?? requestContext.openCorrectiveActionCount,
      openHighPriorityActionCount: companyCtx?.sifOpenCount ?? requestContext.openHighPriorityActionCount,
      companySafetySnapshot,
    },
  });
  const safetyPreferences = updateGusSafetyPreferenceMemory(
    {
      companyId,
      jobsiteId,
      userId: auth.user.id,
    },
    result.response.safetyPreferences,
  );

  return NextResponse.json({
    ...result.response,
    safetyPreferences,
    blockedByRules: result.blockedByRules,
    validationFindings: result.validationFindings,
    actionDecisionTriggers: result.actionDecisionTriggers,
  });
}
