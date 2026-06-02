export type MobileFeature =
  | "mobile_dashboard"
  | "mobile_jobsites"
  | "mobile_jsa"
  | "mobile_field_issues"
  | "mobile_field_audits"
  | "mobile_permits"
  | "mobile_incidents"
  | "mobile_toolbox"
  | "mobile_training"
  | "mobile_documents"
  | "mobile_safety_intelligence"
  | "mobile_reports"
  | "mobile_photos"
  | "mobile_signatures";

export type Jobsite = {
  id: string;
  name: string;
  status?: string | null;
  audit_customer_id?: string | null;
  audit_customer_location_id?: string | null;
  customer_company_name?: string | null;
  customer_report_email?: string | null;
};

export type MobileCompany = {
  id: string;
  name: string;
  auditCustomerId?: string | null;
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
    draftPermits?: number;
    pendingIncidentReviews?: number;
    toolboxSessions?: number;
    trainingAttention?: number;
    publishedReports?: number;
    approvedDocuments?: number;
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

export type MobilePermit = {
  id: string;
  title?: string | null;
  permit_type?: string | null;
  status?: string | null;
  severity?: string | null;
  updated_at?: string | null;
  due_at?: string | null;
  dap_activity_id?: string | null;
};

export type MobileJsaActivity = {
  id: string;
  jsa_id?: string | null;
  jobsite_id?: string | null;
  work_date?: string | null;
  trade?: string | null;
  activity_name?: string | null;
  area?: string | null;
  permit_required?: boolean | null;
  permit_type?: string | null;
  planned_risk_level?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type ApiList<T> = {
  [key: string]: T[] | unknown;
};
