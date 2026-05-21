import { describe, expect, it } from "vitest";
import { canRequestWorkspaceDocumentExcerpt } from "@/lib/workspaceDocumentAccess";

const lower = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const upper = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

describe("canRequestWorkspaceDocumentExcerpt", () => {
  it("matches company_id case-insensitively for company workspace users", () => {
    const ok = canRequestWorkspaceDocumentExcerpt(
      {
        id: "doc-1",
        status: "approved",
        final_file_path: "x.pdf",
        user_id: "other-user",
        company_id: upper,
      },
      {
        role: "company_user",
        userId: "viewer",
        companyScopeCompanyId: lower,
        purchasedDocumentIds: [],
      }
    );
    expect(ok).toBe(true);
  });

  it("matches purchased document id case-insensitively", () => {
    const ok = canRequestWorkspaceDocumentExcerpt(
      {
        id: upper,
        status: "approved",
        final_file_path: "x.pdf",
        user_id: "other",
        company_id: null,
      },
      {
        role: "company_user",
        userId: "viewer",
        companyScopeCompanyId: lower,
        purchasedDocumentIds: [lower],
      }
    );
    expect(ok).toBe(true);
  });
});
