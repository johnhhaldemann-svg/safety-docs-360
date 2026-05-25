import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  parseGusThoughtDraftRequest,
  runGusThoughtDraft,
} from "@/lib/gus/gusThoughtDraft";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = parseGusThoughtDraftRequest(body);

  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid Gus thought draft payload.", details: parsed.errors },
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
  const result = await runGusThoughtDraft({
    ...parsed.request,
    context: {
      ...requestContext,
      companyId: companyId ?? undefined,
      jobsiteId: jobsiteId ?? undefined,
      userId: auth.user.id,
    },
  });

  return NextResponse.json({
    ...result.response,
    blockedByRules: result.blockedByRules,
    validationFindings: result.validationFindings,
  });
}
