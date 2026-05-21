import { CompanySurfaceClient } from "../_components/company-surface-client";

export default async function CompanyDocumentsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return (
    <CompanySurfaceClient
      companyId={companyId}
      surface="documents"
      title="Company Documents"
      description="Scoped document payload for this company."
    />
  );
}
