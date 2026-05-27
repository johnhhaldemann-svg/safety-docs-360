import {
  OWNER_VALIDATION_STATUSES,
  OWNER_MANUAL_REVIEW_STATUSES,
  OWNER_CUSTOMER_READY_STATUSES,
  type OwnerCustomerReadyStatus,
  type OwnerCustomerReadyGate,
  type OwnerManualReviewStatus,
  type OwnerManualReviewItem,
  type OwnerValidationModule,
  type OwnerValidationOverview,
  type OwnerValidationRun,
  type OwnerValidationRunInput,
  type OwnerValidationStatus,
} from "@/lib/superadmin/ownerValidationTypes";

type SupabaseResult<T> = {
  data: T | null;
  error: { message?: string | null } | null;
};

type OwnerValidationExecutableQuery<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (columns?: string) => OwnerValidationExecutableQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => OwnerValidationExecutableQuery<T>;
  limit: (count: number) => OwnerValidationExecutableQuery<T>;
  eq: (column: string, value: unknown) => OwnerValidationExecutableQuery<T>;
  maybeSingle: () => OwnerValidationExecutableQuery<T>;
  single: () => OwnerValidationExecutableQuery<T>;
};

type OwnerValidationTableQuery = {
  select: (columns?: string) => OwnerValidationExecutableQuery;
  insert: (values: unknown) => OwnerValidationExecutableQuery;
  upsert: (values: unknown, options?: unknown) => OwnerValidationExecutableQuery;
  update: (values: unknown) => OwnerValidationExecutableQuery;
};

export type OwnerValidationSupabaseClient = {
  from: (table: string) => OwnerValidationTableQuery;
};

export const DEFAULT_OWNER_VALIDATION_MODULES = [
  {
    module_key: "login_auth",
    display_name: "Login/Auth",
    related_page_url: "/login",
  },
  {
    module_key: "roles_permissions",
    display_name: "User roles and permissions",
    related_page_url: "/admin/users",
  },
  {
    module_key: "company_setup",
    display_name: "Company setup",
    related_page_url: "/company/settings",
  },
  {
    module_key: "jobsite_setup",
    display_name: "Jobsite setup",
    related_page_url: "/jobsites",
  },
  {
    module_key: "jsa_builder",
    display_name: "JSA builder",
    related_page_url: "/company/jsas",
  },
  {
    module_key: "permit_system",
    display_name: "Permit system",
    related_page_url: "/permits",
  },
  {
    module_key: "training_matrix",
    display_name: "Training matrix",
    related_page_url: "/training",
  },
  {
    module_key: "observations",
    display_name: "Observations",
    related_page_url: "/observations",
  },
  {
    module_key: "incidents",
    display_name: "Incidents",
    related_page_url: "/incidents",
  },
  {
    module_key: "corrective_actions",
    display_name: "Corrective actions",
    related_page_url: "/corrective-actions",
  },
  {
    module_key: "documents",
    display_name: "Document builder",
    related_page_url: "/documents",
  },
  {
    module_key: "pdf_word_exports",
    display_name: "PDF and Word exports",
    related_page_url: "/documents",
  },
  {
    module_key: "file_uploads",
    display_name: "File uploads",
    related_page_url: "/documents",
  },
  {
    module_key: "notifications",
    display_name: "Notifications",
    related_page_url: "/notifications",
  },
  {
    module_key: "gus_ai",
    display_name: "AI Safety Coach / Gus",
    related_page_url: "/gus",
  },
  {
    module_key: "ai_risk_engine",
    display_name: "AI Risk Engine",
    related_page_url: "/dashboard",
  },
  {
    module_key: "mobile_views",
    display_name: "Mobile views",
    related_page_url: "/dashboard",
  },
] as const;

export const DEFAULT_OWNER_MANUAL_REVIEW_ITEMS: Record<string, readonly string[]> = {
  jsa_builder: [
    "Open JSA page",
    "Create new JSA",
    "Add task steps",
    "Add hazards",
    "Add controls",
    "Add employees",
    "Capture signature if supported",
    "Save JSA",
    "Reopen JSA",
    "Export JSA if supported",
    "Confirm JSA appears on dashboard",
  ],
  permit_system: [
    "Open permit page",
    "Create Hot Work permit",
    "Create Confined Space permit if supported",
    "Create Excavation permit if supported",
    "Confirm permit status changes correctly",
    "Confirm permit links to jobsite/JSA if supported",
  ],
  training_matrix: [
    "Open training page",
    "Confirm current training appears current",
    "Confirm expired training appears expired",
    "Confirm missing training appears missing",
    "Confirm employee profile shows training status",
  ],
  incidents: [
    "Open incident page",
    "Create draft incident",
    "Add details",
    "Add corrective action if supported",
    "Save/reopen incident",
    "Confirm incident appears on dashboard",
  ],
  observations: [
    "Open observations page",
    "Create safe observation",
    "Create unsafe observation",
    "Assign corrective action if supported",
    "Confirm observation appears on dashboard",
  ],
  documents: [
    "Open document builder",
    "Generate document if supported",
    "Export PDF if supported",
    "Export Word if supported",
    "Confirm no placeholder text appears",
  ],
  gus_ai: [
    "Open Gus page",
    "Enter a safety scenario",
    "Confirm response is practical",
    "Confirm response does not invent unsupported requirements",
    "Confirm company/jobsite context is used if available",
  ],
};

function isOwnerValidationStatus(value: unknown): value is OwnerValidationStatus {
  return typeof value === "string" && OWNER_VALIDATION_STATUSES.includes(value as OwnerValidationStatus);
}

function isOwnerManualReviewStatus(value: unknown): value is OwnerManualReviewStatus {
  return typeof value === "string" && OWNER_MANUAL_REVIEW_STATUSES.includes(value as OwnerManualReviewStatus);
}

function isOwnerCustomerReadyStatus(value: unknown): value is OwnerCustomerReadyStatus {
  return typeof value === "string" && OWNER_CUSTOMER_READY_STATUSES.includes(value as OwnerCustomerReadyStatus);
}

function assertNoSupabaseError<T>(result: SupabaseResult<T>, action: string): T {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? "Supabase request failed."}`);
  }

  return result.data as T;
}

export async function ensureDefaultOwnerValidationModules(client: OwnerValidationSupabaseClient) {
  const modules = DEFAULT_OWNER_VALIDATION_MODULES.map((module) => ({
    ...module,
    status: "gray" satisfies OwnerValidationStatus,
    summary: "Not tested yet.",
    customer_ready: false,
  }));

  const moduleResult = await client
    .from("owner_validation_modules")
    .upsert(modules, { onConflict: "module_key", ignoreDuplicates: true });
  assertNoSupabaseError(moduleResult, "Unable to seed owner validation modules");

  const gateResult = await client.from("owner_customer_ready_gates").upsert(
    DEFAULT_OWNER_VALIDATION_MODULES.map((module) => ({
      module_key: module.module_key,
      automated_validation_status: "gray",
      owner_visual_review_status: "not_started",
      customer_ready_status: "Not tested",
      customer_ready: false,
      super_admin_approved: false,
      blocking_reason: "Not tested yet.",
    })),
    { onConflict: "module_key", ignoreDuplicates: true }
  );
  assertNoSupabaseError(gateResult, "Unable to seed owner customer-ready gates");

  const reviewItems = Object.entries(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS).flatMap(
    ([moduleKey, items]) =>
      items.map((item) => ({
        module_key: moduleKey,
        checklist_item: item,
        status: "not_started",
        required: true,
        completed: false,
      }))
  );

  const checklistResult = await client
    .from("owner_manual_review_items")
    .upsert(reviewItems, {
      onConflict: "module_key,checklist_item",
      ignoreDuplicates: true,
    });
  assertNoSupabaseError(checklistResult, "Unable to seed owner manual review checklists");
}

export async function loadOwnerValidationOverview(
  client: OwnerValidationSupabaseClient
): Promise<OwnerValidationOverview> {
  await ensureDefaultOwnerValidationModules(client);

  const [modules, recentRuns, manualReviewItems, customerReadyGates] = await Promise.all([
    client.from("owner_validation_modules").select("*").order("display_name", { ascending: true }),
    client
      .from("owner_validation_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10),
    client
      .from("owner_manual_review_items")
      .select("*")
      .order("module_key", { ascending: true }),
    client
      .from("owner_customer_ready_gates")
      .select("*")
      .order("module_key", { ascending: true }),
  ]);

  return {
    modules: assertNoSupabaseError(modules, "Unable to load owner validation modules") as OwnerValidationModule[],
    recentRuns: assertNoSupabaseError(recentRuns, "Unable to load owner validation runs") as OwnerValidationRun[],
    manualReviewItems: assertNoSupabaseError(
      manualReviewItems,
      "Unable to load owner manual review items"
    ) as OwnerManualReviewItem[],
    customerReadyGates: assertNoSupabaseError(
      customerReadyGates,
      "Unable to load owner customer-ready gates"
    ) as OwnerCustomerReadyGate[],
  };
}

export function validateOwnerValidationRunInput(value: unknown): OwnerValidationRunInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const checks = Array.isArray(body.checks) ? body.checks : [];
  type NormalizedCheck = NonNullable<OwnerValidationRunInput["checks"]>[number];
  const normalizedChecks: NormalizedCheck[] = checks
    .map((check): NormalizedCheck | null => {
      if (!check || typeof check !== "object") return null;
      const item = check as Record<string, unknown>;
      const status = isOwnerValidationStatus(item.status) ? item.status : "gray";
      const moduleKey = typeof item.moduleKey === "string" ? item.moduleKey.trim() : "";
      const checkName = typeof item.checkName === "string" ? item.checkName.trim() : "";
      const result = typeof item.result === "string" ? item.result.trim() : "";

      if (!moduleKey || !checkName || !result) return null;

      return {
        moduleKey,
        checkName,
        status,
        result,
        technicalDetails:
          item.technicalDetails && typeof item.technicalDetails === "object"
            ? (item.technicalDetails as Record<string, unknown>)
            : null,
        recommendedOwnerAction:
          typeof item.recommendedOwnerAction === "string"
            ? item.recommendedOwnerAction.trim()
            : null,
      };
    })
    .filter((check): check is NormalizedCheck => Boolean(check));

  return {
    completedAt: typeof body.completedAt === "string" ? body.completedAt : new Date().toISOString(),
    overallStatus: isOwnerValidationStatus(body.overallStatus) ? body.overallStatus : "gray",
    overallScore:
      typeof body.overallScore === "number" && Number.isFinite(body.overallScore)
        ? Math.max(0, Math.min(100, Math.round(body.overallScore)))
        : 0,
    summary:
      typeof body.summary === "string" && body.summary.trim()
        ? body.summary.trim()
        : "Owner validation run recorded.",
    checks: normalizedChecks,
  };
}

function countChecks(checks: NonNullable<OwnerValidationRunInput["checks"]>, status: OwnerValidationStatus) {
  return checks.filter((check) => check.status === status).length;
}

export async function recordOwnerValidationRun(params: {
  client: OwnerValidationSupabaseClient;
  startedBy: string | null;
  input: OwnerValidationRunInput;
}) {
  const checks = params.input.checks ?? [];
  const runInsert = await params.client
    .from("owner_validation_runs")
    .insert({
      completed_at: params.input.completedAt ?? new Date().toISOString(),
      started_by: params.startedBy,
      overall_status: params.input.overallStatus ?? "gray",
      overall_score: params.input.overallScore ?? 0,
      passed_count: countChecks(checks, "green"),
      warning_count: countChecks(checks, "yellow"),
      failed_count: countChecks(checks, "red"),
      summary: params.input.summary ?? "Owner validation run recorded.",
    })
    .select("*")
    .single();
  const run = assertNoSupabaseError(runInsert, "Unable to create owner validation run") as OwnerValidationRun;

  if (checks.length === 0) {
    return { run, checks: [] };
  }

  const checkRows = checks.map((check) => ({
    run_id: run.id,
    module_key: check.moduleKey,
    check_name: check.checkName,
    status: check.status,
    result: check.result,
    technical_details: check.technicalDetails ?? null,
    recommended_owner_action: check.recommendedOwnerAction ?? null,
  }));

  const insertedChecks = await params.client
    .from("owner_validation_check_results")
    .insert(checkRows)
    .select("*");
  const savedChecks = assertNoSupabaseError(
    insertedChecks,
    "Unable to save owner validation check results"
  );

  await Promise.all(
    checks.map(async (check) => {
      const summary = check.status === "green" ? check.result : `${check.result} Owner review is recommended.`;
      const moduleUpdate = await params.client
        .from("owner_validation_modules")
        .update({
          status: check.status,
          summary,
          last_tested_at: params.input.completedAt ?? new Date().toISOString(),
          last_tested_by: params.startedBy,
          customer_ready: false,
        })
        .eq("module_key", check.moduleKey);
      assertNoSupabaseError(moduleUpdate, `Unable to update validation module ${check.moduleKey}`);

      const gateUpdate = await params.client
        .from("owner_customer_ready_gates")
        .upsert(
          {
            module_key: check.moduleKey,
            automated_validation_status: check.status,
            customer_ready_status: check.status === "red" ? "Blocked" : "Needs owner review",
            customer_ready: false,
            super_admin_approved: false,
            approved_by: null,
            approved_at: null,
            latest_owner_proof_report_id: run.id,
            blocking_reason:
              check.status === "green"
                ? "Owner visual review is still required."
                : check.recommendedOwnerAction ?? "Automated validation needs review.",
          },
          { onConflict: "module_key" }
        );
      assertNoSupabaseError(gateUpdate, `Unable to update customer-ready gate ${check.moduleKey}`);
    })
  );

  return { run, checks: savedChecks };
}

export function validateOwnerManualReviewUpdateInput(value: unknown): {
  status: OwnerManualReviewStatus;
  notes: string | null;
} {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    status: isOwnerManualReviewStatus(body.status) ? body.status : "not_started",
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
  };
}

function reviewGateStatus(items: OwnerManualReviewItem[]): OwnerManualReviewStatus {
  if (items.some((item) => item.status === "failed")) return "failed";
  if (items.some((item) => item.status === "needs_review")) return "needs_review";
  const requiredItems = items.filter((item) => item.required);
  if (requiredItems.length > 0 && requiredItems.every((item) => item.status === "passed")) {
    return "passed";
  }
  return "not_started";
}

export async function updateOwnerManualReviewItem(params: {
  client: OwnerValidationSupabaseClient;
  itemId: string;
  actorUserId: string;
  status: OwnerManualReviewStatus;
  notes: string | null;
}) {
  const completed = params.status === "passed";
  const completedAt = completed ? new Date().toISOString() : null;
  const updatedResult = await params.client
    .from("owner_manual_review_items")
    .update({
      status: params.status,
      notes: params.notes,
      completed,
      completed_by: completed ? params.actorUserId : null,
      completed_at: completedAt,
    })
    .eq("id", params.itemId)
    .select("*")
    .single();
  const item = assertNoSupabaseError(
    updatedResult,
    "Unable to update owner manual review item"
  ) as OwnerManualReviewItem;

  const moduleItemsResult = await params.client
    .from("owner_manual_review_items")
    .select("*")
    .eq("module_key", item.module_key);
  const moduleItems = assertNoSupabaseError(
    moduleItemsResult,
    "Unable to reload owner manual review items"
  ) as OwnerManualReviewItem[];
  const ownerVisualReviewStatus = reviewGateStatus(moduleItems);
  const blockingReason =
    ownerVisualReviewStatus === "passed"
      ? "Automated validation must still pass before customer-ready approval."
      : ownerVisualReviewStatus === "failed"
        ? "One or more required owner checklist items failed."
        : ownerVisualReviewStatus === "needs_review"
          ? "One or more owner checklist items need review."
          : "Owner visual review is not complete.";

  const gateUpdate = await params.client
    .from("owner_customer_ready_gates")
    .upsert(
      {
        module_key: item.module_key,
        owner_visual_review_status: ownerVisualReviewStatus,
        customer_ready_status:
          ownerVisualReviewStatus === "failed"
            ? "Blocked"
            : ownerVisualReviewStatus === "passed"
              ? "Needs owner review"
              : "Needs owner review",
        customer_ready: false,
        super_admin_approved: false,
        approved_by: null,
        approved_at: null,
        blocking_reason: blockingReason,
      },
      { onConflict: "module_key" }
    );
  assertNoSupabaseError(gateUpdate, "Unable to update owner customer-ready gate");

  return { item, ownerVisualReviewStatus };
}

export function validateOwnerCustomerReadyGateInput(value: unknown): {
  customerReadyStatus: OwnerCustomerReadyStatus;
} {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    customerReadyStatus: isOwnerCustomerReadyStatus(body.customerReadyStatus)
      ? body.customerReadyStatus
      : "Needs owner review",
  };
}

function gateBlockReason(params: {
  gate: OwnerCustomerReadyGate | null;
  latestRun: OwnerValidationRun | null;
  requestedStatus: OwnerCustomerReadyStatus;
}) {
  const { gate, latestRun, requestedStatus } = params;

  if (!gate) return "Customer-ready gate does not exist for this module.";
  if (gate.automated_validation_status === "red") return "Automated validation is red.";
  if (gate.owner_visual_review_status === "failed") return "Owner visual review failed.";
  if (requestedStatus === "Not tested") return "Module has not been approved.";
  if (requestedStatus === "Blocked") return "Super Admin marked this module blocked.";
  if (requestedStatus === "Needs owner review") return "Owner review is still required.";
  if (gate.automated_validation_status === "gray") return "Automated validation has not run yet.";
  if (gate.owner_visual_review_status !== "passed") return "Required owner visual review is not complete.";
  if (!latestRun) return "A latest Owner Proof Report is required.";

  return null;
}

export async function updateOwnerCustomerReadyGate(params: {
  client: OwnerValidationSupabaseClient;
  moduleKey: string;
  actorUserId: string;
  customerReadyStatus: OwnerCustomerReadyStatus;
}) {
  const gateResult = await params.client
    .from("owner_customer_ready_gates")
    .select("*")
    .eq("module_key", params.moduleKey)
    .maybeSingle();
  const gate = assertNoSupabaseError(
    gateResult,
    "Unable to load owner customer-ready gate"
  ) as OwnerCustomerReadyGate | null;

  const latestRunResult = await params.client
    .from("owner_validation_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRun = assertNoSupabaseError(
    latestRunResult,
    "Unable to load latest Owner Proof Report"
  ) as OwnerValidationRun | null;

  const blockingReason = gateBlockReason({
    gate,
    latestRun,
    requestedStatus: params.customerReadyStatus,
  });
  const approvingCustomerUse = params.customerReadyStatus === "Approved for customer use";
  const approvingDemo = params.customerReadyStatus === "Approved for demo";
  const customerReady = approvingCustomerUse && !blockingReason;
  const status =
    approvingCustomerUse && blockingReason
      ? gate?.automated_validation_status === "red" || gate?.owner_visual_review_status === "failed"
        ? "Blocked"
        : "Needs owner review"
      : params.customerReadyStatus;

  const update = await params.client
    .from("owner_customer_ready_gates")
    .update({
      customer_ready_status: status,
      customer_ready: customerReady,
      super_admin_approved: (approvingCustomerUse || approvingDemo) && !blockingReason,
      approved_by: (approvingCustomerUse || approvingDemo) && !blockingReason ? params.actorUserId : null,
      approved_at: (approvingCustomerUse || approvingDemo) && !blockingReason ? new Date().toISOString() : null,
      latest_owner_proof_report_id: latestRun?.id ?? gate?.latest_owner_proof_report_id ?? null,
      blocking_reason: customerReady || (approvingDemo && !blockingReason) ? null : blockingReason,
    })
    .eq("module_key", params.moduleKey)
    .select("*")
    .single();
  const updatedGate = assertNoSupabaseError(
    update,
    "Unable to update owner customer-ready gate"
  ) as OwnerCustomerReadyGate;

  const moduleUpdate = await params.client
    .from("owner_validation_modules")
    .update({ customer_ready: updatedGate.customer_ready })
    .eq("module_key", params.moduleKey);
  assertNoSupabaseError(moduleUpdate, "Unable to update validation module customer-ready flag");

  return {
    gate: updatedGate,
    approved: updatedGate.customer_ready || updatedGate.customer_ready_status === "Approved for demo",
    blockingReason,
  };
}
