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
      <div className="rounded-2xl border border-[var(--app-border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,249,255,0.96)_100%)] p-4 shadow-[var(--app-shadow-soft)]">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
          Company Workspace
        </div>
        <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--app-text-strong)]">
          Company {companyId}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-lg border border-[var(--app-border)] bg-white/90 px-3 py-1.5 text-sm font-semibold text-[var(--app-text)] shadow-sm transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-accent-primary-soft)]"
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
