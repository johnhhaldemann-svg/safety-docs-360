import { afterEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, isCompanyRole, getCompanyScope, checkFixedWindowRateLimit, serverLog } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isCompanyRole: vi.fn(),
  getCompanyScope: vi.fn(),
  checkFixedWindowRateLimit: vi.fn(),
  serverLog: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isCompanyRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/rateLimit", () => ({ checkFixedWindowRateLimit }));
vi.mock("@/lib/serverLog", () => ({ serverLog }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("company checklist evaluate route", () => {
  function mockHappyPathAuth() {
    authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      role: "company_admin",
      team: null,
    });
    isCompanyRole.mockReturnValue(true);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    checkFixedWindowRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  }

  it("returns checklist matrix rows for valid payload", async () => {
    mockHappyPathAuth();

    const response = await POST(
      new Request("https://example.com/api/company/checklist/evaluate", {
        method: "POST",
        body: JSON.stringify({
          surface: "csep",
          formData: {
            project_name: "North Campus",
            tasks: ["Excavation"],
            emergency_procedures: "Call 911",
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected POST to return a response");
    }
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      rows: Array<{ id: string }>;
      summary: { total: number };
      sourcePolicy: string;
    };
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.summary.total).toBe(body.rows.length);
    expect(body.sourcePolicy).toContain("required coverage baseline");
  });

  it("adds jurisdiction-specific checklist evidence when a state-plan profile is selected", async () => {
    mockHappyPathAuth();

    const response = await POST(
      new Request("https://example.com/api/company/checklist/evaluate", {
        method: "POST",
        body: JSON.stringify({
          surface: "csep",
          formData: {
            governing_state: "CA",
            project_name: "North Campus",
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected POST to return a response");
    }
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      rows: Array<{ item: string; id: string }>;
    };
    expect(
      body.rows.some(
        (row) =>
          row.id === "jurisdiction:std_ca_iipp_review" ||
          row.item.includes("California state-plan review note")
      )
    ).toBe(true);
  });

  it("rejects unsupported surfaces", async () => {
    mockHappyPathAuth();

    const response = await POST(
      new Request("https://example.com/api/company/checklist/evaluate", {
        method: "POST",
        body: JSON.stringify({
          surface: "dashboard",
          formData: {},
        }),
      })
    );

    if (!response) {
      throw new Error("Expected POST to return a response");
    }
    expect(response.status).toBe(400);
  });

  it("rejects oversized payloads by content-length", async () => {
    mockHappyPathAuth();
    const response = await POST(
      new Request("https://example.com/api/company/checklist/evaluate", {
        method: "POST",
        headers: {
          "content-length": "300000",
        },
        body: JSON.stringify({
          surface: "csep",
          formData: { project_name: "Test" },
        }),
      })
    );
    if (!response) {
      throw new Error("Expected POST to return a response");
    }
    expect(response.status).toBe(413);
  });

  it("enforces rate limits", async () => {
    mockHappyPathAuth();
    checkFixedWindowRateLimit.mockReturnValue({ ok: false, retryAfterSec: 12 });
    const response = await POST(
      new Request("https://example.com/api/company/checklist/evaluate", {
        method: "POST",
        body: JSON.stringify({
          surface: "csep",
          formData: { project_name: "Test" },
        }),
      })
    );
    if (!response) {
      throw new Error("Expected POST to return a response");
    }
    expect(response.status).toBe(429);
  });
});
