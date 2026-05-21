import { CompanySurfaceClient } from "../_components/company-surface-client";

export default async function CompanyAnalyticsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return (
    <CompanySurfaceClient
      companyId={companyId}
      surface="analytics"
      title="Company Analytics"
      description="Scoped analytics payload for this company."
    />
  );
}
