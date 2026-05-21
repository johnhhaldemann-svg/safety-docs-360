import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  defaultNotificationPreference,
  normalizeNotificationPreferenceRow,
} from "@/lib/companyNotifications";
import { authorizeRequest } from "@/lib/rbac";
import { DEFAULT_NOTIFICATION_EVENTS } from "@/types/product-depth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_reports", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ preferences: [] });
  }

  const result = await auth.supabase
    .from("company_notification_preferences")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("user_id", auth.user.id)
    .order("event_type", { ascending: true });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const saved = new Map(
    ((result.data ?? []) as Array<Record<string, unknown>>)
      .map(normalizeNotificationPreferenceRow)
      .map((preference) => [preference.eventType, preference])
  );

  const preferences = DEFAULT_NOTIFICATION_EVENTS.map((event) => {
    const existing = saved.get(event.eventType);
    if (existing) return existing;
    const defaults = defaultNotificationPreference(event.eventType);
    return {
      id: "",
      companyId: companyScope.companyId!,
      userId: auth.user.id,
      eventType: event.eventType,
      inAppEnabled: defaults.inAppEnabled,
      emailEnabled: defaults.emailEnabled,
      createdAt: "",
      updatedAt: "",
    };
  });

  return NextResponse.json({ preferences, catalog: DEFAULT_NOTIFICATION_EVENTS });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_reports", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        preferences?: Array<{
          eventType?: string;
          inAppEnabled?: boolean;
          emailEnabled?: boolean;
        }>;
      }
    | null;
  const rows = (body?.preferences ?? [])
    .map((preference) => ({
      company_id: companyScope.companyId,
      user_id: auth.user.id,
      event_type: String(preference.eventType ?? "").trim(),
      in_app_enabled: preference.inAppEnabled !== false,
      email_enabled: preference.emailEnabled === true,
    }))
    .filter((preference) => preference.event_type);

  if (rows.length === 0) {
    return NextResponse.json({ error: "At least one preference is required." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_notification_preferences")
    .upsert(rows, { onConflict: "company_id,user_id,event_type" })
    .select("*");

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: ((result.data ?? []) as Array<Record<string, unknown>>).map(normalizeNotificationPreferenceRow),
  });
}

