import { describe, expect, it } from "vitest";
import { isDocumentAiReviewerRole } from "./documentAiReviewAuth";

describe("isDocumentAiReviewerRole", () => {
  it("allows platform admins and internal reviewer", () => {
    expect(isDocumentAiReviewerRole("super_admin")).toBe(true);
    expect(isDocumentAiReviewerRole("admin")).toBe(true);
    expect(isDocumentAiReviewerRole("platform_admin")).toBe(true);
    expect(isDocumentAiReviewerRole("internal_reviewer")).toBe(true);
  });

  it("denies company and manager roles", () => {
    expect(isDocumentAiReviewerRole("manager")).toBe(false);
    expect(isDocumentAiReviewerRole("company_admin")).toBe(false);
    expect(isDocumentAiReviewerRole("company_user")).toBe(false);
  });
});
