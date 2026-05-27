import { describe, expect, it } from "vitest";
import {
  codeForCompanyTrainingRequirement,
  planProfileBackfillRows,
  planRoleBackfillRows,
  planTrainingMatrixRows,
  slugify,
} from "./remediate-production-health-warnings.mjs";

type PlannedTrainingRow = {
  requirement_code: string;
};

describe("production health remediation helpers", () => {
  it("creates stable company training matrix codes", () => {
    expect(
      codeForCompanyTrainingRequirement({
        id: "9b8b91be-1111-4222-9333-abcdefabcdef",
        title: "OSHA Hot Work Orientation",
      })
    ).toBe("company_req_9b8b91be11_osha_hot_work_orientation");
    expect(slugify(" First Aid / CPR ")).toBe("first_aid_cpr");
  });

  it("plans company-specific training rows before missing baseline rows", () => {
    const rows = planTrainingMatrixRows({
      companies: [{ id: "company-a", name: "Acme" }],
      existingMatrixRows: [{ company_id: "company-a", title: "Fall Protection", requirement_code: "fall_custom" }],
      companyTrainingRequirements: [
        {
          id: "11111111-2222-3333-4444-555555555555",
          company_id: "company-a",
          title: "OSHA Hot Work Orientation",
          match_keywords: ["hot work", "OSHA 10"],
          apply_trades: ["steel"],
          apply_positions: ["foreman"],
          apply_task_codes: ["HOT-WORK"],
          active: true,
        },
      ],
    }) as PlannedTrainingRow[];

    expect(rows[0]).toMatchObject({
      company_id: "company-a",
      title: "OSHA Hot Work Orientation",
      requirement_code: "company_req_1111111122_osha_hot_work_orientation",
      trade_codes: ["steel"],
      position_codes: ["foreman"],
      task_codes: ["HOT-WORK"],
    });
    expect(rows.some((row) => row.requirement_code === "baseline_hot_work")).toBe(false);
    expect(rows.some((row) => row.requirement_code === "baseline_fall_protection")).toBe(false);
    expect(rows.some((row) => row.requirement_code === "baseline_hazard_communication")).toBe(true);
  });

  it("backfills user roles from active memberships without overwriting existing roles", () => {
    const rows = planRoleBackfillRows({
      companies: [{ id: "company-a", name: "Acme" }],
      existingRoles: [{ user_id: "existing-user", role: "company_admin" }],
      memberships: [
        { user_id: "existing-user", company_id: "company-a", role: "field_user", status: "active" },
        { user_id: "new-user", company_id: "company-a", role: "safety_manager", status: "active" },
        { user_id: "pending-user", company_id: "company-a", role: "company_admin", status: "pending" },
      ],
    });

    expect(rows).toEqual([
      {
        user_id: "new-user",
        role: "safety_manager",
        team: "Acme",
        company_id: "company-a",
        account_status: "active",
        created_by: null,
        updated_by: null,
      },
    ]);
  });

  it("creates minimal profiles only for existing auth users in the remediation target set", () => {
    const rows = planProfileBackfillRows({
      authUsers: [
        { id: "target-user", user_metadata: { full_name: "Jordan Safety" } },
        { id: "unrelated-user", user_metadata: { full_name: "Ignored User" } },
      ],
      existingProfiles: [{ user_id: "profiled-user" }],
      targetUserIds: new Set(["target-user", "profiled-user", "missing-auth-user"]),
    });

    expect(rows).toEqual([
      {
        user_id: "target-user",
        full_name: "Jordan Safety",
        preferred_name: "Jordan",
        job_title: null,
        trade_specialty: null,
        readiness_status: "ready",
        certifications: [],
        certification_expirations: {},
        specialties: [],
        equipment: [],
        profile_complete: false,
      },
    ]);
  });
});
