export const DEMO_COMPANY_NAME = "Demo Construction";
export const DEMO_SEED_VERSION = "demo-mode-v1";

type SupabaseError = { message?: string | null } | null;
type SupabaseResult<T = unknown> = { data?: T | null; error?: SupabaseError; count?: number | null };
type SupabaseQuery<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (...args: unknown[]) => SupabaseQuery<T>;
  eq: (...args: unknown[]) => SupabaseQuery<T>;
  in: (...args: unknown[]) => SupabaseQuery<T>;
  order: (...args: unknown[]) => SupabaseQuery<T>;
  limit: (...args: unknown[]) => SupabaseQuery<T>;
  maybeSingle: () => Promise<SupabaseResult<T>>;
  single: () => Promise<SupabaseResult<T>>;
  insert: (...args: unknown[]) => SupabaseQuery<T>;
  upsert: (...args: unknown[]) => SupabaseQuery<T>;
  update: (...args: unknown[]) => SupabaseQuery<T>;
  delete: () => SupabaseQuery<T>;
};

export type DemoSeedSupabaseClient = {
  from: (table: string) => unknown;
};

type CompanyRow = {
  id: string;
  name?: string | null;
  company_id?: string | null;
  team?: string | null;
  demo_previous_company_id?: string | null;
};

type SeedResult = {
  companyId: string;
  companyName: string;
  previousCompanyId: string | null;
  counts: {
    jobsites: number;
    scheduleActivities: number;
    permits: number;
    jsas: number;
    jsaActivities: number;
    observations: number;
    incidents: number;
    correctiveActions: number;
    trainingRequirements: number;
    microsoftProjects: number;
    microsoftTasks: number;
  };
};

type ResetResult = {
  companyId: string | null;
  restoredCompanyId: string | null;
  deletedDemoCompany: boolean;
};

function table<T = unknown>(supabase: DemoSeedSupabaseClient, name: string) {
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

function teamKeyForActor(actorUserId: string) {
  const suffix = actorUserId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "user";
  return `demo-construction-${suffix}`;
}

async function loadCurrentRole(supabase: DemoSeedSupabaseClient, actorUserId: string) {
  const result = await table<CompanyRow>(supabase, "user_roles")
    .select("company_id, team")
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (result.error && !isMissingSchemaError(result.error)) {
    throw new Error(result.error.message || "Failed to load current user role.");
  }
  return result.data ?? null;
}

async function loadCompany(supabase: DemoSeedSupabaseClient, companyId: string | null | undefined) {
  if (!companyId) return null;
  const result = await table<CompanyRow>(supabase, "companies")
    .select("id, name, demo_previous_company_id")
    .eq("id", companyId)
    .maybeSingle();
  if (result.error && !isMissingSchemaError(result.error)) {
    throw new Error(result.error.message || "Failed to load company.");
  }
  return result.data ?? null;
}

async function loadDemoCompany(supabase: DemoSeedSupabaseClient, actorUserId: string) {
  const result = await table<CompanyRow>(supabase, "companies")
    .select("id, name, demo_previous_company_id")
    .eq("team_key", teamKeyForActor(actorUserId))
    .eq("demo_company", true)
    .maybeSingle();
  if (result.error && !isMissingSchemaError(result.error)) {
    throw new Error(result.error.message || "Failed to load demo company.");
  }
  return result.data ?? null;
}

async function resetDemoCompanyRows(supabase: DemoSeedSupabaseClient, companyId: string) {
  const companyTables = [
    "company_corrective_action_events",
    "company_corrective_action_evidence",
    "company_risk_events",
    "company_microsoft_project_assignments",
    "company_microsoft_project_tasks",
    "company_microsoft_project_sources",
    "company_integration_sync_runs",
    "company_integration_connections",
    "company_induction_completions",
    "company_induction_requirements",
    "company_induction_programs",
    "company_training_requirements",
    "company_permits",
    "company_incidents",
    "company_jsa_activities",
    "company_jsas",
    "company_corrective_actions",
    "company_jobsites",
  ];

  await ignoreMissingSchema(
    table(supabase, "company_sor_records")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("is_deleted", false),
    "Failed to soft-delete demo SOR records."
  );

  for (const name of companyTables) {
    await ignoreMissingSchema(
      table(supabase, name).delete().eq("company_id", companyId),
      `Failed to reset demo rows in ${name}.`
    );
  }
}

async function ensureDemoCompany(params: {
  supabase: DemoSeedSupabaseClient;
  actorUserId: string;
  actorEmail?: string | null;
  previousCompanyId: string | null;
}) {
  const { supabase, actorUserId, actorEmail, previousCompanyId } = params;
  const result = await table<CompanyRow>(supabase, "companies")
    .upsert(
      {
        name: DEMO_COMPANY_NAME,
        team_key: teamKeyForActor(actorUserId),
        status: "active",
        industry: "Commercial construction",
        phone: "555-0136",
        website: "https://example.com/demo-construction",
        address_line_1: "100 Demo Yard",
        city: "Austin",
        state_region: "TX",
        postal_code: "78701",
        country: "USA",
        primary_contact_name: "Demo Safety Team",
        primary_contact_email: actorEmail || "demo@safepredict.example",
        demo_company: true,
        demo_seed_version: DEMO_SEED_VERSION,
        demo_seeded_at: new Date().toISOString(),
        demo_previous_company_id: previousCompanyId,
        created_by: actorUserId,
        updated_by: actorUserId,
      },
      { onConflict: "team_key" }
    )
    .select("id, name, demo_previous_company_id")
    .single();

  return assertOk<CompanyRow>(result, "Failed to create demo company.");
}

async function switchUserToDemo(params: {
  supabase: DemoSeedSupabaseClient;
  actorUserId: string;
  companyId: string;
}) {
  const { supabase, actorUserId, companyId } = params;
  await ignoreMissingSchema(
    table(supabase, "company_memberships").upsert(
      {
        user_id: actorUserId,
        company_id: companyId,
        role: "company_admin",
        status: "active",
        created_by: actorUserId,
        updated_by: actorUserId,
      },
      { onConflict: "user_id,company_id" }
    ),
    "Failed to attach demo company membership."
  );

  await ignoreMissingSchema(
    table(supabase, "user_roles")
      .update({
        company_id: companyId,
        team: DEMO_COMPANY_NAME,
        account_status: "active",
        updated_by: actorUserId,
      })
      .eq("user_id", actorUserId),
    "Failed to switch active company to demo."
  );
}

async function seedSubscription(supabase: DemoSeedSupabaseClient, companyId: string, actorUserId: string) {
  await ignoreMissingSchema(
    table(supabase, "company_subscriptions").upsert(
      {
        company_id: companyId,
        status: "active",
        plan_name: "Enterprise",
        credit_balance: 500,
        created_by: actorUserId,
        updated_by: actorUserId,
      },
      { onConflict: "company_id" }
    ),
    "Failed to seed demo subscription."
  );
}

async function seedJobsites(supabase: DemoSeedSupabaseClient, companyId: string, actorUserId: string) {
  const rows = [
    {
      company_id: companyId,
      name: "LKC Phase 3",
      jobsite_number: "DEMO-LKC-03",
      project_number: "DEMO-LKC-03",
      location: "Austin, TX",
      status: "active",
      project_manager: "Jordan Lee",
      safety_lead: "Maria Chen",
      start_date: day(-42),
      end_date: day(120),
      notes: "High-rise phase with steel erection, roofing, hot work, and crane picks.",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      name: "Hospital Expansion",
      jobsite_number: "DEMO-HOSP-02",
      project_number: "DEMO-HOSP-02",
      location: "San Antonio, TX",
      status: "active",
      project_manager: "Nora Williams",
      safety_lead: "Grace Kim",
      start_date: day(-18),
      end_date: day(180),
      notes: "Occupied healthcare expansion with electrical, confined-space, and infection-control interfaces.",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      name: "Warehouse Buildout",
      jobsite_number: "DEMO-WH-11",
      project_number: "DEMO-WH-11",
      location: "Round Rock, TX",
      status: "planned",
      project_manager: "Eli Brooks",
      safety_lead: "Maria Chen",
      start_date: day(7),
      end_date: day(95),
      notes: "Warehouse fit-out with roofing, loading dock, and material-handling exposure.",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
  ];

  const result = await table<Array<{ id: string; name: string }>>(supabase, "company_jobsites")
    .insert(rows)
    .select("id, name");
  const data = assertOk<Array<{ id: string; name: string }>>(result, "Failed to seed demo projects.");
  return new Map(data.map((row) => [row.name, row.id]));
}

async function seedJsaWorkflows(params: {
  supabase: DemoSeedSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsites: Map<string, string>;
}) {
  const { supabase, companyId, actorUserId, jobsites } = params;
  const jsaRows = [
    {
      company_id: companyId,
      jobsite_id: jobsites.get("LKC Phase 3"),
      title: "Steel erection and crane pick JSA",
      description: "Pre-task planning for steel erection, hoisting, decking, and leading edge work.",
      status: "active",
      severity: "critical",
      category: "steel_erection",
      due_at: isoDay(1),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jobsite_id: jobsites.get("Hospital Expansion"),
      title: "Electrical rough-in and LOTO JSA",
      description: "Electrical rough-in with energized boundary controls and lockout verification.",
      status: "active",
      severity: "high",
      category: "electrical",
      due_at: isoDay(2),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jobsite_id: jobsites.get("Warehouse Buildout"),
      title: "Roofing and loading dock access JSA",
      description: "Roof work, material staging, and mobile equipment interface controls.",
      status: "draft",
      severity: "high",
      category: "roofing",
      due_at: isoDay(5),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
  ];

  const jsas = assertOk<Array<{ id: string; title: string; jobsite_id: string | null }>>(
    await table(supabase, "company_jsas").insert(jsaRows).select("id, title, jobsite_id"),
    "Failed to seed demo JSAs."
  );
  const jsaByTitle = new Map(jsas.map((row) => [row.title, row]));

  const activityRows = [
    {
      company_id: companyId,
      jsa_id: jsaByTitle.get("Steel erection and crane pick JSA")?.id,
      jobsite_id: jobsites.get("LKC Phase 3"),
      work_date: day(1),
      trade: "Ironworkers",
      activity_name: "Steel erection - level 6 beam setting",
      area: "LKC Phase 3 - Grid B4",
      crew_size: 8,
      hazard_category: "falls_from_elevation",
      hazard_description: "Leading edge work during crane-assisted steel setting.",
      mitigation: "Controlled decking zone, 100% tie-off, verified rescue kit, signal person.",
      permit_required: true,
      permit_type: "critical_lift",
      planned_risk_level: "critical",
      status: "planned",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jsa_id: jsaByTitle.get("Electrical rough-in and LOTO JSA")?.id,
      jobsite_id: jobsites.get("Hospital Expansion"),
      work_date: day(3),
      trade: "Electrical",
      activity_name: "Electrical rough-in above active corridor",
      area: "Hospital Expansion - Level 2",
      crew_size: 5,
      hazard_category: "electrical_energy",
      hazard_description: "Energized-system proximity and overhead work in occupied area.",
      mitigation: "LOTO verification, barricaded corridor, spotter, infection-control partition.",
      permit_required: true,
      permit_type: "electrical",
      planned_risk_level: "high",
      status: "planned",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jsa_id: jsaByTitle.get("Roofing and loading dock access JSA")?.id,
      jobsite_id: jobsites.get("Warehouse Buildout"),
      work_date: day(6),
      trade: "Roofing",
      activity_name: "Roofing membrane install near skylights",
      area: "Warehouse Buildout - Roof Zone C",
      crew_size: 6,
      hazard_category: "roof_openings",
      hazard_description: "Skylight exposure and material staging near roof edge.",
      mitigation: "Skylight covers, warning lines, controlled access zone, weather hold point.",
      permit_required: true,
      permit_type: "roof_work",
      planned_risk_level: "high",
      status: "planned",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jsa_id: jsaByTitle.get("Electrical rough-in and LOTO JSA")?.id,
      jobsite_id: jobsites.get("Hospital Expansion"),
      work_date: day(4),
      trade: "Mechanical",
      activity_name: "Confined space valve tie-in",
      area: "Hospital Expansion - Utility tunnel",
      crew_size: 4,
      hazard_category: "confined_space",
      hazard_description: "Restricted access utility tunnel with atmospheric and rescue planning needs.",
      mitigation: "Entry permit, gas monitor, attendant, rescue plan, communication check.",
      permit_required: true,
      permit_type: "confined_space",
      planned_risk_level: "critical",
      status: "monitored",
      created_by: actorUserId,
      updated_by: actorUserId,
    },
  ];

  const activities = assertOk<Array<{ id: string; activity_name: string; jobsite_id: string | null }>>(
    await table(supabase, "company_jsa_activities").insert(activityRows).select("id, activity_name, jobsite_id"),
    "Failed to seed demo JSA activities."
  );

  return {
    jsas,
    activities,
    activitiesByName: new Map(activities.map((row) => [row.activity_name, row])),
  };
}

async function seedPermits(params: {
  supabase: DemoSeedSupabaseClient;
  companyId: string;
  actorUserId: string;
  activitiesByName: Map<string, { id: string; jobsite_id: string | null }>;
}) {
  const { supabase, companyId, actorUserId, activitiesByName } = params;
  const rows = [
    {
      title: "Critical lift permit - level 6 beam setting",
      permit_type: "critical_lift",
      severity: "critical",
      status: "active",
      category: "operations",
      sif_flag: true,
      escalation_level: "critical",
      escalation_reason: "Tandem crane pick near active access route.",
      stop_work_status: "stop_work_requested",
      stop_work_reason: "Confirm exclusion zone before lift resumes.",
      due_at: isoDay(1),
      activityName: "Steel erection - level 6 beam setting",
    },
    {
      title: "Electrical permit - rough-in above corridor",
      permit_type: "electrical",
      severity: "high",
      status: "active",
      category: "operations",
      sif_flag: true,
      escalation_level: "urgent",
      escalation_reason: "LOTO signoff is incomplete for occupied corridor interface.",
      stop_work_status: "normal",
      stop_work_reason: null,
      due_at: isoDay(3),
      activityName: "Electrical rough-in above active corridor",
    },
    {
      title: "Confined space entry permit - utility tunnel",
      permit_type: "confined_space",
      severity: "critical",
      status: "draft",
      category: "safety",
      sif_flag: true,
      escalation_level: "urgent",
      escalation_reason: "Rescue team coverage not verified.",
      stop_work_status: "stop_work_requested",
      stop_work_reason: "Entry cannot start until attendant and rescue plan are documented.",
      due_at: isoDay(4),
      activityName: "Confined space valve tie-in",
    },
    {
      title: "Roof work permit - membrane install near skylights",
      permit_type: "roof_work",
      severity: "high",
      status: "active",
      category: "safety",
      sif_flag: false,
      escalation_level: "monitor",
      escalation_reason: "Weather shift could move staging near uncovered skylights.",
      stop_work_status: "normal",
      stop_work_reason: null,
      due_at: isoDay(6),
      activityName: "Roofing membrane install near skylights",
    },
  ].map((row) => {
    const activity = activitiesByName.get(row.activityName);
    return {
      company_id: companyId,
      jobsite_id: activity?.jobsite_id ?? null,
      dap_activity_id: activity?.id ?? null,
      title: row.title,
      permit_type: row.permit_type,
      severity: row.severity,
      status: row.status,
      category: row.category,
      sif_flag: row.sif_flag,
      escalation_level: row.escalation_level,
      escalation_reason: row.escalation_reason,
      stop_work_status: row.stop_work_status,
      stop_work_reason: row.stop_work_reason,
      escalated_at: row.escalation_level === "none" ? null : isoDay(0, 12),
      stop_work_at: row.stop_work_status === "stop_work_active" ? isoDay(0, 12) : null,
      due_at: row.due_at,
      created_by: actorUserId,
      updated_by: actorUserId,
    };
  });

  return assertOk<Array<{ id: string; title: string }>>(
    await table(supabase, "company_permits").insert(rows).select("id, title"),
    "Failed to seed demo permits."
  );
}

async function seedCorrectiveActions(params: {
  supabase: DemoSeedSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsites: Map<string, string>;
}) {
  const { supabase, companyId, actorUserId, jobsites } = params;
  const rows = [
    {
      company_id: companyId,
      jobsite_id: jobsites.get("LKC Phase 3"),
      title: "Guardrail gap at west stair opening",
      description: "Temporary rail removed for material pass-through and not restored.",
      severity: "critical",
      priority: "critical",
      status: "open",
      category: "fall_protection",
      observation_type: "negative",
      sif_potential: true,
      sif_category: "fall_from_elevation",
      due_at: isoDay(-2),
      created_at: isoDay(-5, 13),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jobsite_id: jobsites.get("Hospital Expansion"),
      title: "LOTO second-person verification missing",
      description: "Panel tie-in package is waiting on second qualified worker verification.",
      severity: "high",
      priority: "high",
      status: "in_progress",
      category: "electrical",
      observation_type: "negative",
      sif_potential: true,
      sif_category: "electrical_contact",
      due_at: isoDay(-1),
      created_at: isoDay(-4, 15),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jobsite_id: jobsites.get("Warehouse Buildout"),
      title: "Fire watch documentation incomplete",
      description: "Hot work closeout did not include the final fire watch timestamp.",
      severity: "medium",
      priority: "medium",
      status: "open",
      category: "hot_work",
      observation_type: "negative",
      sif_potential: false,
      sif_category: null,
      due_at: isoDay(1),
      created_at: isoDay(-2, 16),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
  ];

  const actions = assertOk<Array<{ id: string; title: string }>>(
    await table(supabase, "company_corrective_actions").insert(rows).select("id, title"),
    "Failed to seed demo corrective actions."
  );

  await ignoreMissingSchema(
    table(supabase, "company_risk_events").insert(
      actions.map((action) => ({
        company_id: companyId,
        module_name: "corrective_actions",
        record_id: action.id,
        event_type: "demo_seeded",
        detail: "Demo corrective action seeded for predictive risk.",
        event_payload: { demo: true, seedVersion: DEMO_SEED_VERSION },
        created_by: actorUserId,
      }))
    ),
    "Failed to seed demo corrective action risk events."
  );

  return actions;
}

async function seedIncidents(params: {
  supabase: DemoSeedSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsites: Map<string, string>;
}) {
  const { supabase, companyId, actorUserId, jobsites } = params;
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const rows = [
    {
      company_id: companyId,
      jobsite_id: jobsites.get("LKC Phase 3"),
      title: "Near miss: dropped spud wrench below steel bay",
      description: "Tool lanyard failed inspection before overhead work resumed.",
      category: "near_miss",
      severity: "high",
      status: "open",
      occurred_at: isoDay(-3, 17),
      sif_flag: true,
      escalation_level: "urgent",
      stop_work_status: "cleared",
      injury_type: null,
      body_part: null,
      injury_source: "material_handling",
      exposure_event_type: "struck_by_object",
      recordable: false,
      lost_time: false,
      fatality: false,
      days_away_from_work: 0,
      days_restricted: 0,
      job_transfer: false,
      injury_month: month,
      injury_season: "spring",
      injury_day_of_week: "wednesday",
      injury_time_of_day: "afternoon",
      prediction_validation_status: "pending",
      created_at: isoDay(-3, 17),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jobsite_id: jobsites.get("Hospital Expansion"),
      title: "Recordable hand laceration during material staging",
      description: "Worker received sutures after handling sheet metal in a congested staging area.",
      category: "incident",
      severity: "high",
      status: "in_progress",
      occurred_at: isoDay(-7, 18),
      sif_flag: true,
      escalation_level: "urgent",
      stop_work_status: "normal",
      injury_type: "laceration",
      body_part: "hand",
      injury_source: "hand_tools",
      exposure_event_type: "contact_with_equipment",
      recordable: true,
      lost_time: false,
      fatality: false,
      days_away_from_work: 0,
      days_restricted: 2,
      job_transfer: true,
      injury_month: month,
      injury_season: "spring",
      injury_day_of_week: "monday",
      injury_time_of_day: "afternoon",
      prediction_validation_status: "pending",
      created_at: isoDay(-7, 18),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
    {
      company_id: companyId,
      jobsite_id: jobsites.get("Warehouse Buildout"),
      title: "Forklift pedestrian aisle conflict",
      description: "Spotter stopped forklift travel after temporary pedestrian route shifted.",
      category: "near_miss",
      severity: "medium",
      status: "open",
      occurred_at: isoDay(-1, 19),
      sif_flag: false,
      escalation_level: "monitor",
      stop_work_status: "normal",
      injury_type: null,
      body_part: null,
      injury_source: "heavy_equipment",
      exposure_event_type: "struck_by_vehicle",
      recordable: false,
      lost_time: false,
      fatality: false,
      days_away_from_work: 0,
      days_restricted: 0,
      job_transfer: false,
      injury_month: month,
      injury_season: "spring",
      injury_day_of_week: "thursday",
      injury_time_of_day: "morning",
      prediction_validation_status: "pending",
      created_at: isoDay(-1, 19),
      created_by: actorUserId,
      updated_by: actorUserId,
    },
  ];

  return assertOk<Array<{ id: string; title: string }>>(
    await table(supabase, "company_incidents").insert(rows).select("id, title"),
    "Failed to seed demo incidents."
  );
}

async function seedTraining(params: {
  supabase: DemoSeedSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsites: Map<string, string>;
}) {
  const { supabase, companyId, actorUserId, jobsites } = params;
  const requirements = [
    {
      title: "Fall Protection Competent Person",
      sort_order: 1,
      match_keywords: ["Fall Protection Competent Person", "Fall Protection"],
      match_fields: ["certifications"],
      apply_trades: ["Structural Steel and Erection", "Roofing"],
      apply_positions: ["Foreman", "Safety Manager", "Superintendent"],
      apply_sub_trades: ["Steel Erection and Decking", "Roofing"],
      apply_task_codes: ["work_at_heights", "steel_erection", "roof_openings"],
      renewal_months: 24,
      is_generated: true,
      generated_source_type: "demo_seed",
      generated_source_document_id: null,
      generated_source_operation_key: "lkc-phase-3-steel-erection",
    },
    {
      title: "LOTO Authorized Worker",
      sort_order: 2,
      match_keywords: ["LOTO Authorized Worker", "Lockout/Tagout"],
      match_fields: ["certifications"],
      apply_trades: ["Electrical and Instrumentation"],
      apply_positions: ["Electrician", "Foreman", "Safety Manager"],
      apply_sub_trades: ["Panel and distribution systems"],
      apply_task_codes: ["loto_activities", "energized_work_boundaries"],
      renewal_months: 12,
      is_generated: true,
      generated_source_type: "demo_seed",
      generated_source_document_id: null,
      generated_source_operation_key: "hospital-electrical-rough-in",
    },
    {
      title: "Rigging and Signal Person",
      sort_order: 3,
      match_keywords: ["Qualified Rigger", "Signal Person", "Rigging and Signal Person"],
      match_fields: ["certifications"],
      apply_trades: ["Structural Steel and Erection"],
      apply_positions: ["Foreman", "Rigger / Signal", "Apprentice Ironworker"],
      apply_sub_trades: ["Steel Erection and Decking"],
      apply_task_codes: ["critical_lift", "hoisting_and_rigging"],
      renewal_months: 24,
      is_generated: true,
      generated_source_type: "demo_seed",
      generated_source_document_id: null,
      generated_source_operation_key: "lkc-critical-lift",
    },
    {
      title: "Confined Space Entry + Rescue Awareness",
      sort_order: 4,
      match_keywords: ["Confined Space Entry", "Confined Space Rescue Awareness"],
      match_fields: ["certifications"],
      apply_trades: ["Mechanical", "Electrical and Instrumentation"],
      apply_positions: ["Foreman", "Safety Manager", "Field Technician"],
      apply_sub_trades: ["Utility tie-ins"],
      apply_task_codes: ["confined_space_entry"],
      renewal_months: 12,
      is_generated: true,
      generated_source_type: "demo_seed",
      generated_source_document_id: null,
      generated_source_operation_key: "hospital-confined-space",
    },
  ].map((row) => ({
    ...row,
    company_id: companyId,
    created_by: actorUserId,
    updated_by: actorUserId,
  }));

  const seededRequirements = assertOk<Array<{ id: string }>>(
    await table(supabase, "company_training_requirements").insert(requirements).select("id"),
    "Failed to seed demo training requirements."
  );

  const programResult = await table<Array<{ id: string; name: string }>>(supabase, "company_induction_programs")
    .insert([
      {
        company_id: companyId,
        name: "High-Risk Work Orientation",
        description: "Demo orientation covering lift plans, hot work, LOTO, and stop-work triggers.",
        audience: "worker",
        required_docs: [
          { label: "OSHA 10/30 card", status: "required" },
          { label: "Task-specific training proof", status: "required" },
        ],
        active: true,
        created_by: actorUserId,
        updated_by: actorUserId,
      },
    ])
    .select("id, name");

  if (!programResult.error && programResult.data?.[0]) {
    const program = programResult.data[0];
    await ignoreMissingSchema(
      table(supabase, "company_induction_requirements").insert(
        [...jobsites.values()].map((jobsiteId) => ({
          company_id: companyId,
          program_id: program.id,
          jobsite_id: jobsiteId,
          active: true,
          effective_from: day(-10),
          created_by: actorUserId,
        }))
      ),
      "Failed to seed demo induction requirements."
    );
    await ignoreMissingSchema(
      table(supabase, "company_induction_completions").insert([
        {
          company_id: companyId,
          program_id: program.id,
          jobsite_id: jobsites.get("LKC Phase 3"),
          visitor_display_name: "Diego Ramos - Ironworker Foreman",
          completed_at: isoDay(-65),
          expires_at: isoDay(-5),
          notes: "Expired demo training record: fall protection renewal overdue.",
          completed_by: actorUserId,
        },
        {
          company_id: companyId,
          program_id: program.id,
          jobsite_id: jobsites.get("Hospital Expansion"),
          visitor_display_name: "Taylor Brooks - Electrical Apprentice",
          completed_at: isoDay(-20),
          expires_at: isoDay(10),
          notes: "LOTO practical verification still open.",
          completed_by: actorUserId,
        },
      ]),
      "Failed to seed demo induction completions."
    );
  } else if (programResult.error && !isMissingSchemaError(programResult.error)) {
    throw new Error(programResult.error.message || "Failed to seed demo induction program.");
  }

  return seededRequirements;
}

async function seedMicrosoftProject(params: {
  supabase: DemoSeedSupabaseClient;
  companyId: string;
  actorUserId: string;
  jobsites: Map<string, string>;
}) {
  const { supabase, companyId, actorUserId, jobsites } = params;
  const connection = assertOk<{ id: string }>(
    await table(supabase, "company_integration_connections")
      .upsert(
        {
          company_id: companyId,
          provider: "microsoft_project",
          status: "connected",
          display_name: "Microsoft Project Demo",
          account_email: "planner.demo@safepredict.example",
          tenant_id: "demo-tenant",
          scopes: ["demo.schedule.read"],
          dataverse_environment_url: "https://demo.crm.dynamics.com",
          encrypted_access_token: null,
          encrypted_refresh_token: null,
          metadata: { demo: true, source: "seedDemoCompany" },
          last_sync_at: new Date().toISOString(),
          created_by: actorUserId,
          updated_by: actorUserId,
        },
        { onConflict: "company_id,provider" }
      )
      .select("id")
      .single(),
    "Failed to seed Microsoft Project demo connection."
  );

  await ignoreMissingSchema(
    table(supabase, "company_integration_sync_runs").insert({
      company_id: companyId,
      connection_id: connection.id,
      provider: "microsoft_project",
      status: "succeeded",
      finished_at: new Date().toISOString(),
      projects_seen: 3,
      projects_imported: 3,
      tasks_seen: 6,
      tasks_imported: 6,
      assignments_seen: 5,
      assignments_imported: 5,
      metadata: { demo: true },
      created_by: actorUserId,
    }),
    "Failed to seed Microsoft Project demo sync run."
  );

  const projects = assertOk<Array<{ id: string; source_project_id: string; name: string }>>(
    await table(supabase, "company_microsoft_project_sources")
      .insert([
        {
          company_id: companyId,
          connection_id: connection.id,
          source_system: "dataverse_project",
          source_project_id: "demo-lkc-phase-3",
          source_project_url: "https://demo.crm.dynamics.com/projects/lkc-phase-3",
          name: "LKC Phase 3",
          project_number: "DEMO-LKC-03",
          status: "active",
          start_date: day(-42),
          end_date: day(120),
          owner_name: "Jordan Lee",
          owner_email: "jordan.demo@safepredict.example",
          raw_payload: { demo: true },
          jobsite_id: jobsites.get("LKC Phase 3"),
          created_by: actorUserId,
          updated_by: actorUserId,
        },
        {
          company_id: companyId,
          connection_id: connection.id,
          source_system: "dataverse_project",
          source_project_id: "demo-hospital-expansion",
          source_project_url: "https://demo.crm.dynamics.com/projects/hospital-expansion",
          name: "Hospital Expansion",
          project_number: "DEMO-HOSP-02",
          status: "active",
          start_date: day(-18),
          end_date: day(180),
          owner_name: "Nora Williams",
          owner_email: "nora.demo@safepredict.example",
          raw_payload: { demo: true },
          jobsite_id: jobsites.get("Hospital Expansion"),
          created_by: actorUserId,
          updated_by: actorUserId,
        },
        {
          company_id: companyId,
          connection_id: connection.id,
          source_system: "dataverse_project",
          source_project_id: "demo-warehouse-buildout",
          source_project_url: "https://demo.crm.dynamics.com/projects/warehouse-buildout",
          name: "Warehouse Buildout",
          project_number: "DEMO-WH-11",
          status: "planned",
          start_date: day(7),
          end_date: day(95),
          owner_name: "Eli Brooks",
          owner_email: "eli.demo@safepredict.example",
          raw_payload: { demo: true },
          jobsite_id: jobsites.get("Warehouse Buildout"),
          created_by: actorUserId,
          updated_by: actorUserId,
        },
      ])
      .select("id, source_project_id, name"),
    "Failed to seed Microsoft Project demo projects."
  );
  const projectBySourceId = new Map(projects.map((project) => [project.source_project_id, project]));

  const taskRows = [
    ["demo-lkc-phase-3", "lkc-steel-erection", "Steel erection", "Ironworkers", day(1), day(4), "high"],
    ["demo-lkc-phase-3", "lkc-hot-work", "Hot work fire watch verification", "Welders", day(2), day(2), "high"],
    ["demo-hospital-expansion", "hospital-electrical-rough-in", "Electrical rough-in", "Electrical", day(3), day(8), "medium"],
    ["demo-hospital-expansion", "hospital-confined-space", "Confined space valve tie-in", "Mechanical", day(4), day(5), "high"],
    ["demo-warehouse-buildout", "warehouse-roofing", "Roofing membrane install", "Roofing", day(6), day(10), "high"],
    ["demo-warehouse-buildout", "warehouse-dock-staging", "Loading dock material staging", "Laborers", day(8), day(9), "medium"],
  ] as const;

  const tasks = assertOk<Array<{ id: string; source_task_id: string; project_source_id: string | null }>>(
    await table(supabase, "company_microsoft_project_tasks")
      .insert(
        taskRows.map(([sourceProjectId, sourceTaskId, title, trade, startAt, dueAt, priority]) => {
          const project = projectBySourceId.get(sourceProjectId);
          return {
            company_id: companyId,
            connection_id: connection.id,
            project_source_id: project?.id ?? null,
            jobsite_id: jobsites.get(project?.name ?? "") ?? null,
            source_system: "dataverse_project",
            source_project_id: sourceProjectId,
            source_task_id: sourceTaskId,
            title,
            notes: `Demo schedule activity for ${trade}.`,
            status: "not_started",
            percent_complete: 0,
            priority,
            bucket_name: trade,
            start_at: `${startAt}T14:00:00.000Z`,
            due_at: `${dueAt}T22:00:00.000Z`,
            raw_payload: { demo: true, trade, risk: priority },
            created_by: actorUserId,
            updated_by: actorUserId,
          };
        })
      )
      .select("id, source_task_id, project_source_id"),
    "Failed to seed Microsoft Project demo tasks."
  );

  await ignoreMissingSchema(
    table(supabase, "company_microsoft_project_assignments").insert(
      tasks.slice(0, 5).map((task, index) => ({
        company_id: companyId,
        connection_id: connection.id,
        project_source_id: task.project_source_id,
        task_id: task.id,
        source_assignment_id: `demo-assignment-${index + 1}`,
        source_user_id: `demo-worker-${index + 1}`,
        display_name: ["Jordan Lee", "Maria Chen", "Grace Kim", "Eli Brooks", "Nora Williams"][index],
        email: `demo.worker.${index + 1}@safepredict.example`,
        raw_payload: { demo: true },
        created_by: actorUserId,
        updated_by: actorUserId,
      }))
    ),
    "Failed to seed Microsoft Project demo assignments."
  );

  return { projects, tasks };
}

export async function seedDemoCompany(params: {
  supabase: DemoSeedSupabaseClient;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<SeedResult> {
  const { supabase, actorUserId, actorEmail } = params;
  const currentRole = await loadCurrentRole(supabase, actorUserId);
  const existingDemo = await loadDemoCompany(supabase, actorUserId);
  const currentCompany = await loadCompany(supabase, currentRole?.company_id);
  const previousCompanyId =
    currentRole?.company_id && currentRole.company_id !== existingDemo?.id ? currentRole.company_id : existingDemo?.demo_previous_company_id ?? null;

  const company = await ensureDemoCompany({
    supabase,
    actorUserId,
    actorEmail,
    previousCompanyId,
  });

  await resetDemoCompanyRows(supabase, company.id);
  await seedSubscription(supabase, company.id, actorUserId);
  await switchUserToDemo({ supabase, actorUserId, companyId: company.id });

  const jobsites = await seedJobsites(supabase, company.id, actorUserId);
  const jsa = await seedJsaWorkflows({ supabase, companyId: company.id, actorUserId, jobsites });
  const permits = await seedPermits({ supabase, companyId: company.id, actorUserId, activitiesByName: jsa.activitiesByName });
  const correctiveActions = await seedCorrectiveActions({ supabase, companyId: company.id, actorUserId, jobsites });
  const incidents = await seedIncidents({ supabase, companyId: company.id, actorUserId, jobsites });
  const trainingRequirements = await seedTraining({ supabase, companyId: company.id, actorUserId, jobsites });
  const microsoft = await seedMicrosoftProject({ supabase, companyId: company.id, actorUserId, jobsites });

  return {
    companyId: company.id,
    companyName: company.name || DEMO_COMPANY_NAME,
    previousCompanyId: currentCompany?.id ?? previousCompanyId,
    counts: {
      jobsites: jobsites.size,
      scheduleActivities: microsoft.tasks.length,
      permits: permits.length,
      jsas: jsa.jsas.length,
      jsaActivities: jsa.activities.length,
      observations: correctiveActions.length,
      incidents: incidents.length,
      correctiveActions: correctiveActions.length,
      trainingRequirements: trainingRequirements.length,
      microsoftProjects: microsoft.projects.length,
      microsoftTasks: microsoft.tasks.length,
    },
  };
}

export async function resetDemoCompany(params: {
  supabase: DemoSeedSupabaseClient;
  actorUserId: string;
}): Promise<ResetResult> {
  const { supabase, actorUserId } = params;
  const demo = await loadDemoCompany(supabase, actorUserId);
  if (!demo?.id) return { companyId: null, restoredCompanyId: null, deletedDemoCompany: false };

  const restoredCompanyId = demo.demo_previous_company_id ?? null;
  const restoredCompany = await loadCompany(supabase, restoredCompanyId);
  await resetDemoCompanyRows(supabase, demo.id);

  await ignoreMissingSchema(
    table(supabase, "company_memberships").delete().eq("company_id", demo.id).eq("user_id", actorUserId),
    "Failed to detach demo membership."
  );

  await ignoreMissingSchema(
    table(supabase, "user_roles")
      .update({
        company_id: restoredCompany?.id ?? null,
        team: restoredCompany?.name ?? "General",
        updated_by: actorUserId,
      })
      .eq("user_id", actorUserId),
    "Failed to restore previous company."
  );

  await ignoreMissingSchema(
    table(supabase, "company_subscriptions").delete().eq("company_id", demo.id),
    "Failed to delete demo subscription."
  );

  await ignoreMissingSchema(
    table(supabase, "companies").delete().eq("id", demo.id).eq("demo_company", true),
    "Failed to delete demo company."
  );

  return { companyId: demo.id, restoredCompanyId: restoredCompany?.id ?? null, deletedDemoCompany: true };
}
