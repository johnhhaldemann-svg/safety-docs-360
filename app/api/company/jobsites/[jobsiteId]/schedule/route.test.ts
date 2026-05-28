import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, autoAssignSchedulePermits, getCompanyScope, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  autoAssignSchedulePermits: vi.fn(),
  getCompanyScope: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/schedulePermitAutoAssignment", () => ({ autoAssignSchedulePermits }));

import { GET, PATCH, POST } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    role: "company_admin",
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

describe("/api/company/jobsites/[jobsiteId]/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    autoAssignSchedulePermits.mockResolvedValue({
      success: true,
      dryRun: false,
      scope: "weekly",
      window: { startDate: "2026-05-18", endDate: "2026-05-25", days: 7 },
      createdPermits: [],
      skippedPermits: [],
      unassignedPermits: [],
      tasks: [],
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("GET returns manual and imported items inside the 30-day outlook", async () => {
    authWithBuilders([
      queryBuilder({
        data: { id: "jobsite-1", company_id: "company-1", name: "North Tower", jobsite_number: "SITE-0001" },
        error: null,
      }),
      queryBuilder({
        data: [
          {
            id: "manual-1",
            title: "Decking release",
            status: "active",
            work_start_date: "2026-05-20",
            work_end_date: "2026-05-21",
            shift_start_time: "07:00",
            shift_end_time: "17:00",
            trade: "Ironworkers",
            work_area: "Level 5",
            crew_or_contractor: "Lone Star Steel",
            crew_size: 8,
            supervisor_name: "Sam Safety",
            risk_level: "critical",
            is_high_risk: true,
            hazard_categories: ["fall_protection", "crane_rigging"],
            permit_triggers: ["lift_plan"],
            required_controls: ["controlled access zone"],
            source_metadata: { riskInput: "explicit" },
            notes: null,
            updated_at: "2026-05-18T12:00:00.000Z",
          },
          {
            id: "manual-outside",
            title: "Future punch",
            status: "planned",
            work_start_date: "2026-07-01",
            work_end_date: null,
            shift_start_time: null,
            shift_end_time: null,
            trade: null,
            work_area: null,
            crew_or_contractor: null,
            crew_size: null,
            supervisor_name: null,
            risk_level: "medium",
            is_high_risk: false,
            hazard_categories: [],
            permit_triggers: [],
            required_controls: [],
            source_metadata: {},
            notes: null,
            updated_at: "2026-05-18T12:00:00.000Z",
          },
        ],
        error: null,
      }),
      queryBuilder({
        data: [
          {
            id: "task-1",
            title: "Hot work prep",
            status: "not_started",
            start_at: "2026-05-24T14:00:00.000Z",
            due_at: "2026-05-24T22:00:00.000Z",
            bucket_name: "Welding",
            notes: null,
            priority: "normal",
            percent_complete: 0,
            updated_at: "2026-05-18T12:00:00.000Z",
          },
          {
            id: "task-outside",
            title: "Future import",
            status: "not_started",
            start_at: "2026-07-02T14:00:00.000Z",
            due_at: "2026-07-02T22:00:00.000Z",
          },
        ],
        error: null,
      }),
    ]);

    const response = requireRouteResponse(await GET(new Request("https://example.com/api/company/jobsites/jobsite-1/schedule"), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.window).toMatchObject({ startDate: "2026-05-18", endDate: "2026-06-17", days: 30 });
    expect(body.items).toHaveLength(2);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "manual-1", source: "manual", readOnly: false, riskLevel: "critical", isHighRisk: true }),
        expect.objectContaining({ id: "task-1", source: "microsoft_project", readOnly: true, riskLevel: "high", isHighRisk: true }),
      ])
    );
    expect(body.summary).toMatchObject({ totalItems: 2, highRiskItems: 2, permitRequiredItems: 2 });
  });

  it("POST creates a manual schedule item scoped to the jobsite", async () => {
    const insert = queryBuilder({
      data: { id: "manual-1", title: "Decking release" },
      error: null,
    });
    authWithBuilders([
      queryBuilder({
        data: { id: "jobsite-1", company_id: "company-1", name: "North Tower", jobsite_number: "SITE-0001" },
        error: null,
      }),
      insert,
    ]);

    const response = requireRouteResponse(await POST(
      new Request("https://example.com/api/company/jobsites/jobsite-1/schedule", {
        method: "POST",
        body: JSON.stringify({
          title: "Decking release",
          workStartDate: "2026-05-20",
          shiftStartTime: "07:00",
          shiftEndTime: "17:00",
          riskLevel: "critical",
          isHighRisk: true,
          hazardCategories: ["fall_protection"],
          permitTriggers: ["lift_plan"],
          requiredControls: ["controlled access zone"],
          crewSize: 8,
          supervisorName: "Sam Safety",
        }),
      }),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));

    expect(response.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        jobsite_id: "jobsite-1",
        title: "Decking release",
        work_start_date: "2026-05-20",
        risk_level: "critical",
        is_high_risk: true,
        hazard_categories: ["fall_protection"],
        permit_triggers: ["lift_plan"],
        required_controls: ["controlled access zone"],
        crew_size: 8,
        supervisor_name: "Sam Safety",
      })
    );
    expect(autoAssignSchedulePermits).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        scope: "weekly",
        scheduleItemIds: ["manual-1"],
        actorUserId: "user-1",
      })
    );
  });

  it("PATCH only updates the manual schedule table", async () => {
    const update = queryBuilder({
      data: { id: "manual-1", status: "archived" },
      error: null,
    });
    authWithBuilders([update]);

    const response = requireRouteResponse(await PATCH(
      new Request("https://example.com/api/company/jobsites/jobsite-1/schedule", {
        method: "PATCH",
        body: JSON.stringify({ itemId: "manual-1", archived: true }),
      }),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ status: "archived" }));
    expect(autoAssignSchedulePermits).not.toHaveBeenCalled();
  });

  it("PATCH updates predictive schedule fields on manual work", async () => {
    const update = queryBuilder({
      data: { id: "manual-1", status: "planned", risk_level: "high" },
      error: null,
    });
    authWithBuilders([update]);

    const response = requireRouteResponse(await PATCH(
      new Request("https://example.com/api/company/jobsites/jobsite-1/schedule", {
        method: "PATCH",
        body: JSON.stringify({
          itemId: "manual-1",
          riskLevel: "high",
          isHighRisk: true,
          permitTriggers: ["hot_work_permit"],
          requiredControls: ["fire watch"],
        }),
      }),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      risk_level: "high",
      is_high_risk: true,
      permit_triggers: ["hot_work_permit"],
      required_controls: ["fire watch"],
    }));
    expect(autoAssignSchedulePermits).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        scope: "weekly",
        scheduleItemIds: ["manual-1"],
        actorUserId: "user-1",
      })
    );
  });
});
