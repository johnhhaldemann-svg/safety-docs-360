import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyScope } from "@/lib/companyScope";
import { createCompanyNotification } from "@/lib/companyNotifications";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { fetchCompanyTrainingRequirements } from "@/lib/companyTrainingRequirementsDb";
import { normalizeEmail } from "@/lib/companyTrackedEmployees";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTrainingAssignmentEmail } from "@/lib/trainingAssignmentEmail";

export const runtime = "nodejs";

type TrainingAssignmentWorker = {
  id?: string;
  name?: string;
  email?: string;
  trade?: string;
  role?: string;
  status?: string;
  readinessScore?: number;
  assignedSiteId?: string;
  credentials?: string[];
};

type AssignmentPlan = {
  workerId: string;
  workerName: string;
  title: string;
  action: "create_requirement" | "assign_training" | "update_record" | "review";
  riskLevel: "low" | "medium" | "high" | "critical";
  requirementTitle: string;
  detail: string;
  createdRequirementId?: string | null;
  createdActionId?: string | null;
  notificationStatus?: "sent" | "skipped" | "failed";
  notificationWarning?: string | null;
};

type NotificationSummary = {
  sent: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

const TRAINING_LIBRARY = [
  {
    match: /\belectrical|electrician|instrumentation|loto|lockout|energy\b/i,
    title: "LOTO Authorized Worker",
    keywords: ["LOTO Authorized Worker", "Lockout/Tagout", "Hazardous Energy Control"],
  },
  {
    match: /\bweld|hot work|fire watch|burn\b/i,
    title: "Hot Work / Fire Watch Training",
    keywords: ["Hot Work", "Fire Watch", "Hot Work Permit"],
  },
  {
    match: /\bscaffold|elevated|height|roof|deck|fall\b/i,
    title: "Fall Protection / Scaffold User Training",
    keywords: ["Fall Protection", "Scaffold User", "Work at Height"],
  },
  {
    match: /\bexcavat|trench|civil|concrete|earthwork\b/i,
    title: "Excavation and Trenching Competent Person",
    keywords: ["Excavation Competent Person", "Trenching and Excavation"],
  },
  {
    match: /\bforklift|equipment|operator|material handling|logistics\b/i,
    title: "Equipment Operator / Material Handling Training",
    keywords: ["Forklift", "Equipment Operator", "Material Handling"],
  },
  {
    match: /\bsafety manager|site safety|superintendent|foreman|supervisor\b/i,
    title: "Supervisor Safety Leadership and Field Verification",
    keywords: ["Safety Leadership", "Supervisor Safety", "Field Verification"],
  },
];

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function inferTraining(worker: TrainingAssignmentWorker) {
  const haystack = [worker.trade, worker.role, ...(worker.credentials ?? [])]
    .filter(Boolean)
    .join(" ");
  const found = TRAINING_LIBRARY.find((item) => item.match.test(haystack));
  return found ?? {
    title: "Site Safety Orientation and Hazard Reporting",
    keywords: ["Site Safety Orientation", "Hazard Reporting", "Safety Orientation"],
  };
}

function classifyWorker(worker: TrainingAssignmentWorker, requirementsExist: boolean): AssignmentPlan {
  const status = clean(worker.status, "needs_review").toLowerCase();
  const score =
    typeof worker.readinessScore === "number" && Number.isFinite(worker.readinessScore)
      ? worker.readinessScore
      : null;
  const training = inferTraining(worker);
  const workerName = clean(worker.name, "Worker");
  const workerId = clean(worker.id, workerName);
  const hasCredentials = (worker.credentials ?? []).some((item) => clean(item));

  if (!requirementsExist) {
    return {
      workerId,
      workerName,
      title: `Create missing training rule for ${worker.trade || worker.role || "worker readiness"}`,
      action: "create_requirement",
      riskLevel: "high",
      requirementTitle: training.title,
      detail: `${training.title} is missing from the company training matrix for this role/trade, so AI will add the requirement and queue follow-up.`,
    };
  }

  if (status === "overdue" || (score !== null && score < 70)) {
    return {
      workerId,
      workerName,
      title: `Assign ${training.title} to ${workerName}`,
      action: "assign_training",
      riskLevel: score !== null && score < 60 ? "critical" : "high",
      requirementTitle: training.title,
      detail: `${workerName} has an overdue or low-readiness training signal. Assign training to mitigate forecasted jobsite risk.`,
    };
  }

  if (status === "expiring" || (score !== null && score < 85)) {
    return {
      workerId,
      workerName,
      title: `Schedule renewal for ${workerName}`,
      action: "assign_training",
      riskLevel: "medium",
      requirementTitle: training.title,
      detail: `${workerName} has expiring readiness signals. Schedule renewal before it becomes an access blocker.`,
    };
  }

  if (!hasCredentials) {
    return {
      workerId,
      workerName,
      title: `Update training records for ${workerName}`,
      action: "update_record",
      riskLevel: "medium",
      requirementTitle: training.title,
      detail: `${workerName} appears ready, but no training evidence is attached in this view. Verify and update the record.`,
    };
  }

  return {
    workerId,
    workerName,
    title: `Review training fit for ${workerName}`,
    action: "review",
    riskLevel: "low",
    requirementTitle: training.title,
    detail: `${workerName} does not show an urgent gap. AI recommends a quick record review only.`,
  };
}

function nextDueDate() {
  const due = new Date();
  due.setDate(due.getDate() + 14);
  return due.toISOString();
}

function assignableUserId(workerId: string) {
  const cleaned = clean(workerId);
  if (!cleaned || cleaned.startsWith("tracked:")) return null;
  return cleaned;
}

function actorName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";
  return metadataName.trim() || user.email?.trim() || "Safety team";
}

async function resolveWorkerEmail(params: {
  worker: TrainingAssignmentWorker;
  companyId: string;
  currentUser: { id: string; email?: string | null };
  supabase: SupabaseClient;
}) {
  const directEmail = normalizeEmail(params.worker.email);
  if (directEmail) return directEmail;

  const workerId = clean(params.worker.id);
  if (!workerId) return null;

  if (workerId.startsWith("tracked:")) {
    const employeeId = workerId.slice("tracked:".length).trim();
    if (!employeeId) return null;
    const db = createSupabaseAdminClient() ?? params.supabase;
    const result = await db
      .from("company_employee_profiles")
      .select("email")
      .eq("company_id", params.companyId)
      .eq("id", employeeId)
      .maybeSingle();
    if (result.error) return null;
    return normalizeEmail((result.data as { email?: string | null } | null)?.email);
  }

  if (workerId === params.currentUser.id) {
    const currentEmail = normalizeEmail(params.currentUser.email);
    if (currentEmail) return currentEmail;
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return null;
  const result = await adminClient.auth.admin.getUserById(workerId);
  if (result.error) return null;
  return normalizeEmail(result.data.user?.email);
}

async function resolveJobsiteName(params: {
  supabase: SupabaseClient;
  companyId: string;
  jobsiteId: string;
}) {
  if (!params.jobsiteId) return null;
  const result = await params.supabase
    .from("company_jobsites")
    .select("name")
    .eq("company_id", params.companyId)
    .eq("id", params.jobsiteId)
    .maybeSingle();
  if (result.error) return null;
  const name = (result.data as { name?: string | null } | null)?.name?.trim();
  return name || null;
}

async function recordNotificationEvent(params: {
  supabase: SupabaseClient;
  actionId: string;
  companyId: string;
  actorUserId: string;
  email: string | null;
  status: "sent" | "skipped" | "failed";
  warning?: string | null;
}) {
  await params.supabase.from("company_corrective_action_events").insert({
    action_id: params.actionId,
    company_id: params.companyId,
    event_type: "training_assignment_notification",
    detail:
      params.status === "sent"
        ? "Training assignment notification email sent."
        : "Training assignment notification email was not sent.",
    event_payload: {
      email: params.email,
      status: params.status,
      warning: params.warning ?? null,
    },
    created_by: params.actorUserId,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "You do not have permission to assign training." },
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

  const body = (await request.json().catch(() => null)) as
    | { worker?: TrainingAssignmentWorker; workers?: TrainingAssignmentWorker[] }
    | null;
  const workers = (body?.worker ? [body.worker] : body?.workers ?? [])
    .filter((worker) => clean(worker.id) || clean(worker.name))
    .slice(0, 25);

  if (workers.length === 0) {
    return NextResponse.json({ error: "Select at least one worker to assign training." }, { status: 400 });
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  const fetchedRequirements = await fetchCompanyTrainingRequirements(auth.supabase, companyScope.companyId, true);
  if (fetchedRequirements.error) {
    return NextResponse.json({ error: fetchedRequirements.error }, { status: 500 });
  }

  const existingRequirements = fetchedRequirements.rows;
  const existingTitles = new Set(existingRequirements.map((row) => normalize(row.title)));
  const maxSortOrder = Math.max(
    0,
    ...existingRequirements.map((row) => row.sort_order).filter((value) => typeof value === "number")
  );
  let nextSortOrder = maxSortOrder + 1;
  const createdRequirementByTitle = new Map<string, string | null>();
  const plans: AssignmentPlan[] = [];
  const skipped: string[] = [];
  const notificationSummary: NotificationSummary = {
    sent: 0,
    skipped: 0,
    failed: 0,
    warnings: [],
  };

  for (const worker of workers) {
    const plan = classifyWorker(worker, existingRequirements.length > 0);
    const jobsiteId = clean(worker.assignedSiteId);
    if (jobsiteId && !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
      skipped.push(`${plan.workerName}: jobsite is outside your access scope.`);
      continue;
    }

    const requirementKey = normalize(plan.requirementTitle);
    if (!existingTitles.has(requirementKey) && !createdRequirementByTitle.has(requirementKey)) {
      const inferred = inferTraining(worker);
      const insertResult = await auth.supabase
        .from("company_training_requirements")
        .insert({
          company_id: companyScope.companyId,
          title: plan.requirementTitle,
          sort_order: nextSortOrder++,
          match_keywords: inferred.keywords,
          match_fields: ["certifications"],
          apply_trades: clean(worker.trade) ? [clean(worker.trade)] : [],
          apply_positions: clean(worker.role) ? [clean(worker.role)] : [],
          apply_sub_trades: [],
          apply_task_codes: [],
          renewal_months: 24,
          is_generated: true,
          generated_source_type: "safe_predict_ai_assignment",
          generated_source_document_id: null,
          generated_source_operation_key: normalize(`${worker.trade ?? ""} ${worker.role ?? ""}`).replace(/\s+/g, "_") || null,
          created_by: auth.user.id,
          updated_by: auth.user.id,
        })
        .select("id")
        .single();

      if (insertResult.error) {
        return NextResponse.json(
          { error: insertResult.error.message || "Failed to create AI training requirement." },
          { status: 500 }
        );
      }

      const createdId =
        insertResult.data && typeof insertResult.data === "object" && "id" in insertResult.data
          ? String(insertResult.data.id)
          : null;
      createdRequirementByTitle.set(requirementKey, createdId);
      existingTitles.add(requirementKey);
      plan.createdRequirementId = createdId;
    } else {
      plan.createdRequirementId = createdRequirementByTitle.get(requirementKey) ?? null;
    }

    if (plan.action !== "review") {
      const dueAt = nextDueDate();
      const actionResult = await auth.supabase
        .from("company_corrective_actions")
        .insert({
          company_id: companyScope.companyId,
          jobsite_id: jobsiteId || null,
          title: plan.title,
          description: `${plan.detail} Required training: ${plan.requirementTitle}. Worker: ${plan.workerName}.`,
          severity: plan.riskLevel,
          category: "corrective_action",
          status: "open",
          workflow_status: "open",
          assigned_user_id: assignableUserId(worker.id ?? ""),
          observation_type: "negative",
          sif_potential: plan.riskLevel === "critical",
          sif_category: plan.riskLevel === "critical" ? "line_of_fire" : null,
          immediate_action_required: plan.riskLevel === "critical" || plan.riskLevel === "high",
          priority: plan.riskLevel === "critical" ? "high" : plan.riskLevel,
          due_at: dueAt,
          created_by: auth.user.id,
          updated_by: auth.user.id,
        })
        .select("id")
        .single();

      if (!actionResult.error && actionResult.data && typeof actionResult.data === "object" && "id" in actionResult.data) {
        plan.createdActionId = String(actionResult.data.id);
      }

      if (plan.action === "assign_training" && plan.createdActionId) {
        await createCompanyNotification({
          supabase: auth.supabase,
          companyId: companyScope.companyId,
          recipientUserId: assignableUserId(worker.id ?? "") ?? auth.user.id,
          actorUserId: auth.user.id,
          eventType: "training_gap",
          title: plan.title,
          body: plan.detail,
          priority: plan.riskLevel === "critical" ? "critical" : "high",
          href: `/training-matrix?action=${encodeURIComponent(plan.createdActionId)}`,
          sourceTable: "company_corrective_actions",
          sourceId: plan.createdActionId,
          metadata: {
            workerId: worker.id ?? null,
            requirementTitle: plan.requirementTitle,
          },
        }).catch((error) => {
          console.warn("training_gap_notification_failed", error);
        });

        const recipientEmail = await resolveWorkerEmail({
          worker,
          companyId: companyScope.companyId,
          currentUser: auth.user,
          supabase: auth.supabase,
        });

        if (!recipientEmail) {
          plan.notificationStatus = "skipped";
          plan.notificationWarning = "No email address is available for this assignee.";
          notificationSummary.skipped += 1;
          notificationSummary.warnings.push(`${plan.workerName}: no email address is available.`);
          await recordNotificationEvent({
            supabase: auth.supabase,
            actionId: plan.createdActionId,
            companyId: companyScope.companyId,
            actorUserId: auth.user.id,
            email: null,
            status: "skipped",
            warning: plan.notificationWarning,
          });
        } else {
          const jobsiteName = await resolveJobsiteName({
            supabase: auth.supabase,
            companyId: companyScope.companyId,
            jobsiteId,
          });
          const emailResult = await sendTrainingAssignmentEmail({
            toEmail: recipientEmail,
            workerName: plan.workerName,
            companyName: companyScope.companyName || "Your company",
            assignedByName: actorName(auth.user),
            assignmentTitle: plan.title,
            requirementTitle: plan.requirementTitle,
            detail: plan.detail,
            dueAt,
            jobsiteName,
          });
          plan.notificationStatus = emailResult.status;
          plan.notificationWarning = emailResult.warning ?? null;
          if (emailResult.status === "sent") {
            notificationSummary.sent += 1;
          } else if (emailResult.status === "failed") {
            notificationSummary.failed += 1;
            if (emailResult.warning) notificationSummary.warnings.push(`${plan.workerName}: ${emailResult.warning}`);
          } else {
            notificationSummary.skipped += 1;
            if (emailResult.warning) notificationSummary.warnings.push(`${plan.workerName}: ${emailResult.warning}`);
          }
          await recordNotificationEvent({
            supabase: auth.supabase,
            actionId: plan.createdActionId,
            companyId: companyScope.companyId,
            actorUserId: auth.user.id,
            email: recipientEmail,
            status: emailResult.status,
            warning: emailResult.warning ?? null,
          });
        }
      }
    }

    plans.push(plan);
  }

  const notificationText =
    notificationSummary.sent > 0 || notificationSummary.skipped > 0 || notificationSummary.failed > 0
      ? ` Email notifications: ${notificationSummary.sent} sent, ${notificationSummary.skipped} skipped, ${notificationSummary.failed} failed.`
      : "";

  return NextResponse.json({
    success: true,
    assignments: plans,
    skipped,
    notifications: notificationSummary,
    createdRequirements: [...createdRequirementByTitle.values()].filter(Boolean).length,
    createdActions: plans.filter((plan) => plan.createdActionId).length,
    message:
      plans.length === 0
        ? "No eligible training assignments were created."
        : `AI training assignments queued. Refresh the training matrix to see newly generated requirements.${notificationText}`,
  });
}
