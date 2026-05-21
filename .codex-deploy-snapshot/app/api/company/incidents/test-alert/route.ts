import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canManageCompanyIncidents } from "@/lib/companyFeatureAccess";
import { dispatchIncidentAlertNotifications } from "@/lib/incidents/incidentNotificationDelivery";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canManageCompanyIncidents(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins and managers can send incident alert tests." },
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

  const testSourceId = randomUUID();
  const result = await dispatchIncidentAlertNotifications({
    supabase: auth.supabase,
    sourceTable: "company_incidents",
    actorUserId: auth.user.id,
    record: {
      id: testSourceId,
      companyId: companyScope.companyId,
      jobsiteId: null,
      title: "TEST ONLY - Incident alert system check",
      description:
        "Synthetic notification generated from the Incidents test button. No real incident was created.",
      severity: "critical",
      category: "incident_alert_test",
      fatality: false,
      idlhFlag: true,
      sifFlag: true,
      stopWorkStatus: "stop_work_requested",
      escalationLevel: "critical",
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      ownerUserId: auth.user.id,
    },
  }).catch((error) => ({
    attempted: true,
    recipients: 0,
    sent: 0,
    skipped: 0,
    failed: 1,
    error: error instanceof Error ? error.message : "Incident alert test failed.",
  }));

  if (result.error) {
    serverLog("warn", "incident_alert_test_warning", {
      companyId: companyScope.companyId,
      testSourceId,
      error: result.error,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
    });
  }

  const deliveredOrSkipped = result.sent > 0 || result.skipped > 0;
  return NextResponse.json(
    {
      ok: result.failed === 0 && result.sent > 0,
      sourceId: testSourceId,
      recipients: result.recipients,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      warning: result.error,
      message: deliveredOrSkipped
        ? `Incident alert test complete. Recipients: ${result.recipients}. Sent: ${result.sent}. Skipped: ${result.skipped}. Failed: ${result.failed}.`
        : "Incident alert test ran, but no recipients were found.",
    },
    { status: result.failed > 0 && result.sent === 0 ? 500 : 200 }
  );
}
