import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  canMutateCompanyTrainingRequirements,
  createSupabaseAdminClient,
  fetchCompanyTrainingRequirements,
  getCompanyScope,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  sendTrainingAssignmentEmail,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  canMutateCompanyTrainingRequirements: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  fetchCompanyTrainingRequirements: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  sendTrainingAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyTrainingAccess", () => ({ canMutateCompanyTrainingRequirements }));
vi.mock("@/lib/companyTrainingRequirementsDb", () => ({ fetchCompanyTrainingRequirements }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  isCompanyRole: (role: string) => role.startsWith("company_") || role === "safety_manager",
}));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/trainingAssignmentEmail", () => ({ sendTrainingAssignmentEmail }));

import { POST } from "./route";

function makeSupabase() {
  const eventInsert = vi.fn().mockResolvedValue({ error: null });
  const actionInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: { id: "action-1" }, error: null }),
    })),
  }));

  return {
    eventInsert,
    actionInsert,
    from: vi.fn((table: string) => {
      if (table === "company_corrective_actions") {
        return { insert: actionInsert };
      }
      if (table === "company_employee_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { email: "tracked.worker@example.com" },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      if (table === "company_jobsites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { name: "North Tower" },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      if (table === "company_corrective_action_events") {
        return { insert: eventInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("/api/company/training-matrix/ai-assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMutateCompanyTrainingRequirements.mockReturnValue(true);
    createSupabaseAdminClient.mockReturnValue(null);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    fetchCompanyTrainingRequirements.mockResolvedValue({
      rows: [
        {
          id: "req-1",
          title: "LOTO Authorized Worker",
          sort_order: 1,
          match_keywords: ["LOTO Authorized Worker"],
          match_fields: ["certifications"],
          apply_trades: ["Electrical"],
          apply_positions: ["Electrician"],
          apply_sub_trades: [],
          apply_task_codes: [],
          renewal_months: 12,
          is_generated: false,
          generated_source_type: null,
          generated_source_document_id: null,
          generated_source_operation_key: null,
        },
      ],
      error: null,
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: true,
    });
    sendTrainingAssignmentEmail.mockResolvedValue({
      sent: true,
      status: "sent",
      providerMessageId: "email-1",
    });
  });

  it("emails tracked non-user employees when training is assigned", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      permissionMap: {},
      team: "Builder Co",
      user: { id: "admin-1", email: "admin@example.com", user_metadata: { full_name: "Admin User" } },
      supabase,
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/training-matrix/ai-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            worker: {
              id: "tracked:employee-1",
              name: "Taylor Ruiz",
              trade: "Electrical",
              role: "Electrician",
              status: "overdue",
              readinessScore: 45,
              assignedSiteId: "site-1",
            },
          }),
        })
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications.sent).toBe(1);
    expect(json.assignments[0].notificationStatus).toBe("sent");
    expect(sendTrainingAssignmentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "tracked.worker@example.com",
        workerName: "Taylor Ruiz",
        companyName: "Builder Co",
        assignedByName: "Admin User",
        requirementTitle: "LOTO Authorized Worker",
        jobsiteName: "North Tower",
      })
    );
    expect(supabase.eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "training_assignment_notification",
        event_payload: expect.objectContaining({ status: "sent" }),
      })
    );
  });
});
