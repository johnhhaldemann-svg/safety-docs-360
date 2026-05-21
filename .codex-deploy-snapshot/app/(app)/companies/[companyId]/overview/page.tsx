import { CompanySurfaceClient } from "../_components/company-surface-client";

export default async function CompanyOverviewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return (
    <CompanySurfaceClient
      companyId={companyId}
      surface="overview"
      title="Company Overview"
      description="Context-aware company summary scoped by companyId."
    />
  );
}
