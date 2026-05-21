import { describe, expect, it, vi } from "vitest";
import {
  classifyTrainingExpirationStage,
  createTrainingExpirationDedupeKey,
  loadTrainingExpirationItems,
  runTrainingExpirationNotificationCron,
} from "@/lib/trainingExpirationNotifications";

type FakeRow = Record<string, unknown>;

function makeFakeSupabase(seed?: {
  deliveryRows?: FakeRow[];
  trackedEmployeeEmail?: string | null;
}) {
  const tables: Record<string, FakeRow[]> = {
    companies: [{ id: "company-1", name: "Summit Builders", status: "active" }],
    company_memberships: [
      { user_id: "user-safety", company_id: "company-1", role: "safety_manager", status: "active" },
      { user_id: "user-worker", company_id: "company-1", role: "company_user", status: "active" },
    ],
    user_profiles: [
      {
        user_id: "user-safety",
        certifications: ["Fall Protection"],
        certification_expirations: { "Fall Protection": "2026-06-04" },
      },
      {
        user_id: "user-worker",
        certifications: ["First Aid"],
        certification_expirations: { "First Aid": "2026-07-30" },
      },
    ],
    company_employee_profiles: [
      {
        id: "tracked-1",
        company_id: "company-1",
        full_name: "Tracked Worker",
        email: seed?.trackedEmployeeEmail ?? null,
        status: "active",
        certification_expirations: { "Forklift": "2026-06-20" },
      },
      {
        id: "tracked-archived",
        company_id: "company-1",
        full_name: "Archived Worker",
        email: "archived@example.com",
        status: "archived",
        certification_expirations: { "Hot Work": "2026-05-28" },
      },
    ],
    company_employee_training_records: [
      {
        id: "tracked-record-1",
        company_id: "company-1",
        employee_id: "tracked-1",
        title: "Forklift",
        expires_on: "2026-06-20",
      },
      {
        id: "tracked-record-archived",
        company_id: "company-1",
        employee_id: "tracked-archived",
        title: "Hot Work",
        expires_on: "2026-05-28",
      },
    ],
    contractor_employee_jobsite_assignments: [
      {
        id: "assignment-1",
        company_id: "company-1",
        jobsite_id: "jobsite-1",
        contractor_employee_id: "contractor-1",
        status: "active",
      },
      {
        id: "assignment-inactive",
        company_id: "company-1",
        jobsite_id: "jobsite-1",
        contractor_employee_id: "contractor-inactive",
        status: "archived",
      },
    ],
    contractor_employee_profiles: [
      { id: "contractor-1", full_name: "Contractor Worker", email: "contractor@example.com" },
      { id: "contractor-inactive", full_name: "Inactive Contractor", email: "inactive@example.com" },
    ],
    contractor_employee_training_records: [
      {
        id: "contractor-record-1",
        contractor_employee_id: "contractor-1",
        title: "Hot Work",
        expires_on: "2026-05-20",
      },
      {
        id: "contractor-record-inactive",
        contractor_employee_id: "contractor-inactive",
        title: "Confined Space",
        expires_on: "2026-05-28",
      },
    ],
    company_jobsites: [{ id: "jobsite-1", name: "North Tower" }],
    training_expiration_notification_deliveries: seed?.deliveryRows ?? [],
    company_notification_preferences: [],
    company_notifications: [],
  };
  let idCounter = 0;

  function matches(row: FakeRow, filters: Array<{ op: string; column: string; value: unknown }>) {
    return filters.every((filter) => {
      const actual = row[filter.column];
      if (filter.op === "eq") return actual === filter.value;
      if (filter.op === "neq") return actual !== filter.value;
      if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(String(actual));
      return true;
    });
  }

  function table(name: string) {
    const filters: Array<{ op: string; column: string; value: unknown }> = [];
    let pendingInsert: FakeRow[] | null = null;
    let pendingUpdate: FakeRow | null = null;

    function selectedRows() {
      return (tables[name] ?? []).filter((row) => matches(row, filters));
    }

    function applyUpdate() {
      const rows = selectedRows();
      for (const row of rows) Object.assign(row, pendingUpdate);
      return rows;
    }

    const builder = {
      select() {
        return builder;
      },
      order() {
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push({ op: "eq", column, value });
        return builder;
      },
      neq(column: string, value: unknown) {
        filters.push({ op: "neq", column, value });
        return builder;
      },
      in(column: string, value: unknown[]) {
        filters.push({ op: "in", column, value });
        if (pendingUpdate) {
          const rows = applyUpdate();
          return Promise.resolve({ data: rows, error: null });
        }
        return builder;
      },
      insert(rows: FakeRow | FakeRow[]) {
        const nextRows = Array.isArray(rows) ? rows : [rows];
        if (name === "training_expiration_notification_deliveries") {
          const existing = (tables[name] ?? []).find((row) => row.dedupe_key === nextRows[0]?.dedupe_key);
          if (existing) {
            pendingInsert = null;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }),
              }),
              then: (resolve: (value: unknown) => unknown) =>
                Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }).then(resolve),
            };
          }
        }
        pendingInsert = nextRows.map((row) => ({ id: row.id ?? `delivery-${++idCounter}`, ...row }));
        tables[name] ??= [];
        tables[name].push(...pendingInsert);
        return builder;
      },
      update(row: FakeRow) {
        pendingUpdate = row;
        return builder;
      },
      maybeSingle() {
        const rows = pendingUpdate ? applyUpdate() : selectedRows();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        const rows = pendingInsert ?? (pendingUpdate ? applyUpdate() : selectedRows());
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      then(resolve: (value: { data: FakeRow[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
        if (pendingUpdate) {
          return Promise.resolve({ data: applyUpdate(), error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: selectedRows(), error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  const authUsers: Record<string, { email: string; user_metadata: Record<string, unknown> }> = {
    "user-safety": { email: "safety@example.com", user_metadata: { full_name: "Safety Manager" } },
    "user-worker": { email: "worker@example.com", user_metadata: { full_name: "App Worker" } },
  };

  return {
    client: {
      from: vi.fn((name: string) => table(name)),
      auth: {
        admin: {
          getUserById: vi.fn(async (userId: string) => ({
            data: { user: authUsers[userId] ?? null },
            error: authUsers[userId] ? null : { message: "missing user" },
          })),
        },
      },
    },
    tables,
  };
}

describe("training expiration stage classification", () => {
  const asOf = new Date("2026-05-21T12:00:00.000Z");

  it("classifies reminder windows and ignores invalid or distant dates", () => {
    expect(classifyTrainingExpirationStage("2026-06-20", asOf)).toEqual({ stage: "30d", daysUntilExpiry: 30 });
    expect(classifyTrainingExpirationStage("2026-06-04", asOf)).toEqual({ stage: "14d", daysUntilExpiry: 14 });
    expect(classifyTrainingExpirationStage("2026-05-28", asOf)).toEqual({ stage: "7d", daysUntilExpiry: 7 });
    expect(classifyTrainingExpirationStage("2026-05-20", asOf)).toEqual({ stage: "expired", daysUntilExpiry: -1 });
    expect(classifyTrainingExpirationStage("2026-07-30", asOf)).toBeNull();
    expect(classifyTrainingExpirationStage("not-a-date", asOf)).toBeNull();
    expect(classifyTrainingExpirationStage(null, asOf)).toBeNull();
  });

  it("changes dedupe keys when a renewed expiration date is recorded", () => {
    const base = {
      companyId: "company-1",
      recipientContext: "worker" as const,
      recipientKey: "worker@example.com",
      subjectType: "tracked_employee",
      subjectId: "tracked-1",
      sourceTable: "company_employee_training_records",
      sourceId: "record-1",
      stage: "30d" as const,
      trainingTitle: "Fall Protection",
    };
    expect(createTrainingExpirationDedupeKey({ ...base, expiresOn: "2026-06-20" })).not.toBe(
      createTrainingExpirationDedupeKey({ ...base, expiresOn: "2027-06-20" })
    );
  });
});

describe("training expiration item collection", () => {
  it("collects app, tracked, and contractor training while excluding archived/inactive records", async () => {
    const fake = makeFakeSupabase();
    const result = await loadTrainingExpirationItems({
      supabase: fake.client as never,
      company: { id: "company-1", name: "Summit Builders" },
      asOf: new Date("2026-05-21T12:00:00.000Z"),
    });

    const labels = result.items.map((item) => `${item.subjectType}:${item.workerName}:${item.trainingTitle}:${item.stage}`);
    expect(labels).toEqual([
      "contractor_employee:Contractor Worker:Hot Work:expired",
      "app_user:Safety Manager:Fall Protection:14d",
      "tracked_employee:Tracked Worker:Forklift:30d",
    ]);
    expect(labels.join(" ")).not.toContain("Archived Worker");
    expect(labels.join(" ")).not.toContain("Inactive Contractor");
  });
});

describe("training expiration cron delivery", () => {
  it("sends one combined email when the worker is also a safety manager and logs missing worker email skips", async () => {
    const fake = makeFakeSupabase();
    const fetcher = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        Response.json({ id: "email-1" })
    );
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("TRAINING_EXPIRATION_FROM_EMAIL", "training@example.com");

    const result = await runTrainingExpirationNotificationCron({
      supabase: fake.client as never,
      asOf: new Date("2026-05-21T12:00:00.000Z"),
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toMatchObject({
      ok: true,
      itemsSeen: 3,
      workerEmailsSent: 2,
      managerEmailsSent: 1,
      skippedMissingEmail: 1,
      failedEmails: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const safetyEmail = fetcher.mock.calls
      .map((call) => JSON.parse(String(call[1]?.body ?? "{}")) as { html: string })
      .find((body) => body.html.includes("Safety manager digest"));
    expect(safetyEmail).toBeTruthy();
    expect(safetyEmail.html).toContain("Your training renewals");
    expect(safetyEmail.html).toContain("Safety manager digest");
    expect(fake.tables.training_expiration_notification_deliveries.some((row) => row.status === "skipped")).toBe(true);
    expect(fake.tables.company_notifications).toHaveLength(1);
  });

  it("dedupes sent deliveries and retries failed deliveries up to the cap", async () => {
    const fake = makeFakeSupabase({ trackedEmployeeEmail: "tracked@example.com" });
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("TRAINING_EXPIRATION_FROM_EMAIL", "training@example.com");
    const failingFetcher = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        new Response("provider down", { status: 500 })
    );

    const first = await runTrainingExpirationNotificationCron({
      supabase: fake.client as never,
      asOf: new Date("2026-05-21T12:00:00.000Z"),
      fetcher: failingFetcher as unknown as typeof fetch,
    });
    expect(first).toMatchObject({ ok: true, failedEmails: 3 });
    expect(fake.tables.training_expiration_notification_deliveries.every((row) => row.status === "failed")).toBe(true);

    const okFetcher = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        Response.json({ id: "email-retry" })
    );
    const second = await runTrainingExpirationNotificationCron({
      supabase: fake.client as never,
      asOf: new Date("2026-05-21T12:00:00.000Z"),
      fetcher: okFetcher as unknown as typeof fetch,
    });
    expect(second).toMatchObject({ ok: true, failedEmails: 0 });
    expect(okFetcher).toHaveBeenCalledTimes(3);
    expect(fake.tables.training_expiration_notification_deliveries.every((row) => row.status === "sent")).toBe(true);

    const third = await runTrainingExpirationNotificationCron({
      supabase: fake.client as never,
      asOf: new Date("2026-05-21T12:00:00.000Z"),
      fetcher: okFetcher as unknown as typeof fetch,
    });
    expect(third).toMatchObject({ ok: true, duplicateDeliveries: 6 });
    expect(okFetcher).toHaveBeenCalledTimes(3);
  });
});
