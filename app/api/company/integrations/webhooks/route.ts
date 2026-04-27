import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

function canManageIntegrations(role: string) {
  return isAdminRole(role) || role === "company_admin";
}

function maskSecret(secret: string) {
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });
  if ("error" in auth) return auth.error;
  const isDemoRequest =
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    return NextResponse.json({
      webhooks: [
        {
          id: "demo-webhook-1",
          company_id: "demo-company",
          name: "Safety Demo Receiver",
          target_url: "https://webhook.site/demo-safety360",
          active: true,
          secretPreview: "demo…hook",
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
  if (!companyScope.companyId) return NextResponse.json({ webhooks: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const res = await auth.supabase
    .from("company_integration_webhooks")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });

  if (res.error) {
    return NextResponse.json({ webhooks: [], warning: res.error.message });
  }

  const webhooks = (res.data ?? []).map((row) => {
    const { secret, ...rest } = row as Record<string, unknown> & { secret?: string };
    return {
      ...rest,
      secretPreview: maskSecret(String(secret ?? "")),
    };
  });

  return NextResponse.json({ webhooks });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });
  if ("error" in auth) return auth.error;
  const isDemoRequest =
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    return NextResponse.json({
      webhook: {
        id: `demo-webhook-${Date.now()}`,
        company_id: "demo-company",
        name: String(body?.name ?? "Demo webhook"),
        target_url: String(body?.targetUrl ?? "https://webhook.site/demo-safety360"),
        event_types: Array.isArray(body?.eventTypes) ? body?.eventTypes : ["ping"],
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      secret: "demo-signing-secret",
      note: "Demo webhook created. This environment does not deliver real outbound traffic.",
    });
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  const targetUrl = String(body?.targetUrl ?? "").trim();
  const eventTypes = Array.isArray(body?.eventTypes) ? body!.eventTypes : [];

  if (!name || !targetUrl) {
    return NextResponse.json({ error: "name and targetUrl are required." }, { status: 400 });
  }

  const secret = randomBytes(24).toString("hex");

  const ins = await auth.supabase
    .from("company_integration_webhooks")
    .insert({
      company_id: companyScope.companyId,
      name,
      target_url: targetUrl,
      secret,
      event_types: eventTypes,
      active: body?.active !== false,
      created_by: auth.user.id,
    })
    .select("id, company_id, name, target_url, event_types, active, created_at, updated_at")
    .single();

  if (ins.error || !ins.data) {
    return NextResponse.json({ error: ins.error?.message || "Create failed." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "integrations",
    record_id: ins.data.id,
    event_type: "webhook_created",
    detail: "Integration webhook registered.",
    event_payload: { name },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    webhook: ins.data,
    secret,
    note: "Store this secret securely; it will not be shown again in full.",
  });
}
