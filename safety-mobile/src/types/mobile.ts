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
  mobileCompanies?: MobileCompany[];
  dashboard: {
    openIssues: number;
    activeJsas: number;
    recentAudits: number;
    assignedJobsites: number;
  };
};

export type ApiList<T> = {
  [key: string]: T[] | unknown;
};
