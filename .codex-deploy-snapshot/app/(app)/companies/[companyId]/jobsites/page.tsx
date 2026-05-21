import { CompanySurfaceClient } from "../_components/company-surface-client";

export default async function CompanyJobsitesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return (
    <CompanySurfaceClient
      companyId={companyId}
      surface="jobsites"
      title="Company Jobsites"
      description="Scoped jobsites payload for this company."
    />
  );
}
