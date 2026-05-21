import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canManageIntegrations(role: string) {
  return isAdminRole(role) || role === "company_admin";
}

function maskSecret(secret: string) {
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_company_users",
  });
  if ("error" in auth) return auth.error;
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

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.targetUrl === "string") patch.target_url = body.targetUrl.trim();
  if (Array.isArray(body.eventTypes)) {
    patch.event_types = body.eventTypes.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  const rotatedSecret = body.rotateSecret === true ? randomBytes(24).toString("hex") : null;
  if (rotatedSecret) patch.secret = rotatedSecret;

  const res = await auth.supabase
    .from("company_integration_webhooks")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("id, company_id, name, target_url, event_types, active, secret, created_at, updated_at")
    .maybeSingle();

  if (res.error || !res.data) {
    return NextResponse.json({ error: res.error?.message || "Not found." }, { status: 404 });
  }
  const { secret, ...webhook } = res.data as Record<string, unknown> & { secret?: string };
  return NextResponse.json({
    webhook: {
      ...webhook,
      secretPreview: maskSecret(String(secret ?? "")),
    },
    secret: rotatedSecret,
    note: rotatedSecret ? "Signing secret rotated. Store the new value securely; it will not be shown again." : undefined,
  });
}
