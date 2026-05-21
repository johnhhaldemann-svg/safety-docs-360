import { describe, expect, it } from "vitest";
import {
  templateCsvFor,
  normalizeRowsArray,
  validateEmployeeImportRows,
  validateJobsiteImportRows,
  validateTrainingRecordImportRows,
} from "@/lib/companyOnboardingImport";

describe("company onboarding import helpers", () => {
  it("normalizes valid employee rows and certification expiration metadata", () => {
    const result = validateEmployeeImportRows([
      {
        employee_id: "E-1001",
        full_name: " Jordan Lee ",
        email: "JORDAN@example.com",
        years_experience: "12",
        certifications: "OSHA 10 Construction; First Aid / CPR",
        certification_expirations:
          "OSHA 10 Construction:2027-08-12; First Aid / CPR:11/15/2026",
      },
    ]);

    expect(result.rowErrors).toEqual([]);
    expect(result.validRows[0]).toMatchObject({
      externalEmployeeId: "E-1001",
      fullName: "Jordan Lee",
      email: "jordan@example.com",
      yearsExperience: 12,
      certifications: ["OSHA 10 Construction", "First Aid / CPR"],
      certificationExpirations: {
        "OSHA 10 Construction": "2027-08-12",
        "First Aid / CPR": "2026-11-15",
      },
    });
  });

  it("accepts common roster headers with split employee names", () => {
    const result = validateEmployeeImportRows(
      normalizeRowsArray([
        {
          "Employee Number": "B-42",
          "First Name": "Sam",
          "Last Name": "Rivera",
          Position: "Journeyman",
          Craft: "Electrical",
        },
      ])
    );

    expect(result.rowErrors).toEqual([]);
    expect(result.validRows[0]).toMatchObject({
      externalEmployeeId: "B-42",
      fullName: "Sam Rivera",
      jobTitle: "Journeyman",
      tradeSpecialty: "Electrical",
    });
  });

  it("skips invalid employee rows with row-level errors", () => {
    const result = validateEmployeeImportRows([
      { full_name: "", email: "bad-email" },
      { full_name: "Valid Person", years_experience: "100" },
    ]);

    expect(result.validRows).toHaveLength(0);
    expect(result.rowErrors.map((error) => error.rowNumber)).toEqual([2, 3]);
  });

  it("validates jobsites and training rows independently", () => {
    const jobsites = validateJobsiteImportRows([
      {
        name: "North Tower",
        jobsite_number: "SITE-0001",
        start_date: "2026-06-01",
        end_date: "2026-12-15",
      },
    ]);
    const training = validateTrainingRecordImportRows([
      {
        employee_id: "E-1001",
        requirement_title: "OSHA 10",
        training_title: "OSHA 10 Construction",
        completed_on: "2025-08-12",
        expires_on: "2027-08-12",
      },
    ]);

    expect(jobsites.rowErrors).toEqual([]);
    expect(jobsites.validRows[0].status).toBe("active");
    expect(training.rowErrors).toEqual([]);
    expect(training.validRows[0].trainingTitle).toBe("OSHA 10 Construction");
  });

  it("generates the documented CSV template headers", () => {
    expect(templateCsvFor("employees").split("\n")[0]).toBe(
      "employee_id,full_name,email,phone,job_title,trade_specialty,readiness_status,years_experience,status,jobsite_names,certifications,certification_expirations"
    );
  });

  it("normalizes Stage 1 workforce profile fields for tracked workers", () => {
    const result = validateEmployeeImportRows([
      {
        full_name: "Mark Smith",
        worker_type: "Contractor",
        company_name: "ABC Electrical",
        department_name: "Electrical",
        responsible_sponsor_id: "11111111-1111-1111-1111-111111111111",
        access_status: "pending review",
        access_start_date: "2026-06-01",
        access_end_date: "2026-08-31",
        restrictions: "No hot work; Escort required",
      },
    ]);

    expect(result.rowErrors).toEqual([]);
    expect(result.validRows[0]).toMatchObject({
      workerType: "Contractor",
      companyName: "ABC Electrical",
      departmentName: "Electrical",
      responsibleSponsorId: "11111111-1111-1111-1111-111111111111",
      accessStatus: "pending_review",
      accessStartDate: "2026-06-01",
      accessEndDate: "2026-08-31",
      restrictions: ["No hot work", "Escort required"],
    });
  });

  it("rejects access windows where the end date is before the start date", () => {
    const result = validateEmployeeImportRows([
      {
        full_name: "Ari Permit",
        access_start_date: "2026-08-31",
        access_end_date: "2026-06-01",
      },
    ]);

    expect(result.validRows).toEqual([]);
    expect(result.rowErrors[0]).toMatchObject({
      field: "access_end_date",
      message: "Access end date must be after access start date.",
    });
  });
});
