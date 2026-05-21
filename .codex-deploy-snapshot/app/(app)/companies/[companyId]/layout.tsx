import { WorkspaceScopedNav } from "@/components/WorkspacePrimitives";

export default async function CompanyScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const base = `/companies/${encodeURIComponent(companyId)}`;
  const tabs = [
    { href: `${base}/overview`, label: "Overview" },
    { href: `${base}/users`, label: "Users" },
    { href: `${base}/jobsites`, label: "Jobsites" },
    { href: `${base}/documents`, label: "Documents" },
    { href: `${base}/analytics`, label: "Analytics" },
  ];

  return (
    <div className="space-y-4">
      <WorkspaceScopedNav
        eyebrow="Company Workspace"
        title={`Company ${companyId}`}
        tabs={tabs}
      />
      {children}
    </div>
  );
}
