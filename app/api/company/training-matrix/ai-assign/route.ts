import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { fetchCompanyTrainingRequirements } from "@/lib/companyTrainingRequirementsDb";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";

export const runtime = "nodejs";

type TrainingAssignmentWorker = {
  id?: string;
  name?: string;
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
          assigned_user_id: clean(worker.id) || null,
          observation_type: "negative",
          sif_potential: plan.riskLevel === "critical",
          sif_category: plan.riskLevel === "critical" ? "line_of_fire" : null,
          immediate_action_required: plan.riskLevel === "critical" || plan.riskLevel === "high",
          priority: plan.riskLevel === "critical" ? "high" : plan.riskLevel,
          due_at: nextDueDate(),
          created_by: auth.user.id,
          updated_by: auth.user.id,
        })
        .select("id")
        .single();

      if (!actionResult.error && actionResult.data && typeof actionResult.data === "object" && "id" in actionResult.data) {
        plan.createdActionId = String(actionResult.data.id);
      }
    }

    plans.push(plan);
  }

  return NextResponse.json({
    success: true,
    assignments: plans,
    skipped,
    createdRequirements: [...createdRequirementByTitle.values()].filter(Boolean).length,
    createdActions: plans.filter((plan) => plan.createdActionId).length,
    message:
      plans.length === 0
        ? "No eligible training assignments were created."
        : "AI training assignments queued. Refresh the training matrix to see newly generated requirements.",
  });
}
