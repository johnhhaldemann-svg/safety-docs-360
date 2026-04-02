import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CSEP_PLAN_NAME,
  csepOnlyCompanySideSections,
  getCsepNavSectionsForRole,
  normalizeApprovalPlanName,
  planNameToWorkspaceProduct,
} from "./workspaceProduct";
import { resolveHrefToPageFile } from "./internalLinkResolve";

const REPO_ROOT = join(import.meta.dirname, "..");

describe("workspaceProduct", () => {
  it("planNameToWorkspaceProduct treats exact CSEP plan as csep tier", () => {
    expect(planNameToWorkspaceProduct(CSEP_PLAN_NAME)).toBe("csep");
    expect(planNameToWorkspaceProduct("csep")).toBe("full");
    expect(planNameToWorkspaceProduct(null)).toBe("full");
    expect(planNameToWorkspaceProduct("Pro")).toBe("full");
  });

  it("normalizeApprovalPlanName defaults to Pro and preserves CSEP", () => {
    expect(normalizeApprovalPlanName(null)).toBe("Pro");
    expect(normalizeApprovalPlanName("")).toBe("Pro");
    expect(normalizeApprovalPlanName("Enterprise")).toBe("Enterprise");
    expect(normalizeApprovalPlanName(CSEP_PLAN_NAME)).toBe(CSEP_PLAN_NAME);
  });

  it("getCsepNavSectionsForRole omits CSEP builder for read_only", () => {
    const readOnly = getCsepNavSectionsForRole("read_only");
    const flat = readOnly.flatMap((s) => s.items.map((i) => i.href));
    expect(flat).not.toContain("/csep");
    expect(flat).toContain("/dashboard");
    expect(flat).toContain("/library");
  });

  it("CSEP-only nav hrefs resolve to real pages", () => {
    for (const section of csepOnlyCompanySideSections) {
      for (const item of section.items) {
        expect(resolveHrefToPageFile(REPO_ROOT, item.href), item.href).toBeTruthy();
      }
    }
  });
});
