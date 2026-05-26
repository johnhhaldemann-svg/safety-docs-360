import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { createCompanyNotification } from "@/lib/companyNotifications";
import { sendGusEmailNotification } from "@/lib/gus/gusEmailNotifications";
import {
  isGusCriticalSafetyNotification,
  normalizeGusNotificationSettings,
  shouldPersistGusInAppNotification,
} from "@/lib/gus/gusNotificationSettings";
import { APP_BRAND } from "@/lib/appBrand";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type GusEmailBody = {
  confirmed?: boolean;
  subject?: string;
  message?: string;
  reason?: string;
  actionLabel?: string;
  actionHref?: string;
  jobsiteName?: string;
  priority?: number;
  category?: string;
  attentionLevel?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_reports", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const rawBody = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(rawBody)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const body: GusEmailBody = {
    confirmed: rawBody.confirmed === true,
    subject: stringValue(rawBody.subject),
    message: stringValue(rawBody.message),
    reason: stringValue(rawBody.reason),
    actionLabel: stringValue(rawBody.actionLabel),
    actionHref: stringValue(rawBody.actionHref),
    jobsiteName: stringValue(rawBody.jobsiteName),
    priority: numberValue(rawBody.priority),
    category: stringValue(rawBody.category),
    attentionLevel: stringValue(rawBody.attentionLevel),
  };

  const toEmail = auth.user.email?.trim().toLowerCase() ?? "";
  if (!toEmail) {
    return NextResponse.json({ error: "Your account needs an email address before Gus can send email notifications." }, { status: 400 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const settingsResult = await auth.supabase
    .from("user_profiles")
    .select("gus_notification_settings")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message || "Failed to load Gus notification settings." }, { status: 500 });
  }

  const settings = normalizeGusNotificationSettings(
    (settingsResult.data as { gus_notification_settings?: unknown } | null)?.gus_notification_settings,
  );
  if (!settings.emailEnabled) {
    return NextResponse.json({ error: "Gus email notifications are turned off in your profile." }, { status: 403 });
  }

  const notificationSignal = {
    priority: body.priority,
    category: body.category,
    attentionLevel: body.attentionLevel,
  };

  const result = await sendGusEmailNotification({
    toEmail,
    companyName: companyScope.companyName,
    jobsiteName: body.jobsiteName,
    senderName: auth.user.email ?? `${APP_BRAND.productName} user`,
    subject: body.subject,
    message: body.message ?? "",
    reason: body.reason,
    actionLabel: body.actionLabel,
    actionHref: body.actionHref,
    confirmed: body.confirmed === true,
  });

  if (result.status === "blocked") {
    return NextResponse.json({ error: result.warning }, { status: 400 });
  }

  if (companyScope.companyId) {
    const shouldPersistNotification = shouldPersistGusInAppNotification(settings, notificationSignal);
    if (shouldPersistNotification) {
      await createCompanyNotification({
        supabase: auth.supabase,
        companyId: companyScope.companyId,
        recipientUserId: auth.user.id,
        actorUserId: auth.user.id,
        eventType: "gus_email_notification",
        title: result.sent ? "Gus email notification sent" : "Gus email notification not sent",
        body: result.sent
          ? `Gus emailed this safety review note to ${toEmail}.`
          : result.warning,
        priority: isGusCriticalSafetyNotification(notificationSignal) ? "critical" : result.sent ? "normal" : "high",
        href: result.payload?.actionHref ?? "/dashboard",
        sourceTable: "gus",
        sourceId: null,
        metadata: {
          channel: "email",
          status: result.status,
          providerMessageId: result.providerMessageId ?? null,
          subject: result.payload?.subject ?? body.subject ?? null,
        },
        ignorePreference: isGusCriticalSafetyNotification(notificationSignal),
      });
    }
  }

  return NextResponse.json({
    sent: result.sent,
    status: result.status,
    warning: result.warning ?? null,
    providerMessageId: result.providerMessageId ?? null,
    toEmail,
  });
}
