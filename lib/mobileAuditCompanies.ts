export type MobileAuditJobsiteRow = {
  id: string;
  name: string;
  status?: string | null;
  audit_customer_id?: string | null;
  audit_customer_location_id?: string | null;
  customer_company_name?: string | null;
  customer_report_email?: string | null;
};

export type MobileAuditLocationRow = {
  id: string;
  name: string;
  status?: string | null;
  audit_customer_id: string;
  report_email?: string | null;
};

export type MobileAuditCustomerRow = {
  id: string;
  name: string;
  report_email?: string | null;
};

type MobileAuditCompany = {
  id: string;
  name: string;
  auditCustomerId: string | null;
  jobsites: MobileAuditJobsiteRow[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function addUniqueJobsite(group: MobileAuditCompany, jobsite: MobileAuditJobsiteRow) {
  if (group.jobsites.some((existing) => existing.id === jobsite.id && existing.audit_customer_location_id === jobsite.audit_customer_location_id)) return;
  group.jobsites.push(jobsite);
}

export function buildMobileAuditCompanies(params: {
  customers: MobileAuditCustomerRow[];
  locations: MobileAuditLocationRow[];
  jobsites: MobileAuditJobsiteRow[];
  companyName: string;
}) {
  const groups = new Map<string, MobileAuditCompany>();
  const workspaceName = clean(params.companyName) || "Company jobsites";
  const workspaceKey = "workspace-company";

  for (const customer of params.customers) {
    const name = clean(customer.name);
    if (!customer.id || !name) continue;
    groups.set(customer.id, {
      id: customer.id,
      name,
      auditCustomerId: customer.id,
      jobsites: [],
    });
  }

  for (const jobsite of params.jobsites) {
    const customerId = clean(jobsite.audit_customer_id);
    const customerName = clean(jobsite.customer_company_name);
    const key = customerId || customerName.toLowerCase() || workspaceKey;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: customerName || workspaceName,
        auditCustomerId: customerId || null,
        jobsites: [],
      });
    }
    addUniqueJobsite(groups.get(key)!, jobsite);
  }

  for (const location of params.locations) {
    const group = groups.get(location.audit_customer_id);
    if (!group) continue;
    if (group.jobsites.some((jobsite) => jobsite.audit_customer_location_id === location.id)) continue;
    addUniqueJobsite(group, {
      id: `audit-location-${location.id}`,
      name: location.name,
      status: location.status,
      audit_customer_id: location.audit_customer_id,
      audit_customer_location_id: location.id,
      customer_company_name: group.name,
      customer_report_email: location.report_email,
    });
  }

  if (groups.size === 0 && params.jobsites.length > 0) {
    groups.set(workspaceKey, {
      id: workspaceKey,
      name: workspaceName,
      auditCustomerId: null,
      jobsites: params.jobsites,
    });
  }

  return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
}
