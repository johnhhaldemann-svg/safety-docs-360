import { describe, expect, it } from "vitest";
import {
  approveAiImprovementRequest,
  createAiImprovementRequest,
  normalizeAiImprovementRequestInput,
  rejectAiImprovementRequest,
  updateAiImprovementRequest,
  type AiImprovementRequest,
  type AiImprovementSupabaseClient,
} from "@/lib/superadmin/aiImprovementRequests";

type TableName = "ai_improvement_requests" | "ai_improvement_audit_events";
type MockTables = Record<TableName, Array<Record<string, unknown>>>;

let idCounter = 0;

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

type MockResult = { data: unknown; error: { message?: string | null } | null };

function result(data: unknown, error: { message?: string | null } | null = null) {
  return Promise.resolve({ data, error });
}

function makeSelectBuilder(rows: Array<Record<string, unknown>>) {
  const state = {
    filters: [] as Array<{ column: string; value: string }>,
    limit: null as number | null,
  };
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
      return result(execute()[0] ?? null);
    },
    single() {
      return result(execute()[0] ?? null);
    },
    then(resolve?: ((value: MockResult) => unknown) | null) {
      return result(execute()).then(resolve);
    },
  };
  return builder;
}

function makeInsertBuilder(table: Array<Record<string, unknown>>, values: unknown) {
  const inserted = (Array.isArray(values) ? values : [values]).map((value) => {
    const row = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
    row.id = row.id ?? nextId("row");
    row.created_at = row.created_at ?? new Date("2026-05-27T12:00:00.000Z").toISOString();
    row.updated_at = row.updated_at ?? row.created_at;
    table.push(row);
    return row;
  });
  const builder = {
    select() {
      return builder;
    },
    single() {
      return result({ ...inserted[0] });
    },
    then(resolve?: ((value: MockResult) => unknown) | null) {
      return result(inserted.map((row) => ({ ...row }))).then(resolve);
    },
  };
  return builder;
}

function makeUpdateBuilder(table: Array<Record<string, unknown>>, patch: unknown) {
  const state = {
    filters: [] as Array<{ column: string; value: string }>,
  };
  const execute = () => {
    const updated: Array<Record<string, unknown>> = [];
    for (const row of table) {
      const matches = state.filters.every((filter) => String(row[filter.column] ?? "") === filter.value);
      if (!matches) continue;
      Object.assign(row, patch, { updated_at: new Date("2026-05-27T12:10:00.000Z").toISOString() });
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
      return result(execute()[0] ?? null);
    },
  };
  return builder;
}

function createMockClient(seed: Partial<AiImprovementRequest>[] = []) {
  const tables: MockTables = {
    ai_improvement_requests: seed.map((row, index) => ({
      id: row.id ?? `request-${index + 1}`,
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
      checks_passed: row.checks_passed ?? false,
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
        select: () => makeSelectBuilder(table),
        insert: (values: unknown) => makeInsertBuilder(table, values),
        update: (patch: unknown) => makeUpdateBuilder(table, patch),
      };
    },
  } as unknown as AiImprovementSupabaseClient;

  return { client, tables };
}

describe("aiImprovementRequests", () => {
  it("creates an improvement request and writes an audit event", async () => {
    const mock = createMockClient();

    const created = await createAiImprovementRequest({
      client: mock.client,
      input: {
        title: "Improve dashboard risk labels",
        description: "Make high-risk status easier to scan.",
        createdByType: "ai",
        riskLevel: "high",
        affectedArea: "dashboard",
      },
      actor: { type: "ai" },
    });

    expect(created.title).toBe("Improve dashboard risk labels");
    expect(created.risk_level).toBe("high");
    expect(mock.tables.ai_improvement_audit_events).toEqual([
      expect.objectContaining({
        event_type: "ai_improvement_request_created",
        new_status: "draft",
      }),
    ]);
  });

  it("updates status and logs the status transition", async () => {
    const mock = createMockClient([{ id: "request-1", status: "in_progress" }]);

    const updated = await updateAiImprovementRequest({
      client: mock.client,
      id: "request-1",
      input: { status: "awaiting_super_admin_approval" },
      actor: { id: "super-1", type: "user", role: "super_admin" },
    });

    expect(updated.status).toBe("awaiting_super_admin_approval");
    expect(mock.tables.ai_improvement_audit_events[0]).toEqual(
      expect.objectContaining({
        event_type: "approval_requested",
        old_status: "in_progress",
        new_status: "awaiting_super_admin_approval",
      })
    );
  });

  it("blocks non-super-admin approval attempts and logs them", async () => {
    const mock = createMockClient([{ id: "request-1", checks_passed: true }]);

    await expect(
      approveAiImprovementRequest({
        client: mock.client,
        id: "request-1",
        actor: { id: "admin-1", type: "user", role: "admin" },
      })
    ).rejects.toThrow("Super Admin user approval is required");

    expect(mock.tables.ai_improvement_audit_events[0]).toEqual(
      expect.objectContaining({ event_type: "unauthorized_approval_attempt" })
    );
  });

  it("blocks AI and system actors from approval", async () => {
    const mock = createMockClient([{ id: "request-1", checks_passed: true }]);

    await expect(
      approveAiImprovementRequest({
        client: mock.client,
        id: "request-1",
        actor: { type: "ai", role: "super_admin" },
      })
    ).rejects.toThrow("Super Admin user approval is required");

    await expect(
      approveAiImprovementRequest({
        client: mock.client,
        id: "request-1",
        actor: { type: "system", role: "super_admin" },
      })
    ).rejects.toThrow("Super Admin user approval is required");
  });

  it("requires checks or an override reason before approval", async () => {
    const mock = createMockClient([{ id: "request-1", checks_passed: false }]);

    await expect(
      approveAiImprovementRequest({
        client: mock.client,
        id: "request-1",
        actor: { id: "super-1", type: "user", role: "super_admin" },
      })
    ).rejects.toThrow("Required checks must pass");

    const approved = await approveAiImprovementRequest({
      client: mock.client,
      id: "request-1",
      actor: { id: "super-1", type: "user", role: "super_admin" },
      overrideReason: "Emergency fix reviewed manually.",
    });

    expect(approved.status).toBe("approved");
    expect(approved.super_admin_override_reason).toBe("Emergency fix reviewed manually.");
  });

  it("lets a Super Admin approve when checks passed and writes audit", async () => {
    const mock = createMockClient([{ id: "request-1", checks_passed: true }]);

    const approved = await approveAiImprovementRequest({
      client: mock.client,
      id: "request-1",
      actor: { id: "super-1", type: "user", role: "super_admin" },
    });

    expect(approved.status).toBe("approved");
    expect(approved.approved_by_super_admin_id).toBe("super-1");
    expect(mock.tables.ai_improvement_audit_events[0]).toEqual(
      expect.objectContaining({
        event_type: "super_admin_approved",
        old_status: "awaiting_super_admin_approval",
        new_status: "approved",
      })
    );
  });

  it("lets a Super Admin reject with a reason and writes audit", async () => {
    const mock = createMockClient([{ id: "request-1" }]);

    const rejected = await rejectAiImprovementRequest({
      client: mock.client,
      id: "request-1",
      actor: { id: "super-1", type: "user", role: "super_admin" },
      rejectionReason: "Rollback plan is incomplete.",
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejection_reason).toBe("Rollback plan is incomplete.");
    expect(mock.tables.ai_improvement_audit_events[0]).toEqual(
      expect.objectContaining({
        event_type: "super_admin_rejected",
        old_status: "awaiting_super_admin_approval",
        new_status: "rejected",
      })
    );
  });

  it("rejects without a rejection reason", async () => {
    const mock = createMockClient([{ id: "request-1" }]);

    await expect(
      rejectAiImprovementRequest({
        client: mock.client,
        id: "request-1",
        actor: { id: "super-1", type: "user", role: "super_admin" },
        rejectionReason: " ",
      })
    ).rejects.toThrow("Rejection reason is required");
  });

  it("links pull request URLs and stores test summaries", async () => {
    const mock = createMockClient([{ id: "request-1", status: "in_progress" }]);

    const updated = await updateAiImprovementRequest({
      client: mock.client,
      id: "request-1",
      input: {
        branchName: "feature/ai-super-admin-approval-workflow",
        pullRequestUrl: "https://github.com/example/repo/pull/12",
        latestCommitSha: "abc123",
        testSummary: "npm run test passed.",
        checksPassed: true,
      },
      actor: { id: "super-1", type: "user", role: "super_admin" },
    });

    expect(updated.pull_request_url).toBe("https://github.com/example/repo/pull/12");
    expect(updated.test_summary).toBe("npm run test passed.");
    expect(updated.checks_passed).toBe(true);
  });

  it("normalizes high-risk requests clearly", () => {
    const normalized = normalizeAiImprovementRequestInput({
      title: "Database migration approval",
      riskLevel: "critical",
    });

    expect(normalized.risk_level).toBe("critical");
  });
});
