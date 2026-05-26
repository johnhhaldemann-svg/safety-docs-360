import { NextResponse } from "next/server";
import {
  mergeGusNotificationSettings,
  normalizeGusNotificationSettings,
} from "@/lib/gus/gusNotificationSettings";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type SettingsRow = {
  gus_notification_settings?: unknown;
};

type GusSettingsSupabase = {
  from?: unknown;
};

function settingsPayload(settings: unknown) {
  return { settings: normalizeGusNotificationSettings(settings) };
}

function canReadSettingsProfile(supabase: unknown): supabase is { from: (table: string) => unknown } {
  return typeof (supabase as GusSettingsSupabase | null)?.from === "function";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  if (!canReadSettingsProfile(auth.supabase)) {
    return NextResponse.json(settingsPayload(null));
  }

  const result = await auth.supabase
    .from("user_profiles")
    .select("gus_notification_settings")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load Gus notification settings." }, { status: 500 });
  }

  return NextResponse.json(settingsPayload((result.data as SettingsRow | null)?.gus_notification_settings));
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | {
        settings?: unknown;
      }
    | null;
  const incoming = body && "settings" in body ? body.settings : body;

  if (!canReadSettingsProfile(auth.supabase)) {
    return NextResponse.json(settingsPayload(incoming));
  }

  const currentResult = await auth.supabase
    .from("user_profiles")
    .select("gus_notification_settings")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (currentResult.error) {
    return NextResponse.json({ error: currentResult.error.message || "Failed to load Gus notification settings." }, { status: 500 });
  }

  const settings = mergeGusNotificationSettings(
    (currentResult.data as SettingsRow | null)?.gus_notification_settings,
    incoming,
  );

  const result = await auth.supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: auth.user.id,
        gus_notification_settings: settings,
      },
      { onConflict: "user_id" },
    )
    .select("gus_notification_settings")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to save Gus notification settings." }, { status: 500 });
  }

  return NextResponse.json(settingsPayload((result.data as SettingsRow | null)?.gus_notification_settings ?? settings));
}
