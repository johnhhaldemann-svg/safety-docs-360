import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/riskMemory/facets", () => ({
  buildCorrectiveActionFacetRow: vi.fn((companyId: string, row: Record<string, unknown>) => ({
    company_id: companyId,
    source_module: "corrective_action",
    source_id: row.id,
  })),
  buildIncidentFacetRow: vi.fn((companyId: string, row: Record<string, unknown>) => ({
    company_id: companyId,
    source_module: "incident",
    source_id: row.id,
  })),
  buildSorRecordFacetRow: vi.fn((companyId: string, row: Record<string, unknown>) => ({
    company_id: companyId,
    source_module: "sor_record",
    source_id: row.id,
  })),
  upsertRiskMemoryFacetSafe: vi.fn(async () => ({ ok: true })),
}));

import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { upsertRiskMemoryFacetSafe } from "@/lib/riskMemory/facets";
import * as route from "./route";

const mockedAuthorize = vi.mocked(authorizeRequest);
const mockedCreateAdmin = vi.mocked(createSupabaseAdminClient);
const mockedUpsertFacet = vi.mocked(upsertRiskMemoryFacetSafe);

function authForRole(role: string) {
  return {
    role,
    supabase: {},
    user: { id: "reviewer-1" },
  } as never;
}

function makeUpdateBuilder(table: string, rows: Array<Record<string, unknown>>) {
  return {
    update: vi.fn((patch: Record<string, unknown>) => ({
      in: vi.fn((_column: string, ids: string[]) => ({
        select: vi.fn(async () => ({
          data: rows
            .filter((row) => ids.includes(String(row.id)))
            .map((row) => ({ ...row, ...patch })),
          error: null,
        })),
      })),
    })),
    delete: vi.fn(() => {
      const chain = {
        eq: vi.fn(() => chain),
        then: (resolve: (value: { data: never[]; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: [], error: null })),
      };
      return chain;
    }),
    table,
  };
}

function makeAdmin(rows: Array<Record<string, unknown>>) {
  return {
    from: vi.fn((table: string) => makeUpdateBuilder(table, rows)),
  };
}

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response");
  return response;
}

describe("/api/superadmin/prediction-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["company_admin", "admin", "sales_demo"])("rejects %s", async (role) => {
    mockedAuthorize.mockResolvedValue(authForRole(role));

    const response = expectResponse(
      await route.GET(new Request("https://example.com/api/superadmin/prediction-validation"))
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Platform prediction validation access required");
  });

  it("requires a rating when approving", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("platform_admin"));
    mockedCreateAdmin.mockReturnValue(makeAdmin([]) as never);

    const response = expectResponse(
      await route.PATCH(
        new Request("https://example.com/api/superadmin/prediction-validation", {
          method: "PATCH",
          body: JSON.stringify({
            status: "approved",
            items: [{ id: "sor-1", sourceType: "sor" }],
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("rating is required");
  });

  it("allows platform staff to approve SORs, incidents, and corrective actions", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("internal_reviewer"));
    mockedCreateAdmin.mockReturnValue(
      makeAdmin([
        { id: "sor-1", company_id: "company-1", project: "Project A", hazard_category_code: "fall" },
        { id: "incident-1", company_id: "company-1", title: "Incident A" },
        { id: "capa-1", company_id: "company-1", title: "Corrective Action A", due_at: "2026-05-05" },
      ]) as never
    );

    const response = expectResponse(
      await route.PATCH(
        new Request("https://example.com/api/superadmin/prediction-validation", {
          method: "PATCH",
          body: JSON.stringify({
            status: "approved",
            rating: 4,
            tags: ["complete"],
            notes: "Good source record.",
            items: [
              { id: "sor-1", sourceType: "sor" },
              { id: "incident-1", sourceType: "incident" },
              { id: "capa-1", sourceType: "corrective_action" },
            ],
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.updated).toBe(3);
    expect(mockedUpsertFacet).toHaveBeenCalledTimes(3);
  });
});
