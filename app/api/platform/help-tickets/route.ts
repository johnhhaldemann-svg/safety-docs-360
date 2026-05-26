import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  normalizePlatformHelpTicketRow,
  summarizePlatformHelpTickets,
  validatePlatformHelpTicketCreate,
} from "@/lib/platformHelpTickets";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 20) || 20, 50));

  const result = await auth.supabase
    .from("platform_help_tickets")
    .select("*")
    .eq("submitter_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const tickets = ((result.data ?? []) as Array<Record<string, unknown>>).map(
    normalizePlatformHelpTicketRow
  );

  return NextResponse.json({
    tickets,
    summary: summarizePlatformHelpTickets(tickets),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  const rateLimit = checkFixedWindowRateLimit(`platform-help-ticket:${auth.user.id}`, {
    windowMs: 10 * 60 * 1000,
    max: 5,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: `Too many help tickets. Retry in ${rateLimit.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const validation = validatePlatformHelpTicketCreate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const metadata =
    validation.value.metadata && typeof validation.value.metadata === "object"
      ? validation.value.metadata
      : {};
  const submitterName =
    typeof auth.user.user_metadata?.full_name === "string"
      ? auth.user.user_metadata.full_name.trim()
      : typeof auth.user.user_metadata?.name === "string"
        ? auth.user.user_metadata.name.trim()
        : "";

  const result = await auth.supabase
    .from("platform_help_tickets")
    .insert({
      submitter_user_id: auth.user.id,
      company_id: companyScope.companyId,
      submitter_email: auth.user.email ?? null,
      submitter_name: submitterName || auth.user.email?.split("@")[0] || null,
      submitter_role: auth.role,
      company_name: companyScope.companyName || null,
      category: validation.value.category,
      priority: validation.value.priority,
      title: validation.value.title,
      description: validation.value.description,
      page_url: validation.value.pageUrl,
      browser_user_agent: validation.value.browserUserAgent,
      metadata,
    })
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ticket: normalizePlatformHelpTicketRow(result.data as Record<string, unknown>) },
    { status: 201 }
  );
}

