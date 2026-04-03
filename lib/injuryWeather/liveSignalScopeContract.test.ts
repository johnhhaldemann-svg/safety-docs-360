import { describe, expect, it } from "vitest";
import { injuryWeatherScopeNote } from "./scopeMessaging";

/**
 * Documents expected behavior of `fetchLiveSignals` in service.ts when both `companyId` and `jobsiteId` are set:
 * - `company_sor_records`: filtered by `company_id` only (table has no jobsite column).
 * - `company_corrective_actions` and `company_incidents`: filtered by `company_id` and `jobsite_id`.
 *
 * If this contract changes, update `injuryWeatherScopeNote` and superadmin UI copy together.
 */
describe("fetchLiveSignals jobsite scope contract", () => {
  it("provenance note matches CAPA/incident jobsite filter vs company-wide SOR", () => {
    const note = injuryWeatherScopeNote("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002");
    expect(note).toContain("corrective actions limited to the selected jobsite");
    expect(note).toContain("SOR observations remain company-wide");
  });
});
