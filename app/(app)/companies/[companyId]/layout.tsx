import Link from "next/link";

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
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Company Workspace
        </div>
        <div className="mt-2 text-xl font-black text-slate-900">
          Company {companyId}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
