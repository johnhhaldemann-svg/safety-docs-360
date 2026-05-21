import { describe, expect, it, vi } from "vitest";
import { insertTrainingRecordRows } from "@/lib/companyOnboardingPersistence";

describe("company onboarding persistence", () => {
  it("skips matching training records that already exist for the company", async () => {
    const insertTrainingRecord = vi.fn(async () => ({ error: null }));

    const db = {
      from: vi.fn((table: string) => {
        if (table === "company_employee_profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    id: "employee-1",
                    company_id: "company-1",
                    external_employee_id: "E-1001",
                    full_name: "Jordan Lee",
                    email: "jordan@example.com",
                    email_normalized: "jordan@example.com",
                  },
                ],
                error: null,
              })),
            })),
            insert: vi.fn(),
          };
        }

        if (table === "company_training_requirements") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    id: "requirement-1",
                    title: "OSHA 10 Construction",
                    match_keywords: ["OSHA 10"],
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === "company_employee_training_records") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  {
                    id: "record-1",
                    employee_id: "employee-1",
                    title: "OSHA 10 Construction",
                    completed_on: "2025-08-12",
                    expires_on: "2027-08-12",
                  },
                ],
                error: null,
              })),
            })),
            insert: insertTrainingRecord,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await insertTrainingRecordRows({
      db: db as never,
      companyId: "company-1",
      actorUserId: "user-1",
      rows: [
        {
          rowNumber: 2,
          externalEmployeeId: "E-1001",
          email: "jordan@example.com",
          fullName: "Jordan Lee",
          requirementTitle: "OSHA 10",
          trainingTitle: "OSHA 10 Construction",
          completedOn: "2025-08-12",
          expiresOn: "2027-08-12",
          provider: "ABC Safety",
          source: "manual_upload",
          notes: null,
        },
      ],
    });

    expect(result.acceptedCount).toBe(0);
    expect(result.error).toBeNull();
    expect(result.rowErrors).toEqual([
      {
        rowNumber: 2,
        entity: "training_records",
        message: "Matching training record already exists and was skipped.",
      },
    ]);
    expect(insertTrainingRecord).not.toHaveBeenCalled();
  });
});
