import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

function canManageIntegrations(role: string) {
  return isAdminRole(role) || role === "company_admin";
}

/** GET delivery log for a webhook (newest first). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });
  if ("error" in auth) return auth.error;
  const isDemoRequest =
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const { id: webhookId } = await params;
    return NextResponse.json({
      deliveries: [
        {
          id: "demo-delivery-1",
          company_id: "demo-company",
          webhook_id: webhookId,
          event_type: "ping",
          response_status: 202,
          delivered_at: new Date().toISOString(),
        },
      ],
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ deliveries: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: webhookId } = await params;

  const hook = await auth.supabase
    .from("company_integration_webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (hook.error || !hook.data) {
    return NextResponse.json({ deliveries: [] });
  }

  const res = await auth.supabase
    .from("company_integration_webhook_deliveries")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("delivered_at", { ascending: false })
    .limit(100);

  if (res.error) {
    return NextResponse.json({ deliveries: [], warning: res.error.message });
  }
  return NextResponse.json({ deliveries: res.data ?? [] });
}

/** POST test delivery: body `{ "eventType": "ping", "payload": {} }` */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });
  if ("error" in auth) return auth.error;
  const isDemoRequest =
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    return NextResponse.json({ ok: true, responseStatus: 202 });
  }
  if (!canManageIntegrations(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: webhookId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const eventType = String(body?.eventType ?? "ping").trim() || "ping";
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};

  const hookRes = await auth.supabase
    .from("company_integration_webhooks")
    .select("*")
    .eq("id", webhookId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (hookRes.error || !hookRes.data) {
    return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
  }

  const hook = hookRes.data as { target_url: string; secret: string; active: boolean };
  if (!hook.active) {
    return NextResponse.json({ error: "Webhook is inactive." }, { status: 400 });
  }

  const bodyStr = JSON.stringify({ eventType, payload, companyId: companyScope.companyId });
  const sig = createHmac("sha256", hook.secret).update(bodyStr).digest("hex");

  let responseStatus: number | null = null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const resp = await fetch(hook.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Safety360-Signature": `sha256=${sig}`,
      },
      body: bodyStr,
      signal: ac.signal,
    });
    clearTimeout(t);
    responseStatus = resp.status;
  } catch {
    responseStatus = 0;
  }

  await auth.supabase.from("company_integration_webhook_deliveries").insert({
    company_id: companyScope.companyId,
    webhook_id: webhookId,
    event_type: eventType,
    payload: payload as Record<string, unknown>,
    response_status: responseStatus,
  });

  return NextResponse.json({ ok: true, responseStatus });
}
