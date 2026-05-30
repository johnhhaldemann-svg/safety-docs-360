export type MobileAuditJobsiteRow = {
  id: string;
  name: string;
  status?: string | null;
  audit_customer_id?: string | null;
  customer_company_name?: string | null;
  customer_report_email?: string | null;
  audit_customer_location_id?: string | null;
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

export type MobileAuditCompany = {
  id: string;
  name: string;
  auditCustomerId?: string | null;
  jobsites: MobileAuditJobsiteRow[];
};

function normalizeKey(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function locationKey(customerId?: string | null, name?: string | null) {
  const normalizedCustomerId = String(customerId ?? "").trim();
  const normalizedName = normalizeKey(name);
  return normalizedCustomerId && normalizedName ? `${normalizedCustomerId}:${normalizedName}` : "";
}

export function buildMobileAuditCompanies(params: {
  customers: MobileAuditCustomerRow[];
  locations: MobileAuditLocationRow[];
  jobsites: MobileAuditJobsiteRow[];
  companyName?: string | null;
}) {
  const customersById = new Map(params.customers.map((customer) => [customer.id, customer]));
  const locationsByCustomerAndName = new Map(
    params.locations
      .map((location) => [locationKey(location.audit_customer_id, location.name), location] as const)
      .filter(([key]) => Boolean(key))
  );
  const groups = new Map<string, MobileAuditCompany>();

  for (const jobsite of params.jobsites) {
    if (String(jobsite.status ?? "").trim().toLowerCase() !== "active") continue;

    const auditCustomerId = jobsite.audit_customer_id?.trim() || null;
    const fallbackCustomerName = jobsite.customer_company_name?.trim() || params.companyName?.trim() || "Company Jobsites";
    const customer = auditCustomerId ? customersById.get(auditCustomerId) : null;
    const groupName = customer?.name?.trim() || fallbackCustomerName;
    const groupId = auditCustomerId || `unlinked:${normalizeKey(groupName) || "company-jobsites"}`;
    const matchingLocation = locationsByCustomerAndName.get(locationKey(auditCustomerId, jobsite.name));
    const existing = groups.get(groupId);

    if (!existing) {
      groups.set(groupId, {
        id: groupId,
        name: groupName,
        auditCustomerId,
        jobsites: [],
      });
    }

    groups.get(groupId)?.jobsites.push({
      ...jobsite,
      audit_customer_location_id: matchingLocation?.id ?? jobsite.audit_customer_location_id ?? null,
      customer_company_name: groupName,
    });
  }

  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
}
