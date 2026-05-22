import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { recordGusFeedback } from "@/lib/gus/gusMemory";
import { parseGusFeedbackInput } from "@/lib/gus/gusScoring";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

async function getRequestScope(auth: Awaited<ReturnType<typeof authorizeRequest>>) {
  if ("error" in auth) return { companyId: null, userId: null };

  try {
    const companyScope = await getCompanyScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });

    return {
      companyId: companyScope.companyId,
      userId: auth.user.id,
    };
  } catch {
    return {
      companyId: null,
      userId: auth.user.id,
    };
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = parseGusFeedbackInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid Gus feedback payload.", details: parsed.errors }, { status: 400 });
  }

  const scope = await getRequestScope(auth);
  const result = recordGusFeedback(scope, parsed.feedback);

  return NextResponse.json({
    success: true,
    interactionId: parsed.feedback.interactionId,
    scoreDelta: result.scoreDelta,
    previousScore: result.previousScore,
    totalScore: result.totalScore,
    learning: {
      mayPrioritizeMessages: true,
      mayOverrideSafetyRules: false,
      mayApproveWork: false,
      maySuppressCriticalWarnings: false,
      genericTipsShowLessOften: result.totalScore < -0.3,
      usefulRemindersShowMoreOften: result.totalScore > 0.3,
    },
  });
}

