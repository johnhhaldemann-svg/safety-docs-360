import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));

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
            trade: "Ironworkers",
            work_area: "Level 5",
            crew_or_contractor: "Lone Star Steel",
            notes: null,
            updated_at: "2026-05-18T12:00:00.000Z",
          },
          {
            id: "manual-outside",
            title: "Future punch",
            status: "planned",
            work_start_date: "2026-07-01",
            work_end_date: null,
            trade: null,
            work_area: null,
            crew_or_contractor: null,
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
        expect.objectContaining({ id: "manual-1", source: "manual", readOnly: false }),
        expect.objectContaining({ id: "task-1", source: "microsoft_project", readOnly: true }),
      ])
    );
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
        body: JSON.stringify({ title: "Decking release", workStartDate: "2026-05-20" }),
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
  });
});
