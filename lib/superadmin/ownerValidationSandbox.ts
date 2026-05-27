export const SAFETY360_TEST_COMPANY_NAME = "Safety360 Test Company";
export const SAFETY360_TEST_COMPANY_KEY = "safety360-test-company";
export const SAFETY360_TEST_SEED_VERSION = "owner-validation-sandbox-v1";

type SupabaseError = { message?: string | null } | null;
type SupabaseResult<T = unknown> = { data?: T | null; error?: SupabaseError };
type SupabaseQuery<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (...args: unknown[]) => SupabaseQuery<T>;
  eq: (...args: unknown[]) => SupabaseQuery<T>;
  in: (...args: unknown[]) => SupabaseQuery<T>;
  maybeSingle: () => Promise<SupabaseResult<T>>;
  single: () => Promise<SupabaseResult<T>>;
  insert: (...args: unknown[]) => SupabaseQuery<T>;
  upsert: (...args: unknown[]) => SupabaseQuery<T>;
  delete: () => SupabaseQuery<T>;
};

export type Safety360SandboxSupabaseClient = {
  from: (table: string) => unknown;
};

type IdNameRow = { id: string; name?: string | null; title?: string | null; full_name?: string | null };
type CompanyRow = { id: string; name: string };
type MarkerRow = { record_id: string; record_table: string };

export type Safety360SandboxSeedResult = {
  companyId: string;
  companyName: string;
  sandboxKey: string;
  counts: {
    employees: number;
    jobsites: number;
    jsas: number;
    permits: number;
    trainingRequirements: number;
    trainingRecords: number;
    observations: number;
    incidents: number;
    correctiveActions: number;
    documents: number;
  };
};

function table<T = unknown>(supabase: Safety360SandboxSupabaseClient, name: string) {
  return supabase.from(name) as SupabaseQuery<T>;
}

function isMissingSchemaError(error: SupabaseError) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("unknown column") ||
    message.includes("undefined column")
  );
}

function assertOk<T>(result: SupabaseResult, action: string): T {
  if (result.error) throw new Error(result.error.message || action);
  return result.data as T;
}

async function ignoreMissingSchema(result: PromiseLike<SupabaseResult>, action: string) {
  const resolved = await result;
  if (resolved.error && !isMissingSchemaError(resolved.error)) {
    throw new Error(resolved.error.message || action);
  }
  return resolved;
}

function day(offset: number) {
  const value = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

function isoDay(offset: number, hour = 14) {
  const value = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
}

function byName(rows: Array<IdNameRow>) {
  return new Map(rows.map((row) => [row.name ?? row.title ?? row.full_name ?? row.id, row.id]));
}

function marker(tableName: string, row: IdNameRow, kind: string, companyId: string, actorUserId: string) {
  return {
    sandbox_key: SAFETY360_TEST_COMPANY_KEY,
    sandbox_company_id: companyId,
    record_table: tableName,
    record_id: row.id,
    record_kind: kind,
    record_label: row.name ?? row.title ?? row.full_name ?? row.id,
    created_by: actorUserId,
  };
}

async function markSandboxRecords(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  tableName: string;
  kind: string;
  rows: Array<IdNameRow>;
}) {
  if (params.rows.length === 0) return;
  await ignoreMissingSchema(
    table(params.supabase, "owner_validation_sandbox_records").upsert(
      params.rows.map((row) =>
        marker(params.tableName, row, params.kind, params.companyId, params.actorUserId)
      ),
      { onConflict: "sandbox_key,record_table,record_id" }
    ),
    `Failed to mark ${params.kind} sandbox records.`
  );
}

async function resetExistingSafety360Sandbox(
  supabase: Safety360SandboxSupabaseClient,
  actorUserId: string
) {
  const markerResult = await ignoreMissingSchema(
    table<MarkerRow>(supabase, "owner_validation_sandbox_records")
      .select("record_id, record_table")
      .eq("sandbox_key", SAFETY360_TEST_COMPANY_KEY),
    "Failed to load existing sandbox records."
  );
  const markers = (markerResult.data ?? []) as MarkerRow[];
  const contractorEmployeeIds = markers
    .filter((row) => row.record_table === "contractor_employee_profiles")
    .map((row) => row.record_id);

  if (contractorEmployeeIds.length > 0) {
    await ignoreMissingSchema(
      table(supabase, "contractor_employee_profiles").delete().in("id", contractorEmployeeIds),
      "Failed to remove old sandbox employee profiles."
    );
  }

  const existingCompany = await table<CompanyRow>(supabase, "companies")
    .select("id, name")
    .eq("team_key", SAFETY360_TEST_COMPANY_KEY)
    .eq("demo_company", true)
    .maybeSingle();

  if (existingCompany.error && !isMissingSchemaError(existingCompany.error)) {
    throw new Error(existingCompany.error.message || "Failed to find existing sandbox company.");
  }

  if (existingCompany.data?.id) {
    await ignoreMissingSchema(
      table(supabase, "companies")
        .delete()
        .eq("id", existingCompany.data.id)
        .eq("demo_company", true),
      "Failed to remove old Safety360 Test Company records."
    );
  }

  await ignoreMissingSchema(
    table(supabase, "owner_validation_sandbox_records")
      .delete()
      .eq("sandbox_key", SAFETY360_TEST_COMPANY_KEY),
    "Failed to clear old sandbox markers."
  );

  return { resetBy: actorUserId };
}

export function getSafety360SandboxSeedPlan() {
  return {
    employees: [
      ["Avery Parker", "company_admin", "Company Admin", "ready"],
      ["Morgan Lee", "safety_manager", "Safety Manager", "ready"],
      ["Riley Johnson", "foreman", "Foreman", "travel_ready"],
      ["Casey Smith", "employee", "Employee", "needs_training"],
      ["Jordan Reed", "client_viewer", "Client Viewer", "ready"],
      ["Taylor Brooks", "auditor", "Auditor", "ready"],
    ],
    jobsites: ["Active construction jobsite", "High-risk jobsite", "Completed jobsite"],
    jsas: ["Complete JSA", "Incomplete JSA", "High-risk JSA"],
    permits: ["Hot Work permit", "Confined Space permit", "Excavation permit", "LOTO permit"],
    trainingStates: ["Current training", "Expired training", "Missing training"],
    observations: ["Safe observation", "Unsafe observation", "Near-miss observation"],
    incidents: ["Minor incident", "Serious incident draft", "Near miss"],
    correctiveActions: ["Open item", "Completed item", "Overdue item"],
    documents: ["Sample safety plan", "Sample JSA export", "Sample permit export"],
  };
}

async function seedCompany(params: {
  supabase: Safety360SandboxSupabaseClient;
  actorUserId: string;
}) {
  const result = await table<CompanyRow>(params.supabase, "companies")
    .upsert(
      {
        name: SAFETY360_TEST_COMPANY_NAME,
        team_key: SAFETY360_TEST_COMPANY_KEY,
        status: "active",
        industry: "Construction safety sandbox",
        phone: "555-0100",
        website: "https://example.com/safety360-test-company",
        address_line_1: "100 Sandbox Way",
        city: "Austin",
        state_region: "TX",
        postal_code: "78701",
        country: "USA",
        primary_contact_name: "Safety360 Test Owner",
        primary_contact_email: "owner@safety360.test",
        demo_company: true,
        demo_seed_version: SAFETY360_TEST_SEED_VERSION,
        demo_seeded_at: new Date().toISOString(),
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      },
      { onConflict: "team_key" }
    )
    .select("id, name")
    .single();

  return assertOk<CompanyRow>(result, "Failed to create Safety360 Test Company.");
}

async function seedJobsites(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
}) {
  const rows = [
    {
      company_id: params.companyId,
      name: "Active construction jobsite",
      jobsite_number: "S360-ACTIVE-001",
      project_number: "S360-ACTIVE-001",
      location: "Austin, TX",
      status: "active",
      project_manager: "Avery Parker",
      safety_lead: "Morgan Lee",
      start_date: day(-30),
      end_date: day(90),
      notes: "SANDBOX TEST RECORD: active jobsite for owner validation.",
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    },
    {
      company_id: params.companyId,
      name: "High-risk jobsite",
      jobsite_number: "S360-HIGH-002",
      project_number: "S360-HIGH-002",
      location: "San Antonio, TX",
      status: "active",
      project_manager: "Avery Parker",
      safety_lead: "Morgan Lee",
      start_date: day(-10),
      end_date: day(120),
      notes: "SANDBOX TEST RECORD: trenching, hot work, confined space, and LOTO validation.",
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    },
    {
      company_id: params.companyId,
      name: "Completed jobsite",
      jobsite_number: "S360-DONE-003",
      project_number: "S360-DONE-003",
      location: "Round Rock, TX",
      status: "completed",
      project_manager: "Avery Parker",
      safety_lead: "Morgan Lee",
      start_date: day(-180),
      end_date: day(-10),
      notes: "SANDBOX TEST RECORD: completed jobsite for archived/completed-state validation.",
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    },
  ];

  const jobsites = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_jobsites").insert(rows).select("id, name"),
    "Failed to seed Safety360 Test Company jobsites."
  );
  await markSandboxRecords({
    ...params,
    tableName: "company_jobsites",
    kind: "jobsite",
    rows: jobsites,
  });
  return jobsites;
}

async function seedEmployees(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
}) {
  const plan = getSafety360SandboxSeedPlan();
  const employees = assertOk<Array<IdNameRow & { readiness_status?: string }>>(
    await table(params.supabase, "contractor_employee_profiles")
      .insert(
        plan.employees.map(([name, roleKey, title, readiness]) => ({
          full_name: name,
          email: `${roleKey}@safety360.test`,
          email_normalized: `${roleKey}@safety360.test`,
          contractor_company_name: SAFETY360_TEST_COMPANY_NAME,
          trade_specialty: roleKey === "employee" ? "Laborer" : "Safety operations",
          job_title: `${title} - SANDBOX TEST ROLE`,
          readiness_status: readiness,
          years_experience: roleKey === "employee" ? 1 : 8,
          certifications: roleKey === "employee" ? ["OSHA 10"] : ["OSHA 30", "First Aid/CPR"],
          certification_expirations: {
            sandbox: true,
            roleKey,
            source: SAFETY360_TEST_SEED_VERSION,
          },
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        }))
      )
      .select("id, full_name, readiness_status"),
    "Failed to seed sandbox employees."
  );

  await markSandboxRecords({
    supabase: params.supabase,
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    tableName: "contractor_employee_profiles",
    kind: "employee",
    rows: employees,
  });

  const activeJobsite = params.jobsiteIds.get("Active construction jobsite");
  const highRiskJobsite = params.jobsiteIds.get("High-risk jobsite");
  const assignments = employees.flatMap((employee, index) =>
    [activeJobsite, index < 4 ? highRiskJobsite : null].filter(Boolean).map((jobsiteId) => ({
      company_id: params.companyId,
      jobsite_id: jobsiteId,
      contractor_employee_id: employee.id,
      status: "active",
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    }))
  );

  const seededAssignments = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "contractor_employee_jobsite_assignments")
      .insert(assignments)
      .select("id"),
    "Failed to assign sandbox employees to jobsites."
  );
  await markSandboxRecords({
    supabase: params.supabase,
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    tableName: "contractor_employee_jobsite_assignments",
    kind: "employee_jobsite_assignment",
    rows: seededAssignments,
  });

  return employees;
}

async function seedJsas(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
}) {
  const rows = [
    {
      company_id: params.companyId,
      jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
      title: "Complete JSA - scaffold access and material staging",
      description: "SANDBOX TEST RECORD: complete JSA with task steps, hazards, and controls.",
      status: "active",
      severity: "medium",
      category: "general_construction",
      due_at: isoDay(1),
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    },
    {
      company_id: params.companyId,
      jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
      title: "Incomplete JSA - housekeeping follow-up",
      description: "SANDBOX TEST RECORD: intentionally incomplete JSA for warning validation.",
      status: "draft",
      severity: "low",
      category: "housekeeping",
      due_at: isoDay(2),
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    },
    {
      company_id: params.companyId,
      jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
      title: "High-risk JSA - excavation and confined space interface",
      description: "SANDBOX TEST RECORD: high-risk JSA for trenching and confined-space controls.",
      status: "pending_review",
      severity: "critical",
      category: "excavation",
      due_at: isoDay(0),
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    },
  ];

  const jsas = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_jsas").insert(rows).select("id, title"),
    "Failed to seed sandbox JSAs."
  );
  await markSandboxRecords({ ...params, tableName: "company_jsas", kind: "jsa", rows: jsas });

  const jsaIds = byName(jsas);
  const activities = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_jsa_activities")
      .insert([
        {
          company_id: params.companyId,
          jsa_id: jsaIds.get("Complete JSA - scaffold access and material staging"),
          jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
          work_date: day(1),
          trade: "Carpentry",
          activity_name: "Complete JSA task step - scaffold access",
          area: "Level 2 scaffold bay",
          crew_size: 6,
          hazard_category: "falls_from_elevation",
          hazard_description: "Workers access scaffold near material staging zone.",
          mitigation: "Guardrails, tagged scaffold, 100% access control, daily inspection.",
          permit_required: false,
          planned_risk_level: "medium",
          status: "completed",
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jsa_id: jsaIds.get("High-risk JSA - excavation and confined space interface"),
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          work_date: day(1),
          trade: "Civil",
          activity_name: "High-risk JSA task step - trench entry setup",
          area: "Utility trench zone",
          crew_size: 5,
          hazard_category: "excavation_collapse",
          hazard_description: "Potential trench collapse and atmospheric hazards.",
          mitigation: "Competent person inspection, protective system, air monitoring, rescue plan.",
          permit_required: true,
          permit_type: "excavation",
          planned_risk_level: "critical",
          status: "monitored",
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
      ])
      .select("id, activity_name"),
    "Failed to seed sandbox JSA activities."
  );
  await markSandboxRecords({
    ...params,
    tableName: "company_jsa_activities",
    kind: "jsa_activity",
    rows: activities,
  });

  return { jsas, activities };
}

async function seedPermits(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
}) {
  const rows = [
    ["Hot Work permit", "hot_work", "active", "high"],
    ["Confined Space permit", "confined_space", "draft", "critical"],
    ["Excavation permit", "excavation", "active", "critical"],
    ["LOTO permit", "lockout_tagout", "active", "high"],
  ] as const;

  const permits = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_permits")
      .insert(
        rows.map(([title, permitType, status, severity]) => ({
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: `${title} - SANDBOX TEST RECORD`,
          permit_type: permitType,
          status,
          severity,
          category: "safety",
          due_at: isoDay(1),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        }))
      )
      .select("id, title"),
    "Failed to seed sandbox permits."
  );
  await markSandboxRecords({ ...params, tableName: "company_permits", kind: "permit", rows: permits });
  return permits;
}

async function seedTraining(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
  employees: Array<IdNameRow>;
}) {
  const requirements = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "jobsite_contractor_training_requirements")
      .insert([
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
          title: "Current training - Fall Protection Awareness",
          sort_order: 1,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Expired training - Confined Space Entry",
          sort_order: 2,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Missing training - Excavation Competent Person",
          sort_order: 3,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
      ])
      .select("id, title"),
    "Failed to seed sandbox training requirements."
  );
  await markSandboxRecords({
    ...params,
    tableName: "jobsite_contractor_training_requirements",
    kind: "training_requirement",
    rows: requirements,
  });

  const requirementIds = byName(requirements);
  const employeeIds = byName(params.employees);
  const records = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "contractor_employee_training_records")
      .insert([
        {
          contractor_employee_id: employeeIds.get("Casey Smith"),
          requirement_id: requirementIds.get("Current training - Fall Protection Awareness"),
          title: "Current training - Fall Protection Awareness",
          completed_on: day(-20),
          expires_on: day(345),
          notes: "SANDBOX TEST RECORD: current training.",
          updated_by: params.actorUserId,
        },
        {
          contractor_employee_id: employeeIds.get("Riley Johnson"),
          requirement_id: requirementIds.get("Expired training - Confined Space Entry"),
          title: "Expired training - Confined Space Entry",
          completed_on: day(-400),
          expires_on: day(-35),
          notes: "SANDBOX TEST RECORD: expired training.",
          updated_by: params.actorUserId,
        },
      ])
      .select("id, title"),
    "Failed to seed sandbox training records."
  );
  await markSandboxRecords({
    ...params,
    tableName: "contractor_employee_training_records",
    kind: "training_record",
    rows: records,
  });

  return { requirements, records };
}

async function seedObservationsAndActions(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
}) {
  const observations = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_corrective_actions")
      .insert([
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
          title: "Safe observation - barricades installed correctly",
          description: "SANDBOX TEST RECORD: positive field observation.",
          severity: "low",
          priority: "low",
          status: "closed",
          category: "good_catch",
          observation_type: "positive",
          sif_potential: false,
          due_at: isoDay(5),
          closed_at: isoDay(-1),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Unsafe observation - missing trench access ladder",
          description: "SANDBOX TEST RECORD: unsafe observation requiring owner review.",
          severity: "high",
          priority: "high",
          status: "open",
          category: "excavation_trench_concern",
          observation_type: "negative",
          sif_potential: true,
          sif_category: "excavation_collapse",
          due_at: isoDay(-1),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Near-miss observation - dropped object controlled",
          description: "SANDBOX TEST RECORD: near miss for validation testing.",
          severity: "medium",
          priority: "medium",
          status: "in_progress",
          category: "near_miss",
          observation_type: "near_miss",
          sif_potential: false,
          due_at: isoDay(2),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
      ])
      .select("id, title"),
    "Failed to seed sandbox observations."
  );

  const correctiveActions = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_corrective_actions")
      .insert([
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Open item - install trench access ladder",
          description: "SANDBOX TEST RECORD: open corrective action.",
          severity: "high",
          priority: "high",
          status: "open",
          category: "corrective_action",
          observation_type: "negative",
          sif_potential: true,
          sif_category: "excavation_collapse",
          due_at: isoDay(1),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("Completed jobsite"),
          title: "Completed item - closeout fire watch log",
          description: "SANDBOX TEST RECORD: completed corrective action.",
          severity: "medium",
          priority: "medium",
          status: "closed",
          category: "corrective_action",
          observation_type: "negative",
          sif_potential: false,
          due_at: isoDay(-20),
          closed_at: isoDay(-15),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Overdue item - verify LOTO second check",
          description: "SANDBOX TEST RECORD: overdue corrective action.",
          severity: "critical",
          priority: "critical",
          status: "open",
          category: "corrective_action",
          observation_type: "negative",
          sif_potential: true,
          sif_category: "hazardous_energy",
          due_at: isoDay(-3),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
      ])
      .select("id, title"),
    "Failed to seed sandbox corrective actions."
  );

  await markSandboxRecords({
    ...params,
    tableName: "company_corrective_actions",
    kind: "observation",
    rows: observations,
  });
  await markSandboxRecords({
    ...params,
    tableName: "company_corrective_actions",
    kind: "corrective_action",
    rows: correctiveActions,
  });

  return { observations, correctiveActions };
}

async function seedIncidents(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
}) {
  const incidents = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "company_incidents")
      .insert([
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
          title: "Minor incident - first aid scrape",
          description: "SANDBOX TEST RECORD: minor incident.",
          category: "incident",
          severity: "low",
          status: "closed",
          occurred_at: isoDay(-9),
          due_at: isoDay(-7),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Serious incident draft - struck-by review",
          description: "SANDBOX TEST RECORD: serious draft incident for validation.",
          category: "incident",
          severity: "critical",
          status: "open",
          occurred_at: isoDay(-1),
          due_at: isoDay(1),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Near miss - excavation edge sloughing",
          description: "SANDBOX TEST RECORD: near miss incident.",
          category: "near_miss",
          severity: "high",
          status: "in_progress",
          occurred_at: isoDay(-3),
          due_at: isoDay(4),
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
      ])
      .select("id, title"),
    "Failed to seed sandbox incidents."
  );
  await markSandboxRecords({ ...params, tableName: "company_incidents", kind: "incident", rows: incidents });
  return incidents;
}

async function seedDocuments(params: {
  supabase: Safety360SandboxSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsiteIds: Map<string, string>;
}) {
  const documents = assertOk<Array<IdNameRow & { current_version?: number }>>(
    await table(params.supabase, "documents")
      .insert([
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
          title: "Sample safety plan - SANDBOX TEST RECORD",
          document_type: "safety_plan",
          status: "active",
          current_version: 1,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("Active construction jobsite"),
          title: "Sample JSA export - SANDBOX TEST RECORD",
          document_type: "jsa_export",
          status: "active",
          current_version: 1,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
        {
          company_id: params.companyId,
          jobsite_id: params.jobsiteIds.get("High-risk jobsite"),
          title: "Sample permit export - SANDBOX TEST RECORD",
          document_type: "permit_export",
          status: "active",
          current_version: 1,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        },
      ])
      .select("id, title, current_version"),
    "Failed to seed sandbox documents."
  );
  await markSandboxRecords({ ...params, tableName: "documents", kind: "document", rows: documents });

  const versions = assertOk<Array<IdNameRow>>(
    await table(params.supabase, "document_versions")
      .insert(
        documents.map((document) => ({
          document_id: document.id,
          company_id: params.companyId,
          version_number: document.current_version ?? 1,
          storage_bucket: "documents",
          file_path: `sandbox/${SAFETY360_TEST_COMPANY_KEY}/${document.id}.txt`,
          checksum: `sandbox-${document.id}`,
          change_notes: "SANDBOX TEST RECORD: placeholder document version for validation only.",
          created_by_company_user_id: null,
        }))
      )
      .select("id"),
    "Failed to seed sandbox document versions."
  );
  await markSandboxRecords({
    ...params,
    tableName: "document_versions",
    kind: "document_version",
    rows: versions,
  });

  return documents;
}

export async function seedSafety360TestCompany(params: {
  supabase: Safety360SandboxSupabaseClient;
  actorUserId: string;
}): Promise<Safety360SandboxSeedResult> {
  await resetExistingSafety360Sandbox(params.supabase, params.actorUserId);

  const company = await seedCompany(params);
  await markSandboxRecords({
    supabase: params.supabase,
    companyId: company.id,
    actorUserId: params.actorUserId,
    tableName: "companies",
    kind: "company",
    rows: [{ id: company.id, name: company.name }],
  });

  const jobsites = await seedJobsites({ ...params, companyId: company.id });
  const jobsiteIds = byName(jobsites);
  const employees = await seedEmployees({ ...params, companyId: company.id, jobsiteIds });
  const { jsas } = await seedJsas({ ...params, companyId: company.id, jobsiteIds });
  const permits = await seedPermits({ ...params, companyId: company.id, jobsiteIds });
  const training = await seedTraining({
    ...params,
    companyId: company.id,
    jobsiteIds,
    employees,
  });
  const observationsAndActions = await seedObservationsAndActions({
    ...params,
    companyId: company.id,
    jobsiteIds,
  });
  const incidents = await seedIncidents({ ...params, companyId: company.id, jobsiteIds });
  const documents = await seedDocuments({ ...params, companyId: company.id, jobsiteIds });

  return {
    companyId: company.id,
    companyName: company.name,
    sandboxKey: SAFETY360_TEST_COMPANY_KEY,
    counts: {
      employees: employees.length,
      jobsites: jobsites.length,
      jsas: jsas.length,
      permits: permits.length,
      trainingRequirements: training.requirements.length,
      trainingRecords: training.records.length,
      observations: observationsAndActions.observations.length,
      incidents: incidents.length,
      correctiveActions: observationsAndActions.correctiveActions.length,
      documents: documents.length,
    },
  };
}

export async function loadSafety360TestCompanySummary(supabase: Safety360SandboxSupabaseClient) {
  const company = await table<CompanyRow>(supabase, "companies")
    .select("id, name")
    .eq("team_key", SAFETY360_TEST_COMPANY_KEY)
    .eq("demo_company", true)
    .maybeSingle();

  if (company.error && !isMissingSchemaError(company.error)) {
    throw new Error(company.error.message || "Failed to load Safety360 Test Company.");
  }

  if (!company.data) {
    return {
      exists: false,
      companyId: null,
      companyName: SAFETY360_TEST_COMPANY_NAME,
      sandboxKey: SAFETY360_TEST_COMPANY_KEY,
      records: [],
    };
  }

  const records = await ignoreMissingSchema(
    table(supabase, "owner_validation_sandbox_records")
      .select("record_table, record_kind, record_label")
      .eq("sandbox_key", SAFETY360_TEST_COMPANY_KEY),
    "Failed to load sandbox record markers."
  );

  return {
    exists: true,
    companyId: company.data.id,
    companyName: company.data.name,
    sandboxKey: SAFETY360_TEST_COMPANY_KEY,
    records: records.data ?? [],
  };
}
