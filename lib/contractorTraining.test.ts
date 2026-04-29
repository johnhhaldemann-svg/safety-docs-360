import { describe, expect, it } from "vitest";
import {
  contractorTrainingStatus,
  generateIntakeToken,
  hashIntakeToken,
  normalizeEmail,
  normalizePhone,
  normalizeSmsPhoneNumber,
  parseExpirationMap,
} from "./contractorTraining";

describe("contractor training helpers", () => {
  it("normalizes email and phone for reusable contractor employee matching", () => {
    expect(normalizeEmail("  WORKER@Example.COM ")).toBe("worker@example.com");
    expect(normalizePhone("(555) 123-9876")).toBe("5551239876");
  });

  it("formats phone invites for SMS delivery", () => {
    expect(normalizeSmsPhoneNumber("(555) 123-9876")).toBe("+15551239876");
    expect(normalizeSmsPhoneNumber("1-555-123-9876")).toBe("+15551239876");
    expect(normalizeSmsPhoneNumber("+44 20 7123 4567")).toBe("+442071234567");
    expect(normalizeSmsPhoneNumber("12345")).toBeNull();
  });

  it("hashes intake tokens without storing the raw token", () => {
    const token = generateIntakeToken();
    expect(token).toHaveLength(43);
    expect(hashIntakeToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashIntakeToken(token)).not.toBe(token);
  });

  it("parses only valid certification expiration dates", () => {
    expect(
      parseExpirationMap({
        " OSHA 10 ": "2027-04-01",
        "Bad date": "tomorrow",
        "": "2027-01-01",
      })
    ).toEqual({ "OSHA 10": "2027-04-01" });
  });

  it("classifies contractor training matrix status", () => {
    const asOf = new Date("2026-04-28T12:00:00Z");
    expect(contractorTrainingStatus(null, asOf)).toBe("missing");
    expect(contractorTrainingStatus({ title: "Site Orientation", completed_on: "2026-04-01" }, asOf)).toBe("complete");
    expect(
      contractorTrainingStatus(
        { title: "First Aid", completed_on: "2026-01-01", expires_on: "2026-05-15" },
        asOf
      )
    ).toBe("expiring");
    expect(
      contractorTrainingStatus(
        { title: "First Aid", completed_on: "2025-01-01", expires_on: "2026-04-01" },
        asOf
      )
    ).toBe("expired");
  });
});
