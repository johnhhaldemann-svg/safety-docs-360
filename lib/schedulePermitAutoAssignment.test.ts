import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoAssignSchedulePermits } from "./schedulePermitAutoAssignment";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
  return builder;
}

function clientWithBuilders(builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  return { from };
}

const jobsite = {
  id: "jobsite-1",
  company_id: "company-1",
  name: "Hillcrest",
  status: "active",
  project_manager: "Grace Monroe",
};

const hotWorkSchedule = {
  id: "schedule-1",
  title: "Hot work prep",
  status: "planned",
  work_start_date: "2026-05-19",
  work_end_date: null,
  shift_start_time: "07:00",
  shift_end_time: "15:30",
  trade: "Welding",
  work_area: "Level 2",
  crew_or_contractor: "TJ Contracting",
  crew_size: 4,
  supervisor_name: null,
  risk_level: "high",
  is_high_risk: true,
  hazard_categories: ["hot_work"],
  permit_triggers: ["hot_work_permit"],
  required_controls: ["fire watch"],
  notes: null,
};

describe("autoAssignSchedulePermits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates draft permits and assigns the jobsite project manager before a foreman", async () => {
    const permitInsert = queryBuilder({ data: { id: "permit-1" }, error: null });
    const client = clientWithBuilders([
      queryBuilder({ data: jobsite, error: null }),
      queryBuilder({ data: [hotWorkSchedule], error: null }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({
        data: [
          { user_id: "pm-1", role: "project_manager" },
          { user_id: "foreman-1", role: "foreman" },
        ],
        error: null,
      }),
      queryBuilder({
        data: [
          { user_id: "pm-1", role: "project_manager", account_status: "active" },
          { user_id: "foreman-1", role: "foreman", account_status: "active" },
        ],
        error: null,
      }),
      queryBuilder({
        data: [
          { user_id: "pm-1", full_name: "Grace Monroe", preferred_name: null, job_title: "Superintendent" },
          { user_id: "foreman-1", full_name: "Frank Foreman", preferred_name: null, job_title: "Foreman" },
        ],
        error: null,
      }),
      permitInsert,
      queryBuilder({ data: null, error: null }),
    ]);

    const result = await autoAssignSchedulePermits({
      supabase: client as never,
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      scope: "weekly",
      actorUserId: "admin-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.createdPermits).toHaveLength(1);
    expect(result.createdPermits[0]).toMatchObject({ ownerUserId: "pm-1", permitType: "Hot Work Permit Checklist", permitCode: "HWP-001" });
    expect(permitInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        owner_user_id: "pm-1",
        schedule_item_id: "schedule-1",
        auto_assigned: true,
        auto_assignment_scope: "weekly",
        assignment_rationale: expect.stringContaining("Matched HWP-001"),
        source_metadata: expect.objectContaining({
          permitCode: "HWP-001",
          permitBooklet: expect.objectContaining({ permitCode: "HWP-001" }),
          permit_form_v1: expect.objectContaining({
            checklistItems: expect.arrayContaining([
              expect.objectContaining({ label: expect.stringContaining("Fire watch") }),
            ]),
          }),
        }),
      })
    );
  });

  it("skips an existing draft or active permit for the same schedule task and permit type", async () => {
    const client = clientWithBuilders([
      queryBuilder({ data: jobsite, error: null }),
      queryBuilder({ data: [hotWorkSchedule], error: null }),
      queryBuilder({
        data: [{ id: "permit-existing", permit_type: "Hot Work Permit", status: "draft", schedule_item_id: "schedule-1" }],
        error: null,
      }),
      queryBuilder({ data: [{ user_id: "pm-1", role: "project_manager" }], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", role: "project_manager", account_status: "active" }], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", full_name: "Grace Monroe", preferred_name: null, job_title: "Superintendent" }], error: null }),
    ]);

    const result = await autoAssignSchedulePermits({
      supabase: client as never,
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      scope: "daily",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.createdPermits).toHaveLength(0);
    expect(result.skippedPermits).toHaveLength(1);
    expect(client.from).not.toHaveBeenCalledWith("company_risk_events");
  });

  it("dry-runs unassigned permit drafts without inserting records", async () => {
    const client = clientWithBuilders([
      queryBuilder({ data: { ...jobsite, project_manager: null }, error: null }),
      queryBuilder({ data: [hotWorkSchedule], error: null }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [], error: null }),
    ]);

    const result = await autoAssignSchedulePermits({
      supabase: client as never,
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      scope: "weekly",
      dryRun: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.createdPermits).toHaveLength(1);
    expect(result.createdPermits[0].status).toBe("would_create");
    expect(result.unassignedPermits).toHaveLength(1);
    expect(client.from).not.toHaveBeenCalledWith("company_risk_events");
  });

  it("skips unmapped explicit triggers instead of creating generic permits", async () => {
    const client = clientWithBuilders([
      queryBuilder({ data: jobsite, error: null }),
      queryBuilder({
        data: [{ ...hotWorkSchedule, permit_triggers: ["traffic_control_plan"], title: "Traffic delivery coordination" }],
        error: null,
      }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", role: "project_manager" }], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", role: "project_manager", account_status: "active" }], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", full_name: "Grace Monroe", preferred_name: null, job_title: "Superintendent" }], error: null }),
    ]);

    const result = await autoAssignSchedulePermits({
      supabase: client as never,
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      scope: "daily",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.createdPermits).toHaveLength(0);
    expect(result.skippedPermits).toEqual([
      expect.objectContaining({
        permitType: "Unmapped permit trigger",
        permitCode: "traffic_control_plan",
        skipReason: "Unknown permit trigger ignored; no draft permit was created.",
      }),
    ]);
    expect(result.tasks[0].unmappedPermitTriggers).toEqual(["traffic_control_plan"]);
    expect(client.from).not.toHaveBeenCalledWith("company_risk_events");
  });

  it("creates one draft per matched booklet permit for multi-permit work", async () => {
    const firstInsert = queryBuilder({ data: { id: "permit-hot" }, error: null });
    const secondInsert = queryBuilder({ data: { id: "permit-height" }, error: null });
    const client = clientWithBuilders([
      queryBuilder({ data: jobsite, error: null }),
      queryBuilder({
        data: [{ ...hotWorkSchedule, permit_triggers: ["HWP-001", "WAH-005"], title: "Roof torch work" }],
        error: null,
      }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", role: "project_manager" }], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", role: "project_manager", account_status: "active" }], error: null }),
      queryBuilder({ data: [{ user_id: "pm-1", full_name: "Grace Monroe", preferred_name: null, job_title: "Superintendent" }], error: null }),
      firstInsert,
      queryBuilder({ data: null, error: null }),
      secondInsert,
      queryBuilder({ data: null, error: null }),
    ]);

    const result = await autoAssignSchedulePermits({
      supabase: client as never,
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      scope: "weekly",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.createdPermits.map((permit) => permit.permitCode)).toEqual(["HWP-001", "WAH-005"]);
    expect(firstInsert.insert).toHaveBeenCalledWith(expect.objectContaining({ permit_type: "Hot Work Permit Checklist" }));
    expect(secondInsert.insert).toHaveBeenCalledWith(expect.objectContaining({ permit_type: "Work at Height Permit Checklist" }));
  });
});
