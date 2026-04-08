import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyMemory } from "@/lib/companyMemoryAccess";
import { findSimilarCompanyMemoryDraft } from "@/lib/companyMemory";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyMemory(auth.role)) {
    return NextResponse.json(
      { error: "Only company leads can check memory bank similarity." },
      { status: 403 }
    );
  }

  const rl = checkFixedWindowRateLimit(`company-memory-similar:${auth.user.id}`, {
    windowMs: 60_000,
    max: 40,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rl.retryAfterSec}s.` },
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
    return NextResponse.json({ error: "No company workspace is linked to this account." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const textBody = typeof body.body === "string" ? body.body : "";
  const excludeId = typeof body.excludeId === "string" ? body.excludeId.trim() : undefined;

  if (!title.trim() || !textBody.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const { candidate, error } = await findSimilarCompanyMemoryDraft(
    auth.supabase,
    companyScope.companyId,
    title,
    textBody,
    excludeId ? { excludeId } : undefined
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ similar: candidate });
}
