import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWNER_MANUAL_REVIEW_ITEMS,
  DEFAULT_OWNER_VALIDATION_MODULES,
  validateOwnerCustomerReadyGateInput,
  validateOwnerManualReviewUpdateInput,
  validateOwnerValidationRunInput,
} from "@/lib/superadmin/ownerValidation";

describe("owner validation backend helpers", () => {
  it("defines the expected owner validation modules", () => {
    const keys = DEFAULT_OWNER_VALIDATION_MODULES.map((module) => module.module_key);

    expect(keys).toContain("login_auth");
    expect(keys).toContain("roles_permissions");
    expect(keys).toContain("jsa_builder");
    expect(keys).toContain("permit_system");
    expect(keys).toContain("training_matrix");
    expect(keys).toContain("gus_ai");
    expect(keys).toContain("mobile_views");
  });

  it("normalizes owner validation run input into safe owner-facing fields", () => {
    const input = validateOwnerValidationRunInput({
      completedAt: "2026-05-26T23:30:00.000Z",
      overallStatus: "green",
      overallScore: 114,
      summary: "Platform check completed.",
      checks: [
        {
          moduleKey: "login_auth",
          checkName: "Login page reachable",
          status: "green",
          result: "Login page loaded successfully.",
          technicalDetails: { statusCode: 200 },
          recommendedOwnerAction: "Open the login page and confirm it looks right.",
        },
        {
          moduleKey: "",
          checkName: "Ignored",
          status: "red",
          result: "Missing module key.",
        },
      ],
    });

    expect(input.overallStatus).toBe("green");
    expect(input.overallScore).toBe(100);
    expect(input.checks).toHaveLength(1);
    expect(input.checks?.[0]).toMatchObject({
      moduleKey: "login_auth",
      checkName: "Login page reachable",
      status: "green",
      result: "Login page loaded successfully.",
    });
  });

  it("defines the requested owner manual review checklists", () => {
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.jsa_builder).toContain("Create new JSA");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.jsa_builder).toContain("Export JSA if supported");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.permit_system).toContain("Create Hot Work permit");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.training_matrix).toContain("Confirm expired training appears expired");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.incidents).toContain("Create draft incident");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.observations).toContain("Create unsafe observation");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.documents).toContain("Export Word if supported");
    expect(DEFAULT_OWNER_MANUAL_REVIEW_ITEMS.gus_ai).toContain(
      "Confirm response does not invent unsupported requirements"
    );
  });

  it("normalizes manual review updates", () => {
    expect(
      validateOwnerManualReviewUpdateInput({
        status: "needs_review",
        notes: "  Owner wants one more look.  ",
      })
    ).toEqual({
      status: "needs_review",
      notes: "Owner wants one more look.",
    });

    expect(validateOwnerManualReviewUpdateInput({ status: "bad" })).toEqual({
      status: "not_started",
      notes: null,
    });
  });

  it("normalizes customer-ready gate updates", () => {
    expect(
      validateOwnerCustomerReadyGateInput({
        customerReadyStatus: "Approved for customer use",
      })
    ).toEqual({ customerReadyStatus: "Approved for customer use" });

    expect(validateOwnerCustomerReadyGateInput({ customerReadyStatus: "done" })).toEqual({
      customerReadyStatus: "Needs owner review",
    });
  });
});
