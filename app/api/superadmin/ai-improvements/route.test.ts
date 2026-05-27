import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  normalizeAppRole: (role?: string | null) =>
    (role ?? "").trim().toLowerCase().replace(/\s+/g, "_"),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import * as approveRoute from "./[id]/approve/route";
import * as rejectRoute from "./[id]/reject/route";
import * as listRoute from "./route";

const mockedAuthorize = vi.mocked(authorizeRequest);
const mockedCreateAdmin = vi.mocked(createSupabaseAdminClient);

type TableName = "ai_improvement_requests" | "ai_improvement_audit_events";
type MockTables = Record<TableName, Array<Record<string, unknown>>>;

let idCounter = 0;

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function makeResult(data: unknown, error: { message?: string | null } | null = null) {
  return Promise.resolve({ data, error });
}

type MockResult = { data: unknown; error: { message?: string | null } | null };

function selectBuilder(rows: Array<Record<string, unknown>>) {
  const state = { filters: [] as Array<{ column: string; value: string }>, limit: null as number | null };
  const execute = () => {
    let out = rows.filter((row) =>
      state.filters.every((filter) => String(row[filter.column] ?? "") === filter.value)
    );
    if (state.limit != null) out = out.slice(0, state.limit);
    return out.map((row) => ({ ...row }));
  };
  const builder = {
    eq(column: string, value: string) {
      state.filters.push({ column, value });
      return builder;
    },
    order() {
      return builder;
    },
    limit(count: number) {
      state.limit = count;
      return builder;
    },
    maybeSingle() {
      return makeResult(execute()[0] ?? null);
    },
    single() {
      return makeResult(execute()[0] ?? null);
    },
    then(resolve?: ((value: MockResult) => unknown) | null) {
      return makeResult(execute()).then(resolve);
    },
  };
  return builder;
}

function insertBuilder(table: Array<Record<string, unknown>>, values: unknown) {
  const rows = (Array.isArray(values) ? values : [values]).map((value) => {
    const row = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
    row.id = row.id ?? nextId("row");
    row.created_at = row.created_at ?? "2026-05-27T12:00:00.000Z";
    row.updated_at = row.updated_at ?? row.created_at;
    table.push(row);
    return row;
  });
  const builder = {
    select() {
      return builder;
    },
    single() {
      return makeResult({ ...rows[0] });
    },
    then(resolve?: ((value: MockResult) => unknown) | null) {
      return makeResult(rows.map((row) => ({ ...row }))).then(resolve);
    },
  };
  return builder;
}

function updateBuilder(table: Array<Record<string, unknown>>, patch: unknown) {
  const state = { filters: [] as Array<{ column: string; value: string }> };
  const execute = () => {
    const updated: Array<Record<string, unknown>> = [];
    for (const row of table) {
      const matches = state.filters.every((filter) => String(row[filter.column] ?? "") === filter.value);
      if (!matches) continue;
      Object.assign(row, patch, { updated_at: "2026-05-27T12:10:00.000Z" });
      updated.push({ ...row });
    }
    return updated;
  };
  const builder = {
    eq(column: string, value: string) {
      state.filters.push({ column, value });
      return builder;
    },
    select() {
      return builder;
    },
    single() {
      return makeResult(execute()[0] ?? null);
    },
  };
  return builder;
}

function createClient(seed: Array<Record<string, unknown>> = []) {
  const tables: MockTables = {
    ai_improvement_requests: seed.map((row) => ({
      id: row.id ?? nextId("request"),
      title: row.title ?? "Seed request",
      description: row.description ?? "",
      proposed_by: row.proposed_by ?? null,
      created_by_type: row.created_by_type ?? "ai",
      status: row.status ?? "awaiting_super_admin_approval",
      risk_level: row.risk_level ?? "medium",
      affected_area: row.affected_area ?? "",
      branch_name: row.branch_name ?? null,
      pull_request_url: row.pull_request_url ?? null,
      latest_commit_sha: row.latest_commit_sha ?? null,
      test_summary: row.test_summary ?? "",
      codex_summary: row.codex_summary ?? "",
      rollback_plan: row.rollback_plan ?? "",
      checks_passed: row.checks_passed ?? true,
      super_admin_override_reason: row.super_admin_override_reason ?? null,
      approved_by_super_admin_id: row.approved_by_super_admin_id ?? null,
      approved_at: row.approved_at ?? null,
      rejected_by_super_admin_id: row.rejected_by_super_admin_id ?? null,
      rejected_at: row.rejected_at ?? null,
      rejection_reason: row.rejection_reason ?? null,
      created_at: row.created_at ?? "2026-05-27T12:00:00.000Z",
      updated_at: row.updated_at ?? "2026-05-27T12:00:00.000Z",
    })),
    ai_improvement_audit_events: [],
  };
  const client = {
    from(tableName: string) {
      const table = tables[tableName as TableName];
      if (!table) throw new Error(`Unexpected table ${tableName}`);
      return {
        select: () => selectBuilder(table),
        insert: (values: unknown) => insertBuilder(table, values),
        update: (patch: unknown) => updateBuilder(table, patch),
      };
    },
  };
  return { client, tables };
}

function auth(role: string) {
  return {
    role,
    user: { id: `${role}-user` },
    supabase: {},
  } as never;
}

function context(id = "request-1") {
  return { params: Promise.resolve({ id }) };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response");
  return response;
}

describe("/api/superadmin/ai-improvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an improvement request for a Super Admin", async () => {
    const mock = createClient();
    mockedAuthorize.mockResolvedValue(auth("super_admin"));
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = await listRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements", {
        method: "POST",
        body: JSON.stringify({
          title: "Improve AI release gate",
          createdByType: "ai",
          riskLevel: "high",
        }),
      })
    );
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(body.request).toEqual(expect.objectContaining({ title: "Improve AI release gate" }));
    expect(mock.tables.ai_improvement_audit_events[0]).toEqual(
      expect.objectContaining({ event_type: "ai_improvement_request_created" })
    );
  });

  it("allows a Super Admin to approve", async () => {
    const mock = createClient([{ id: "request-1", checks_passed: true }]);
    mockedAuthorize.mockResolvedValue(auth("super_admin"));
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = expectResponse(await approveRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements/request-1/approve", {
        method: "POST",
        body: JSON.stringify({ actorType: "user" }),
      }),
      context()
    ));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.request).toEqual(expect.objectContaining({ status: "approved" }));
    expect(mock.tables.ai_improvement_audit_events).toEqual(
      expect.arrayContaining([expect.objectContaining({ event_type: "super_admin_approved" })])
    );
  });

  it("allows a Super Admin to reject with a reason", async () => {
    const mock = createClient([{ id: "request-1" }]);
    mockedAuthorize.mockResolvedValue(auth("super_admin"));
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = await rejectRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements/request-1/reject", {
        method: "POST",
        body: JSON.stringify({ actorType: "user", rejectionReason: "Insufficient rollback plan." }),
      }),
      context()
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.request).toEqual(expect.objectContaining({ status: "rejected" }));
    expect(mock.tables.ai_improvement_audit_events).toEqual(
      expect.arrayContaining([expect.objectContaining({ event_type: "super_admin_rejected" })])
    );
  });

  it.each(["admin", "company_admin"])("blocks %s approval", async (role) => {
    const mock = createClient([{ id: "request-1" }]);
    mockedAuthorize.mockResolvedValue(auth(role));
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = expectResponse(await approveRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements/request-1/approve", {
        method: "POST",
        body: JSON.stringify({ actorType: "user" }),
      }),
      context()
    ));
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error).toContain("Super Admin user approval is required");
    expect(mock.tables.ai_improvement_audit_events).toEqual(
      expect.arrayContaining([expect.objectContaining({ event_type: "unauthorized_approval_attempt" })])
    );
  });

  it("blocks unauthenticated approval", async () => {
    const mock = createClient([{ id: "request-1" }]);
    mockedAuthorize.mockResolvedValue({
      error: Response.json({ error: "Missing auth token." }, { status: 401 }),
    } as never);
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = expectResponse(await approveRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements/request-1/approve", {
        method: "POST",
        body: JSON.stringify({ actorType: "user" }),
      }),
      context()
    ));

    expect(response.status).toBe(401);
    expect(mock.tables.ai_improvement_audit_events).toEqual(
      expect.arrayContaining([expect.objectContaining({ event_type: "unauthorized_approval_attempt" })])
    );
  });

  it.each(["ai", "system"])("blocks %s actor approval", async (actorType) => {
    const mock = createClient([{ id: "request-1" }]);
    mockedAuthorize.mockResolvedValue(auth("super_admin"));
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = expectResponse(await approveRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements/request-1/approve", {
        method: "POST",
        body: JSON.stringify({ actorType }),
      }),
      context()
    ));

    expect(response.status).toBe(403);
    expect(mock.tables.ai_improvement_audit_events).toEqual(
      expect.arrayContaining([expect.objectContaining({ event_type: "unauthorized_approval_attempt" })])
    );
  });

  it("requires a rejection reason", async () => {
    const mock = createClient([{ id: "request-1" }]);
    mockedAuthorize.mockResolvedValue(auth("super_admin"));
    mockedCreateAdmin.mockReturnValue(mock.client as never);

    const response = await rejectRoute.POST(
      new Request("https://example.com/api/superadmin/ai-improvements/request-1/reject", {
        method: "POST",
        body: JSON.stringify({ actorType: "user" }),
      }),
      context()
    );
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain("Rejection reason is required");
  });
});
