export type MobileFeature =
  | "mobile_dashboard"
  | "mobile_jsa"
  | "mobile_field_issues"
  | "mobile_field_audits"
  | "mobile_photos"
  | "mobile_signatures";

export type Jobsite = {
  id: string;
  name: string;
  status?: string | null;
  customer_company_name?: string | null;
};

export type MobileCompany = {
  id: string;
  name: string;
  jobsites: Jobsite[];
};

export type AuditCustomer = {
  id: string;
  name: string;
  report_email?: string | null;
};

export type AuditLocation = {
  id: string;
  name: string;
  status?: string | null;
  audit_customer_id: string;
  report_email?: string | null;
};

export type MobileMe = {
  user: {
    id: string;
    email: string;
    role: string;
    team: string;
    companyId: string | null;
    companyName: string;
  };
  features: MobileFeature[];
  featureMap: Record<MobileFeature, boolean>;
  jobsites: Jobsite[];
  auditCustomers?: AuditCustomer[];
  auditLocations?: AuditLocation[];
  mobileCompanies?: MobileCompany[];
  dashboard: {
    openIssues: number;
    activeJsas: number;
    recentAudits: number;
    assignedJobsites: number;
    pendingAuditReviews?: number;
    lastSyncAt?: string;
    recentActivity?: Array<{
      id: string;
      label: string;
      detail: string;
      createdAt: string | null;
      tone: "neutral" | "warning" | "success";
    }>;
  };
};

export type ApiList<T> = {
  [key: string]: T[] | unknown;
};
