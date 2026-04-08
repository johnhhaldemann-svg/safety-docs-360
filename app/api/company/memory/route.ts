import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import {
  canAccessCompanyMemoryAssist,
  canMutateCompanyMemory,
} from "@/lib/companyMemoryAccess";
import {
  insertCompanyMemoryItem,
  listCompanyMemoryItems,
  normalizeMemorySource,
} from "@/lib/companyMemory";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canAccessCompanyMemoryAssist(auth.role)) {
    return NextResponse.json({ error: "You do not have access to company memory." }, { status: 403 });
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
    return NextResponse.json({ items: [] });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const { items, error } = await listCompanyMemoryItems(auth.supabase, companyScope.companyId, {
    limit,
    offset,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    items,
    capabilities: { canMutate: canMutateCompanyMemory(auth.role) },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyMemory(auth.role)) {
    return NextResponse.json(
      { error: "Only company leads can add memory bank entries." },
      { status: 403 }
    );
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
  if (!title.trim() || !textBody.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const source = normalizeMemorySource(typeof body.source === "string" ? body.source : "manual");
  const metadata =
    body.metadata && typeof body.metadata === "object" && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : {};

  const { id, error } = await insertCompanyMemoryItem(auth.supabase, {
    companyId: companyScope.companyId,
    source,
    title,
    body: textBody,
    metadata,
    userId: auth.user.id,
    embed: body.embed !== false,
  });

  if (error || !id) {
    return NextResponse.json({ error: error ?? "Failed to save memory item." }, { status: 500 });
  }

  serverLog("info", "company_memory_write", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    memoryItemId: id,
  });

  return NextResponse.json({ id });
}
