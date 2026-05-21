import { describe, expect, it } from "vitest";
import { DEMO_COMPANY_NAME, resetDemoCompany, seedDemoCompany } from "./demoCompanySeed";

type Row = Record<string, unknown>;

class FakeQuery {
  private operation: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private filters: Array<{ column: string; value: unknown }> = [];
  private payload: unknown;

  constructor(
    private readonly db: Record<string, Row[]>,
    private readonly tableName: string
  ) {}

  select() {
    return this;
  }

  eq(...args: unknown[]) {
    const [column, value] = args as [string, unknown];
    this.filters.push({ column, value });
    return this;
  }

  in(...args: unknown[]) {
    const [column, values] = args as [string, unknown[]];
    this.filters.push({ column, value: values });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  insert(values: unknown) {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  upsert(values: unknown) {
    this.operation = "upsert";
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private table() {
    this.db[this.tableName] ??= [];
    return this.db[this.tableName];
  }

  private matches(row: Row) {
    return this.filters.every(({ column, value }) => {
      if (Array.isArray(value)) return value.includes(row[column]);
      return row[column] === value;
    });
  }

  private addId(row: Row) {
    if (row.id) return row;
    return { id: `${this.tableName}-${this.table().length + 1}`, ...row };
  }

  private async execute() {
    const rows = this.table();
    if (this.operation === "insert") {
      const values = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted = values.map((row) => this.addId({ ...row }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }
    if (this.operation === "upsert") {
      const values = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const upserted = values.map((row) => {
        const conflict =
          this.tableName === "companies"
            ? rows.find((existing) => existing.team_key === row.team_key)
            : this.tableName === "company_memberships"
              ? rows.find((existing) => existing.user_id === row.user_id && existing.company_id === row.company_id)
              : this.tableName === "company_subscriptions"
                ? rows.find((existing) => existing.company_id === row.company_id)
                : this.tableName === "company_integration_connections"
                  ? rows.find((existing) => existing.company_id === row.company_id && existing.provider === row.provider)
                  : null;
        if (conflict) {
          Object.assign(conflict, row);
          return conflict;
        }
        const inserted = this.addId({ ...row });
        rows.push(inserted);
        return inserted;
      });
      return { data: upserted, error: null };
    }
    if (this.operation === "update") {
      const updated: Row[] = [];
      for (const row of rows) {
        if (!this.matches(row)) continue;
        Object.assign(row, this.payload as Row);
        updated.push(row);
      }
      return { data: updated, error: null };
    }
    if (this.operation === "delete") {
      const kept = rows.filter((row) => !this.matches(row));
      const deleted = rows.filter((row) => this.matches(row));
      this.db[this.tableName] = kept;
      return { data: deleted, error: null };
    }
    return { data: rows.filter((row) => this.matches(row)), error: null };
  }
}

function fakeSupabase(db: Record<string, Row[]>) {
  return {
    from(tableName: string) {
      return new FakeQuery(db, tableName);
    },
  };
}

function seedDb(): Record<string, Row[]> {
  return {
    companies: [{ id: "prod-company", name: "Production Co", team_key: "production-co", demo_company: false }],
    user_roles: [{ user_id: "user-1", role: "company_admin", team: "Production Co", company_id: "prod-company" }],
  };
}

describe("seedDemoCompany", () => {
  it("creates an isolated demo company and switches the active company", async () => {
    const db = seedDb();
    const result = await seedDemoCompany({
      supabase: fakeSupabase(db),
      actorUserId: "user-1",
      actorEmail: "user@example.com",
    });

    expect(result.companyName).toBe(DEMO_COMPANY_NAME);
    expect(result.previousCompanyId).toBe("prod-company");
    expect(result.counts.jobsites).toBe(3);
    expect(result.counts.microsoftTasks).toBe(6);
    expect(db.companies.some((row) => row.name === DEMO_COMPANY_NAME && row.demo_company === true)).toBe(true);
    expect(db.user_roles[0].company_id).toBe(result.companyId);
    expect(db.user_roles[0].role).toBe("company_admin");
    expect(db.company_memberships?.[0]).toMatchObject({
      user_id: "user-1",
      company_id: result.companyId,
      role: "company_admin",
    });
  });

  it("is idempotent for the same user demo company", async () => {
    const db = seedDb();
    const supabase = fakeSupabase(db);
    const first = await seedDemoCompany({ supabase, actorUserId: "user-1" });
    const second = await seedDemoCompany({ supabase, actorUserId: "user-1" });

    expect(second.companyId).toBe(first.companyId);
    expect(db.companies.filter((row) => row.demo_company === true)).toHaveLength(1);
    expect(db.company_jobsites).toHaveLength(3);
    expect(db.company_microsoft_project_tasks).toHaveLength(6);
  });

  it("resets only the actor demo company and restores the previous workspace", async () => {
    const db = seedDb();
    const supabase = fakeSupabase(db);
    const seeded = await seedDemoCompany({ supabase, actorUserId: "user-1" });

    db.companies.push({ id: "other-prod", name: "Other Production", team_key: "other-prod", demo_company: false });
    const reset = await resetDemoCompany({ supabase, actorUserId: "user-1" });

    expect(reset).toMatchObject({ companyId: seeded.companyId, restoredCompanyId: "prod-company", deletedDemoCompany: true });
    expect(db.companies.some((row) => row.id === seeded.companyId)).toBe(false);
    expect(db.companies.some((row) => row.id === "prod-company")).toBe(true);
    expect(db.companies.some((row) => row.id === "other-prod")).toBe(true);
    expect(db.user_roles[0].company_id).toBe("prod-company");
  });
});
