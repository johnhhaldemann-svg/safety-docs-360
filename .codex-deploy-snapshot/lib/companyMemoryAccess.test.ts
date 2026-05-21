import { describe, expect, it } from "vitest";
import {
  canAccessCompanyMemoryAssist,
  canMutateCompanyMemory,
} from "@/lib/companyMemoryAccess";

describe("companyMemoryAccess", () => {
  it("allows company roles to use assist", () => {
    expect(canAccessCompanyMemoryAssist("company_admin")).toBe(true);
    expect(canAccessCompanyMemoryAssist("company_user")).toBe(true);
    expect(canAccessCompanyMemoryAssist("read_only")).toBe(true);
    expect(canAccessCompanyMemoryAssist("viewer")).toBe(false);
  });

  it("restricts memory bank curation to leads", () => {
    expect(canMutateCompanyMemory("company_admin")).toBe(true);
    expect(canMutateCompanyMemory("manager")).toBe(true);
    expect(canMutateCompanyMemory("safety_manager")).toBe(true);
    expect(canMutateCompanyMemory("company_user")).toBe(false);
    expect(canMutateCompanyMemory("read_only")).toBe(false);
  });
});
