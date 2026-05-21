import { describe, expect, it } from "vitest";
import { prepareSafetyIntake } from "@/lib/safety-intelligence/ingestion/validate";

describe("prepareSafetyIntake", () => {
  it("normalizes, redacts, and accepts a valid payload", () => {
    const prepared = prepareSafetyIntake({
      body: {
        sourceType: "incident",
        payload: {
          title: "Forklift contact near Acme Industrial LLC trailer",
          description: "Employee observed Acme Industrial LLC staging material next to the travel lane.",
          company_name: "Acme Industrial LLC",
          severity: "Severe",
          trade: "Mechanical Startup",
          category: "Line of Fire",
          event_date: "2026-04-14",
          created_at: "2026-04-14T10:15:00-05:00",
        },
      },
      companyId: "company-1",
      companyName: "Acme Industrial LLC",
    });

    expect(prepared.validationStatus).toBe("accepted");
    expect(prepared.normalizedRecord?.sourceType).toBe("incident_report");
    expect(prepared.normalizedRecord?.severity).toBe("critical");
    expect(prepared.normalizedRecord?.trade).toBe("mechanical_startup");
    expect(prepared.normalizedRecord?.category).toBe("line_of_fire");
    expect(prepared.sanitizedPayload.company_name).toBeNull();
    expect(String(prepared.sanitizedPayload.description)).toContain("[REDACTED_COMPANY]");
    expect(prepared.removedCompanyTokens.length).toBeGreaterThan(0);
  });

  it("rejects payloads without a usable date", () => {
    const prepared = prepareSafetyIntake({
      body: {
        sourceType: "permit",
        payload: {
          title: "Hot work permit request",
          severity: "high",
          permit_type: "Hot Work",
        },
      },
      companyId: "company-1",
      companyName: "Acme Industrial LLC",
    });

    expect(prepared.validationStatus).toBe("rejected");
    expect(prepared.normalizedRecord).toBeNull();
    expect(prepared.validationErrors.some((error) => error.code === "missing_date")).toBe(true);
  });
});
