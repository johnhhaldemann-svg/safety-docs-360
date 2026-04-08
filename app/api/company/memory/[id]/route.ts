import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyMemory } from "@/lib/companyMemoryAccess";
import { deleteCompanyMemoryItem, updateCompanyMemoryItem } from "@/lib/companyMemory";
import { normalizeMemorySource } from "@/lib/companyMemory/repository";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyMemory(auth.role)) {
    return NextResponse.json({ error: "Only company leads can update memory bank entries." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`company-memory-write:${auth.user.id}`, {
    windowMs: 60_000,
    max: 30,
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
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Parameters<typeof updateCompanyMemoryItem>[1] = {
    companyId: companyScope.companyId,
    id,
    embed: body.embed !== false,
  };

  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.body === "string") patch.body = body.body;
  if (typeof body.source === "string") patch.source = normalizeMemorySource(body.source);
  if (body.metadata && typeof body.metadata === "object" && body.metadata !== null) {
    patch.metadata = body.metadata as Record<string, unknown>;
  }

  const { error } = await updateCompanyMemoryItem(auth.supabase, patch);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  serverLog("info", "company_memory_update", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    memoryItemId: id,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyMemory(auth.role)) {
    return NextResponse.json({ error: "Only company leads can delete memory bank entries." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`company-memory-write:${auth.user.id}`, {
    windowMs: 60_000,
    max: 30,
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

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  const { id } = await context.params;
  const { error } = await deleteCompanyMemoryItem(auth.supabase, companyScope.companyId, id);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  serverLog("info", "company_memory_delete", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    memoryItemId: id,
  });

  return NextResponse.json({ ok: true });
}
