import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPermitBookletMetadata,
  matchHighRiskPermits,
  resolveHighRiskPermitDefinition,
  type HighRiskPermitMatch,
} from "@/lib/highRiskPermitBooklet";
import {
  SAFE_PREDICT_PERMIT_FORM_METADATA_KEY,
  normalizePermitForm,
  preparePermitFormForSave,
} from "@/lib/safePredictPermitForms";

export type SchedulePermitAssignmentScope = "daily" | "weekly";

export type SchedulePermitAssignmentResult = {
  success: true;
  dryRun: boolean;
  scope: SchedulePermitAssignmentScope;
  window: { startDate: string; endDate: string; days: number };
  createdPermits: AutoAssignedPermitSummary[];
  skippedPermits: AutoAssignedPermitSummary[];
  unassignedPermits: AutoAssignedPermitSummary[];
  tasks: SchedulePermitTaskSummary[];
};

export type AutoAssignedPermitSummary = {
  scheduleItemId: string;
  permitType: string;
  permitCode: string;
  permitId: string | null;
  title: string;
  ownerUserId: string | null;
  ownerLabel: string;
  rationale: string;
  status: "created" | "would_create" | "skipped";
  skipReason?: string;
};

export type SchedulePermitTaskSummary = {
  scheduleItemId: string;
  title: string;
  workStartDate: string;
  workEndDate: string;
  permitTriggers: string[];
  unmappedPermitTriggers: string[];
  ownerUserId: string | null;
  ownerLabel: string;
  assignmentRationale: string;
  createdCount: number;
  skippedCount: number;
};

type DbClient = Pick<SupabaseClient, "from">;

type ScheduleItemRow = {
  id: string;
  title: string | null;
  status: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  trade: string | null;
  work_area: string | null;
  crew_or_contractor: string | null;
  crew_size: number | null;
  supervisor_name: string | null;
  risk_level: string | null;
  is_high_risk: boolean | null;
  hazard_categories: string[] | null;
  permit_triggers: string[] | null;
  required_controls: string[] | null;
  notes: string | null;
};

type ScheduleItemWithPermitMatches = ScheduleItemRow & {
  permitMatches: HighRiskPermitMatch[];
  permitTriggers: string[];
  unmappedPermitTriggers: string[];
};

type JobsiteRow = {
  id: string;
  company_id: string;
  name: string | null;
  status: string | null;
  project_manager: string | null;
};

type ExistingPermitRow = {
  id: string;
  permit_type: string | null;
  status: string | null;
  schedule_item_id?: string | null;
  source_module?: string | null;
  source_id?: string | null;
};

type RoleRow = {
  user_id: string;
  role: string | null;
  account_status: string | null;
};

type AssignmentRow = {
  user_id: string;
  role: string | null;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  job_title: string | null;
};

export type AssignmentDirectoryUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

type OwnerResolution = {
  ownerUserId: string | null;
  ownerLabel: string;
  rationale: string;
};

const SCHEDULE_SELECT =
  "id, title, status, work_start_date, work_end_date, shift_start_time, shift_end_time, trade, work_area, crew_or_contractor, crew_size, supervisor_name, risk_level, is_high_risk, hazard_categories, permit_triggers, required_controls, notes";

const PERMIT_SELECT = "id, permit_type, status, schedule_item_id, source_module, source_id";

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRole(value: unknown) {
  return normalizeKey(value);
}

function normalizeStatus(value: unknown) {
  return clean(value).toLowerCase();
}

function isActiveStatus(value: unknown) {
  const status = normalizeStatus(value);
  return !status || status === "active" || status === "approved";
}

function cleanList(values: unknown, limit = 16) {
  const raw = Array.isArray(values) ? values : String(values ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const item = clean(value);
    if (!item) continue;
    const key = normalizeKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, limit);
}

function itemOverlapsWindow(item: ScheduleItemRow, startDate: string, endDate: string) {
  const itemStart = item.work_start_date ?? "";
  const itemEnd = item.work_end_date ?? itemStart;
  return Boolean(itemStart && itemStart <= endDate && itemEnd >= startDate);
}

function isPlannedOrActive(item: ScheduleItemRow) {
  const status = normalizeStatus(item.status || "planned");
  return status === "planned" || status === "active";
}

function dueAtForItem(item: ScheduleItemRow) {
  if (!item.work_start_date) return null;
  const time = item.shift_start_time && /^\d{2}:\d{2}$/.test(item.shift_start_time) ? item.shift_start_time : "07:00";
  return `${item.work_start_date}T${time}:00.000Z`;
}

function severityForItem(item: ScheduleItemRow) {
  const risk = normalizeStatus(item.risk_level);
  if (risk === "low" || risk === "medium" || risk === "high" || risk === "critical") return risk;
  return item.is_high_risk ? "high" : "medium";
}

function permitMatchResultForItem(item: ScheduleItemRow) {
  const explicit = cleanList(item.permit_triggers);
  return matchHighRiskPermits({
    explicitTriggers: explicit,
    title: item.title,
    trade: item.trade,
    taskType: item.title,
    workArea: item.work_area,
    notes: item.notes,
    hazardCategories: item.hazard_categories,
    requiredControls: item.required_controls,
  });
}

function existingPermitKey(row: ExistingPermitRow) {
  return `${row.schedule_item_id ?? row.source_id ?? ""}:${normalizeKey(row.permit_type)}`;
}

function directoryUserMatchesLabel(user: AssignmentDirectoryUser, label: string) {
  const wanted = normalizeKey(label);
  if (!wanted) return false;
  return [user.name, user.email].some((value) => normalizeKey(value) === wanted);
}

function activeRoleUserIds(roleRows: RoleRow[], role: "project_manager" | "foreman") {
  return new Set(
    roleRows
      .filter((row) => normalizeRole(row.role) === role && isActiveStatus(row.account_status))
      .map((row) => row.user_id)
  );
}

function displayForUser(
  userId: string,
  profilesByUserId: Map<string, UserProfileRow>,
  directoryByUserId: Map<string, AssignmentDirectoryUser>
) {
  const directory = directoryByUserId.get(userId);
  const profile = profilesByUserId.get(userId);
  return (
    clean(directory?.name) ||
    clean(profile?.preferred_name) ||
    clean(profile?.full_name) ||
    clean(directory?.email) ||
    `User ${userId.slice(0, 8)}`
  );
}

async function loadOwnerResolution(params: {
  supabase: DbClient;
  profileClient?: DbClient | null;
  companyId: string;
  jobsiteId: string;
  jobsiteProjectManager: string | null;
  directoryUsers?: AssignmentDirectoryUser[];
}): Promise<OwnerResolution> {
  const [assignmentResult, roleResult] = await Promise.all([
    params.supabase
      .from("company_jobsite_assignments")
      .select("user_id, role")
      .eq("company_id", params.companyId)
      .eq("jobsite_id", params.jobsiteId),
    params.supabase
      .from("user_roles")
      .select("user_id, role, account_status")
      .eq("company_id", params.companyId),
  ]);

  const assignments = ((assignmentResult.data ?? []) as AssignmentRow[]).filter((row) => clean(row.user_id));
  const roles = ((roleResult.data ?? []) as RoleRow[]).filter((row) => clean(row.user_id));
  const roleByUserId = new Map(roles.map((row) => [row.user_id, row]));
  const activeProjectManagers = activeRoleUserIds(roles, "project_manager");
  const activeForemen = activeRoleUserIds(roles, "foreman");
  const candidateUserIds = Array.from(new Set([...assignments.map((row) => row.user_id), ...roles.map((row) => row.user_id)]));

  const profilesByUserId = new Map<string, UserProfileRow>();
  const profileClient = params.profileClient ?? params.supabase;
  if (candidateUserIds.length > 0) {
    const profileResult = await profileClient
      .from("user_profiles")
      .select("user_id, full_name, preferred_name, job_title")
      .in("user_id", candidateUserIds);
    if (!profileResult.error) {
      for (const profile of (profileResult.data ?? []) as UserProfileRow[]) {
        profilesByUserId.set(profile.user_id, profile);
      }
    }
  }

  const directoryByUserId = new Map((params.directoryUsers ?? []).map((user) => [user.id, user]));
  const assignedProjectManager = assignments.find(
    (row) => normalizeRole(row.role) === "project_manager" && activeProjectManagers.has(row.user_id)
  );
  if (assignedProjectManager) {
    const label = displayForUser(assignedProjectManager.user_id, profilesByUserId, directoryByUserId);
    return {
      ownerUserId: assignedProjectManager.user_id,
      ownerLabel: label,
      rationale: `Assigned to Superintendent / Project Manager ${label} because they are assigned to this jobsite.`,
    };
  }

  const projectManagerLabel = clean(params.jobsiteProjectManager);
  if (projectManagerLabel) {
    const directoryMatch = (params.directoryUsers ?? []).find(
      (user) =>
        activeProjectManagers.has(user.id) &&
        isActiveStatus(user.status) &&
        directoryUserMatchesLabel(user, projectManagerLabel)
    );
    if (directoryMatch) {
      return {
        ownerUserId: directoryMatch.id,
        ownerLabel: clean(directoryMatch.name) || clean(directoryMatch.email) || projectManagerLabel,
        rationale: `Assigned to Superintendent / Project Manager ${projectManagerLabel} from the jobsite profile.`,
      };
    }

    const profileMatch = Array.from(profilesByUserId.values()).find((profile) => {
      const role = roleByUserId.get(profile.user_id);
      return (
        activeProjectManagers.has(profile.user_id) &&
        isActiveStatus(role?.account_status) &&
        [profile.full_name, profile.preferred_name].some((value) => normalizeKey(value) === normalizeKey(projectManagerLabel))
      );
    });
    if (profileMatch) {
      return {
        ownerUserId: profileMatch.user_id,
        ownerLabel: clean(profileMatch.preferred_name) || clean(profileMatch.full_name) || projectManagerLabel,
        rationale: `Assigned to Superintendent / Project Manager ${projectManagerLabel} from the jobsite profile.`,
      };
    }
  }

  const assignedForeman = assignments.find(
    (row) => normalizeRole(row.role) === "foreman" && activeForemen.has(row.user_id)
  );
  if (assignedForeman) {
    const label = displayForUser(assignedForeman.user_id, profilesByUserId, directoryByUserId);
    return {
      ownerUserId: assignedForeman.user_id,
      ownerLabel: label,
      rationale: `Assigned to Foreman ${label} because no active Superintendent / Project Manager owner was resolved.`,
    };
  }

  return {
    ownerUserId: null,
    ownerLabel: projectManagerLabel || "Unassigned",
    rationale: projectManagerLabel
      ? `No active company user could be matched to Superintendent / Project Manager ${projectManagerLabel}; draft permit needs manual owner review.`
      : "No active Superintendent / Project Manager or Foreman assignment was found; draft permit needs manual owner review.",
  };
}

export async function autoAssignSchedulePermits(params: {
  supabase: DbClient;
  profileClient?: DbClient | null;
  companyId: string;
  jobsiteId: string;
  scope: SchedulePermitAssignmentScope;
  dryRun?: boolean;
  actorUserId?: string | null;
  now?: Date;
  directoryUsers?: AssignmentDirectoryUser[];
}): Promise<SchedulePermitAssignmentResult | { success: false; status: number; error: string }> {
  const dryRun = Boolean(params.dryRun);
  const startDate = dateOnly(params.now ?? new Date());
  const days = params.scope === "weekly" ? 7 : 0;
  const endDate = addDays(startDate, days);

  const jobsiteResult = await params.supabase
    .from("company_jobsites")
    .select("id, company_id, name, status, project_manager")
    .eq("company_id", params.companyId)
    .eq("id", params.jobsiteId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return { success: false, status: 500, error: jobsiteResult.error.message || "Failed to load jobsite." };
  }
  if (!jobsiteResult.data) {
    return { success: false, status: 404, error: "Jobsite not found." };
  }

  const jobsite = jobsiteResult.data as JobsiteRow;
  const jobsiteStatus = normalizeStatus(jobsite.status);
  if (["archived", "closed", "completed", "inactive"].includes(jobsiteStatus)) {
    return { success: false, status: 400, error: "Permits can only be auto-assigned for active jobsites." };
  }

  const scheduleResult = await params.supabase
    .from("company_jobsite_schedule_items")
    .select(SCHEDULE_SELECT)
    .eq("company_id", params.companyId)
    .eq("jobsite_id", params.jobsiteId)
    .is("archived_at", null)
    .order("work_start_date", { ascending: true });

  if (scheduleResult.error) {
    return { success: false, status: 500, error: scheduleResult.error.message || "Failed to load schedule items." };
  }

  const scheduleItems: ScheduleItemWithPermitMatches[] = ((scheduleResult.data ?? []) as ScheduleItemRow[])
    .filter((item) => isPlannedOrActive(item) && itemOverlapsWindow(item, startDate, endDate))
    .map((item) => {
      const result = permitMatchResultForItem(item);
      return {
        ...item,
        permitMatches: result.matches,
        permitTriggers: result.matches.map((match) => match.definition.code),
        unmappedPermitTriggers: result.unmappedTriggers,
      };
    })
    .filter((item) => item.permitMatches.length > 0 || item.unmappedPermitTriggers.length > 0);

  const scheduleItemIds = scheduleItems.map((item) => item.id);
  const existingPermitKeys = new Set<string>();
  if (scheduleItemIds.length > 0) {
    const existingResult = await params.supabase
      .from("company_permits")
      .select(PERMIT_SELECT)
      .eq("company_id", params.companyId)
      .eq("jobsite_id", params.jobsiteId)
      .in("schedule_item_id", scheduleItemIds);
    if (existingResult.error) {
      return { success: false, status: 500, error: existingResult.error.message || "Failed to check existing permits." };
    }
    for (const permit of (existingResult.data ?? []) as ExistingPermitRow[]) {
      const status = normalizeStatus(permit.status);
      if (status === "draft" || status === "active") {
        existingPermitKeys.add(existingPermitKey(permit));
        const definition = resolveHighRiskPermitDefinition(permit.permit_type);
        if (definition) {
          existingPermitKeys.add(`${permit.schedule_item_id ?? permit.source_id ?? ""}:${normalizeKey(definition.name)}`);
          existingPermitKeys.add(`${permit.schedule_item_id ?? permit.source_id ?? ""}:${normalizeKey(definition.code)}`);
        }
      }
    }
  }

  const owner = await loadOwnerResolution({
    supabase: params.supabase,
    profileClient: params.profileClient,
    companyId: params.companyId,
    jobsiteId: params.jobsiteId,
    jobsiteProjectManager: jobsite.project_manager,
    directoryUsers: params.directoryUsers,
  });

  const createdPermits: AutoAssignedPermitSummary[] = [];
  const skippedPermits: AutoAssignedPermitSummary[] = [];
  const unassignedPermits: AutoAssignedPermitSummary[] = [];
  const tasks: SchedulePermitTaskSummary[] = [];

  for (const item of scheduleItems) {
    let createdCount = 0;
    let skippedCount = 0;
    for (const trigger of item.unmappedPermitTriggers) {
      skippedCount += 1;
      skippedPermits.push({
        scheduleItemId: item.id,
        permitType: "Unmapped permit trigger",
        permitCode: normalizeKey(trigger),
        permitId: null,
        title: `${clean(item.title) || "Scheduled work"} - ${trigger}`,
        ownerUserId: owner.ownerUserId,
        ownerLabel: owner.ownerLabel,
        rationale: "No high-risk permit booklet rule matched this trigger.",
        status: "skipped",
        skipReason: "Unknown permit trigger ignored; no draft permit was created.",
      });
    }

    for (const match of item.permitMatches) {
      const definition = match.definition;
      const permitType = definition.name;
      const permitCode = definition.code;
      const duplicateKey = `${item.id}:${normalizeKey(permitType)}`;
      const title = `${clean(item.title) || "Scheduled work"} - ${permitType}`;
      const assignmentRationale = `${owner.rationale} Matched ${definition.code}: ${definition.trigger}`;
      const permitBookletMetadata = buildPermitBookletMetadata(definition);
      const permitForm = preparePermitFormForSave(normalizePermitForm(null, permitType));
      const summaryBase = {
        scheduleItemId: item.id,
        permitType,
        permitCode,
        permitId: null,
        title,
        ownerUserId: owner.ownerUserId,
        ownerLabel: owner.ownerLabel,
        rationale: assignmentRationale,
      };

      if (existingPermitKeys.has(duplicateKey)) {
        skippedCount += 1;
        skippedPermits.push({
          ...summaryBase,
          status: "skipped",
          skipReason: "A draft or active permit already exists for this schedule task and permit type.",
        });
        continue;
      }

      if (dryRun) {
        createdCount += 1;
        const wouldCreate: AutoAssignedPermitSummary = { ...summaryBase, status: "would_create" };
        createdPermits.push(wouldCreate);
        if (!owner.ownerUserId) unassignedPermits.push(wouldCreate);
        continue;
      }

      const insertResult = await params.supabase
        .from("company_permits")
        .insert({
          company_id: params.companyId,
          jobsite_id: params.jobsiteId,
          permit_type: permitType,
          title,
          status: "draft",
          severity: severityForItem(item),
          category: "planned_work",
          owner_user_id: owner.ownerUserId,
          due_at: dueAtForItem(item),
          schedule_item_id: item.id,
          source_module: "company_jobsite_schedule_item",
          source_id: item.id,
          auto_assigned: true,
          auto_assignment_scope: params.scope,
          assignment_rationale: assignmentRationale,
          source_metadata: {
            scheduleItemId: item.id,
            scheduleTitle: item.title,
            permitCode,
            originalPermitTriggers: match.evidence,
            permitBooklet: permitBookletMetadata,
            [SAFE_PREDICT_PERMIT_FORM_METADATA_KEY]: permitForm,
            ownerLabel: owner.ownerLabel,
            workStartDate: item.work_start_date,
            workEndDate: item.work_end_date ?? item.work_start_date,
            trade: item.trade,
            workArea: item.work_area,
            generatedBy: "ai_engine_schedule_permit_auto_assignment",
          },
          created_by: params.actorUserId ?? null,
          updated_by: params.actorUserId ?? null,
        })
        .select("id")
        .single();

      if (insertResult.error) {
        return { success: false, status: 500, error: insertResult.error.message || "Failed to create auto-assigned permit." };
      }

      const permitId = String((insertResult.data as { id?: string } | null)?.id ?? "");
      createdCount += 1;
      existingPermitKeys.add(duplicateKey);
      const created: AutoAssignedPermitSummary = { ...summaryBase, permitId, status: "created" };
      createdPermits.push(created);
      if (!owner.ownerUserId) unassignedPermits.push(created);

      await params.supabase.from("company_risk_events").insert({
        company_id: params.companyId,
        module_name: "permits",
        record_id: permitId,
        event_type: "permit_auto_assigned",
        detail: `AI Engine created draft permit from scheduled work: ${title}.`,
        event_payload: {
          scheduleItemId: item.id,
          permitType,
          permitCode,
          scope: params.scope,
          ownerUserId: owner.ownerUserId,
          ownerLabel: owner.ownerLabel,
          permitBooklet: permitBookletMetadata,
        },
        created_by: params.actorUserId ?? null,
      });
    }

    tasks.push({
      scheduleItemId: item.id,
      title: clean(item.title) || "Scheduled work",
      workStartDate: item.work_start_date ?? startDate,
      workEndDate: item.work_end_date ?? item.work_start_date ?? startDate,
      permitTriggers: item.permitTriggers,
      unmappedPermitTriggers: item.unmappedPermitTriggers,
      ownerUserId: owner.ownerUserId,
      ownerLabel: owner.ownerLabel,
      assignmentRationale: owner.rationale,
      createdCount,
      skippedCount,
    });
  }

  return {
    success: true,
    dryRun,
    scope: params.scope,
    window: { startDate, endDate, days },
    createdPermits,
    skippedPermits,
    unassignedPermits,
    tasks,
  };
}
