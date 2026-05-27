import { describe, expect, it } from "vitest";
import { normalizeChangeLogInput, recordChangeLog } from "@/lib/superadmin/health/changeLog";
import { normalizeEventLogInput, recordEventLog } from "@/lib/superadmin/health/eventLog";
import { normalizeHealthScopeFilters } from "@/lib/superadmin/health/filters";
import { normalizeOwnerRegistryInput, upsertOwnerRegistryRecord } from "@/lib/superadmin/health/ownerRegistry";
import { createHealthHelpTicket, normalizeHealthTicketInput } from "@/lib/superadmin/health/tickets";
import type { HealthSupabaseClient, HealthSupabaseResult } from "@/lib/superadmin/health/types";

type Operation = {
  table: string;
  type: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

class MockQuery {
  filters: Array<[string, unknown]> = [];

  constructor(
    private client: MockClient,
    private table: string,
    private type: string,
    private payload?: unknown
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push([`${column}>=`, value]);
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push([`${column}<=`, value]);
    return this;
  }

  in(column: string, values: string[]) {
    this.filters.push([`${column} in`, values]);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.resolveSingle());
  }

  single() {
    return Promise.resolve(this.resolveSingle());
  }

  then<TResult1 = HealthSupabaseResult, TResult2 = never>(
    onfulfilled?: ((value: HealthSupabaseResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolveSingle() {
    const result = this.resolve();
    return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
  }

  private resolve(): HealthSupabaseResult {
    this.client.operations.push({
      table: this.table,
      type: this.type,
      payload: this.payload,
      filters: this.filters,
    });

    if (this.type === "select") {
      const rows = this.client.tables[this.table] ?? [];
      return { data: rows, error: null, count: rows.length };
    }

    const payload = Array.isArray(this.payload) ? this.payload[0] : this.payload;
    const row = { id: `${this.table}-${this.client.operations.length}`, ...(payload as Record<string, unknown>) };
    this.client.tables[this.table] = [...(this.client.tables[this.table] ?? []), row];
    return { data: row, error: null };
  }
}

class MockClient implements HealthSupabaseClient {
  operations: Operation[] = [];

  constructor(public tables: Record<string, Array<Record<string, unknown>>> = {}) {}

  from(table: string) {
    return {
      select: () => new MockQuery(this, table, "select"),
      insert: (row: Record<string, unknown> | Record<string, unknown>[]) => new MockQuery(this, table, "insert", row),
      upsert: (row: Record<string, unknown>) => new MockQuery(this, table, "upsert", row),
      update: (row: Record<string, unknown>) => new MockQuery(this, table, "update", row),
    };
  }
}

describe("SuperAdmin Health foundation helpers", () => {
  it("normalizes event log input with tenant fallback and safe enums", () => {
    const row = normalizeEventLogInput({
      companyId: "11111111-1111-4111-8111-111111111111",
      module: "  system_health  ",
      objectType: "probe",
      action: "failed",
      severity: "critical",
      metadata: { ok: false },
    });

    expect(row.tenant_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(row.module).toBe("system_health");
    expect(row.severity).toBe("critical");
    expect(row.event_status).toBe("recorded");
  });

  it("records change log before/after values and writes a linked event", async () => {
    const client = new MockClient();
    const change = await recordChangeLog(client, {
      tenantId: "00000000-0000-0000-0000-000000000000",
      changedByUserId: "11111111-1111-4111-8111-111111111111",
      objectType: "feature_flag",
      objectId: "health-v1",
      changeType: "updated",
      beforeValue: { enabled: false },
      afterValue: { enabled: true },
      riskLevel: "high",
      rollbackAvailable: true,
    });

    expect(change).toMatchObject({ object_type: "feature_flag", risk_level: "high" });
    expect(client.operations.map((op) => op.table)).toEqual(["change_log", "event_log"]);
  });

  it("normalizes owner registry records and writes owner trace events", async () => {
    const client = new MockClient();
    const normalized = normalizeOwnerRegistryInput({
      ownerType: "company",
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "requires_second_approval",
      authorityLevel: "critical",
    });

    expect(normalized.validation_status).toBe("requires_second_approval");
    expect(normalized.authority_level).toBe("critical");

    await upsertOwnerRegistryRecord(client, {
      ownerType: "company",
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "11111111-1111-4111-8111-111111111111",
    });

    expect(client.operations.map((op) => op.table)).toEqual(["owner_registry", "event_log"]);
  });

  it("creates source-linked health tickets through platform_help_tickets", async () => {
    const client = new MockClient();
    const normalized = normalizeHealthTicketInput({
      submitterUserId: "11111111-1111-4111-8111-111111111111",
      sourceType: "audit_result",
      sourceId: "audit-1",
      title: "Audit failed",
      description: "A critical audit failed and needs review.",
      severity: "critical",
    });

    expect(normalized.source_type).toBe("audit_result");
    expect(normalized.priority).toBe("critical");

    await createHealthHelpTicket(client, {
      submitterUserId: "11111111-1111-4111-8111-111111111111",
      sourceType: "audit_result",
      sourceId: "audit-1",
      title: "Audit failed",
      description: "A critical audit failed and needs review.",
      severity: "critical",
    });

    expect(client.operations.map((op) => op.table)).toEqual(["platform_help_tickets", "event_log"]);
  });

  it("keeps tenant filters explicit for tenant isolation", async () => {
    const filters = normalizeHealthScopeFilters(
      new URLSearchParams({
        tenantId: "22222222-2222-4222-8222-222222222222",
        companyId: "33333333-3333-4333-8333-333333333333",
        severity: "critical",
      })
    );
    const client = new MockClient();
    await recordEventLog(client, {
      tenantId: filters.tenantId,
      companyId: filters.companyId,
      module: "system_health",
      objectType: "probe",
      action: "checked",
    });

    const payload = client.operations[0].payload as Record<string, unknown>;
    expect(payload.tenant_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(payload.company_id).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("captures change input before and after values", () => {
    const row = normalizeChangeLogInput({
      objectType: "prompt",
      objectId: "safe-work-plan",
      changeType: "prompt_version_updated",
      beforeValue: { version: "v1" },
      afterValue: { version: "v2" },
    });

    expect(row.before_value).toEqual({ version: "v1" });
    expect(row.after_value).toEqual({ version: "v2" });
    expect(row.risk_level).toBe("medium");
  });
});
