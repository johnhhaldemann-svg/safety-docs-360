import { describe, expect, it } from "vitest";
import {
  buildTrackedEmployeeMatrixProfile,
  normalizeDateOnly,
} from "@/lib/companyTrackedEmployees";

describe("company tracked employees", () => {
  it("combines roster certifications with tracked training records for matrix matching", () => {
    const profile = buildTrackedEmployeeMatrixProfile(
      {
        certifications: ["First Aid / CPR"],
        certification_expirations: { "First Aid / CPR": "2026-11-15" },
        job_title: "Foreman",
        trade_specialty: "Structural Steel and Erection",
      },
      [
        {
          title: "OSHA 10 Construction",
          expires_on: "2027-08-12",
        },
      ]
    );

    expect(profile.certifications).toEqual(["First Aid / CPR", "OSHA 10 Construction"]);
    expect(profile.certificationExpirations).toMatchObject({
      "First Aid / CPR": "2026-11-15",
      "OSHA 10 Construction": "2027-08-12",
    });
  });

  it("normalizes common import date formats", () => {
    expect(normalizeDateOnly("05/17/2026")).toBe("2026-05-17");
    expect(normalizeDateOnly("2026-05-17")).toBe("2026-05-17");
    expect(normalizeDateOnly("not a date")).toBeNull();
  });
});
