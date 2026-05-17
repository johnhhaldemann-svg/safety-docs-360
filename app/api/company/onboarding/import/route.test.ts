import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";
import { POST } from "./route";
import {
  insertTrainingRecordRows,
  upsertJobsiteRows,
  upsertTrackedEmployeeRows,
} from "@/lib/companyOnboardingPersistence";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(async () => ({
    supabase: { from: fromMock },
    user: { id: "user-1", email: "admin@example.com", user_metadata: {} },
    role: "company_admin",
    team: "Acme",
    permissionMap: { can_access_training: true, can_manage_company_users: true },
  })),
  isCompanyRole: vi.fn(() => true),
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(async () => ({
    companyId: "company-1",
    companyName: "Acme",
  })),
}));

vi.mock("@/lib/companyTrainingAccess", () => ({
  canMutateCompanyTrainingRequirements: vi.fn(() => true),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

vi.mock("@/lib/companyOnboardingPersistence", () => ({
  upsertTrackedEmployeeRows: vi.fn(async () => ({
    employees: [],
    acceptedCount: 1,
    rowErrors: [],
    error: null,
  })),
  upsertJobsiteRows: vi.fn(async () => ({
    jobsites: [],
    acceptedCount: 1,
    rowErrors: [],
    error: null,
  })),
  insertTrainingRecordRows: vi.fn(async () => ({
    acceptedCount: 1,
    rowErrors: [],
    error: null,
  })),
}));

describe("/api/company/onboarding/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      expect(table).not.toBe("company_memberships");
      expect(table).not.toBe("company_invites");
      return {
        insert: vi.fn(async () => ({ data: null, error: null })),
      };
    });
  });

  it("routes valid import rows to tracked data persistence without touching seat tables", async () => {
    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/company/onboarding/import", {
        method: "POST",
        body: JSON.stringify({
          employees: [{ full_name: "Jordan Lee", email: "jordan@example.com" }],
          jobsites: [{ name: "North Tower" }],
          trainingRecords: [
            {
              email: "jordan@example.com",
              training_title: "OSHA 10 Construction",
              completed_on: "2025-08-12",
            },
          ],
        }),
      }))
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.acceptedCount).toBe(3);
    expect(upsertTrackedEmployeeRows).toHaveBeenCalledTimes(1);
    expect(upsertJobsiteRows).toHaveBeenCalledTimes(1);
    expect(insertTrainingRecordRows).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("company_onboarding_imports");
  });
});
