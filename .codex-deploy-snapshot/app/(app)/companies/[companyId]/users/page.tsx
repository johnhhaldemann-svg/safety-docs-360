import { CompanySurfaceClient } from "../_components/company-surface-client";

export default async function CompanyUsersPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return (
    <CompanySurfaceClient
      companyId={companyId}
      surface="users"
      title="Company Users"
      description="Scoped users payload for this company."
    />
  );
}
