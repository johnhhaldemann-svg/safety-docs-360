import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTrainingExpirationEmail } from "@/lib/trainingExpirationEmail";
import { loadTrainingExpirationItems } from "@/lib/trainingExpirationNotifications";

export const runtime = "nodejs";

function dateOnlyOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function userDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";
  return name || user.email?.trim() || "Test recipient";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can send training notification tests." },
      { status: 403 }
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
      { error: "This company account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Missing Supabase service role key for training expiration notification tests." },
      { status: 500 }
    );
  }

  const recipientEmail = auth.user.email?.trim().toLowerCase();
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "Your account does not have an email address to receive the test." },
      { status: 400 }
    );
  }

  const companyName = companyScope.companyName || "Your company";
  const testResult = await sendTrainingExpirationEmail({
    toEmail: recipientEmail,
    companyName,
    workerItems: [
      {
        workerName: userDisplayName(auth.user),
        workerEmail: recipientEmail,
        trainingTitle: "SafePredict test renewal",
        expiresOn: dateOnlyOffset(7),
        daysUntilExpiry: 7,
        stage: "7d",
        jobsiteName: "Notification test",
        subjectType: "app_user",
      },
    ],
    managerItems: [
      {
        workerName: "Example worker",
        workerEmail: "example.worker@safepredict.test",
        trainingTitle: "Example expired training",
        expiresOn: dateOnlyOffset(-1),
        daysUntilExpiry: -1,
        stage: "expired",
        jobsiteName: "Notification test",
        subjectType: "tracked_employee",
      },
    ],
  });

  const dryRun = await loadTrainingExpirationItems({
    supabase: adminClient,
    company: { id: companyScope.companyId, name: companyName },
    asOf: new Date(),
  });

  return NextResponse.json({
    ok: testResult.status === "sent",
    status: testResult.status,
    sent: testResult.sent,
    warning: testResult.warning ?? null,
    providerMessageId: testResult.providerMessageId ?? null,
    recipientEmail,
    realExpirationItemsSeen: dryRun.items.length,
    dryRunWarnings: dryRun.warnings,
    message:
      testResult.status === "sent"
        ? `Training expiration test email sent to ${recipientEmail}.`
        : testResult.warning ?? "Training expiration test email was not sent.",
  });
}
