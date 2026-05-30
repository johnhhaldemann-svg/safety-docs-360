import { describe, expect, it } from "vitest";
import { buildMobileAuditCompanies } from "@/lib/mobileAuditCompanies";

describe("buildMobileAuditCompanies", () => {
  it("groups active company jobsites under audit customers and preserves jobsite ids for submit", () => {
    const companies = buildMobileAuditCompanies({
      companyName: "SafetyDocs Demo",
      customers: [{ id: "customer-1", name: "Summit Ridge Development" }],
      locations: [
        {
          id: "location-1",
          audit_customer_id: "customer-1",
          name: "Tower A",
          status: "active",
        },
      ],
      jobsites: [
        {
          id: "jobsite-1",
          audit_customer_id: "customer-1",
          name: "Tower A",
          status: "active",
          customer_company_name: "Summit Ridge Development",
        },
        {
          id: "jobsite-2",
          audit_customer_id: "customer-1",
          name: "Old Yard",
          status: "archived",
          customer_company_name: "Summit Ridge Development",
        },
      ],
    });

    expect(companies).toEqual([
      {
        id: "customer-1",
        name: "Summit Ridge Development",
        auditCustomerId: "customer-1",
        jobsites: [
          {
            id: "jobsite-1",
            audit_customer_id: "customer-1",
            audit_customer_location_id: "location-1",
            name: "Tower A",
            status: "active",
            customer_company_name: "Summit Ridge Development",
          },
        ],
      },
    ]);
  });

  it("keeps active unlinked jobsites available without pretending they are audit customers", () => {
    const companies = buildMobileAuditCompanies({
      companyName: "SafetyDocs Demo",
      customers: [],
      locations: [],
      jobsites: [
        {
          id: "jobsite-1",
          name: "Warehouse",
          status: "active",
          customer_company_name: "Standalone Customer",
        },
      ],
    });

    expect(companies).toEqual([
      {
        id: "unlinked:standalone customer",
        name: "Standalone Customer",
        auditCustomerId: null,
        jobsites: [
          {
            id: "jobsite-1",
            audit_customer_location_id: null,
            name: "Warehouse",
            status: "active",
            customer_company_name: "Standalone Customer",
          },
        ],
      },
    ]);
  });
});
