import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  canManageCompanyIncidents: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  checkFixedWindowRateLimit: vi.fn(),
  parseOshaLogBuffer: vi.fn(),
  serverLog: vi.fn(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rbac")>()),
  authorizeRequest: mocks.authorizeRequest,
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/companyFeatureAccess", () => ({ canManageCompanyIncidents: mocks.canManageCompanyIncidents }));
vi.mock("@/lib/jobsiteAccess", () => ({
  getJobsiteAccessScope: mocks.getJobsiteAccessScope,
  isJobsiteAllowed: mocks.isJobsiteAllowed,
}));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany: mocks.blockIfCsepOnlyCompany }));
vi.mock("@/lib/rateLimit", () => ({ checkFixedWindowRateLimit: mocks.checkFixedWindowRateLimit }));
vi.mock("@/lib/serverLog", () => ({ serverLog: mocks.serverLog }));
vi.mock("@/lib/oshaLogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oshaLogs")>()),
  parseOshaLogBuffer: mocks.parseOshaLogBuffer,
}));

import { DELETE, POST } from "@/app/api/company/osha-logs/imports/route";

function uploadRequest(file: File, extras?: Record<string, string>) {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(extras ?? {})) form.append(key, value);
  return new Request("https://example.com/api/company/osha-logs/imports", {
    method: "POST",
    body: form,
  });
}

function requireResponse(response: Response | undefined) {
  if (!response) throw new Error("Expected route to return a response");
  return response;
}

function makeSupabase() {
  const tableCalls: string[] = [];
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const builders = {
    company_osha_log_imports: {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: "import-1" }, error: null })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({ data: { id: "import-1", storage_path: "companies/co1/osha-logs/file.csv" }, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        error: null,
      })),
    },
    company_osha_log_cases: {
      insert: vi.fn(async () => ({ error: null })),
    },
    company_risk_events: {
      insert: vi.fn(async () => ({ error: null })),
    },
  };
  const supabase = {
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
    from: vi.fn((table: keyof typeof builders) => {
      tableCalls.push(String(table));
      return builders[table] ?? { insert: vi.fn(async () => ({ error: null })) };
    }),
  };
  return { supabase, tableCalls, upload, remove };
}

function authWithSupabase(supabase: unknown) {
  return {
    supabase,
    user: { id: "user-1", email: "safety@example.com" },
    role: "company_admin",
    team: "Ops",
    permissionMap: {},
  };
}

describe("OSHA log import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyScope.mockResolvedValue({ companyId: "co1", companyName: "Ops" });
    mocks.canManageCompanyIncidents.mockReturnValue(true);
    mocks.getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    mocks.isJobsiteAllowed.mockReturnValue(true);
    mocks.blockIfCsepOnlyCompany.mockResolvedValue(null);
    mocks.checkFixedWindowRateLimit.mockReturnValue({ ok: true });
    mocks.parseOshaLogBuffer.mockResolvedValue({
      status: "processed",
      method: "csv",
      cases: [{
        caseNumber: "1",
        occurredOn: "2026-01-01",
        department: "Deck",
        location: "North",
        injuryType: "strain",
        bodyPart: "back",
        exposureEventType: "overexertion",
        injurySource: "material_handling",
        daysAwayFromWork: 3,
        daysRestricted: 0,
        jobTransfer: false,
        recordable: true,
        fatality: false,
        severity: "high",
        repeatPatternKey: "back|strain|overexertion|material_handling",
        deidentifiedSummary: "Case date 2026-01-01; back/strain; overexertion via material_handling",
        sourceRowNumber: 2,
        parserConfidence: "high",
      }],
      warnings: [],
      parsedCount: 1,
      skippedCount: 0,
    });
  });

  it("requires auth before accepting uploads", async () => {
    mocks.authorizeRequest.mockResolvedValue({ error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }) });

    const response = requireResponse(await POST(uploadRequest(new File(["case"], "osha.csv", { type: "text/csv" }))));

    expect(response.status).toBe(401);
  });

  it("rejects unsupported files and oversized files before parsing", async () => {
    const { supabase } = makeSupabase();
    mocks.authorizeRequest.mockResolvedValue(authWithSupabase(supabase));

    const unsupported = requireResponse(await POST(uploadRequest(new File(["case"], "osha.txt", { type: "text/plain" }))));
    expect(unsupported.status).toBe(400);
    expect(mocks.parseOshaLogBuffer).not.toHaveBeenCalled();

    const tooLarge = requireResponse(await POST(uploadRequest(new File([new Uint8Array(15 * 1024 * 1024 + 1)], "osha.csv", { type: "text/csv" }))));
    expect(tooLarge.status).toBe(400);
  });

  it("stores deidentified cases without creating company incidents", async () => {
    const { supabase, tableCalls } = makeSupabase();
    mocks.authorizeRequest.mockResolvedValue(authWithSupabase(supabase));

    const response = requireResponse(await POST(uploadRequest(new File(["case"], "osha.csv", { type: "text/csv" }), { year: "2026" })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: "import-1", parsedCount: 1, skippedCount: 0 });
    expect(tableCalls).toContain("company_osha_log_imports");
    expect(tableCalls).toContain("company_osha_log_cases");
    expect(tableCalls).toContain("company_risk_events");
    expect(tableCalls).not.toContain("company_incidents");
  });

  it("deletes parsed cases by cascade and removes the private storage object", async () => {
    const { supabase, remove } = makeSupabase();
    mocks.authorizeRequest.mockResolvedValue(authWithSupabase(supabase));

    const response = requireResponse(await DELETE(new Request("https://example.com/api/company/osha-logs/imports?id=import-1", { method: "DELETE" })));

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["companies/co1/osha-logs/file.csv"]);
  });
});
