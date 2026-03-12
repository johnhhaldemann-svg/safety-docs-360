const QuickActions = [
  {
    title: "Create PESHEP",
    desc: "Start a new Project/ Site Specific plan",
    href: "/(app)/peshep",
    badge: "Generator",
  },
  {
    title: "Create CSEP",
    desc: "Start a new Contractor Safety Execution Plan",
    href: "/(app)/csep",
    badge: "Generator",
  },
  {
    title: "Upload Document",
    desc: "Add a controlled file to the library",
    href: "/(app)/library",
    badge: "Library",
  },
  {
    title: "Admin & Users",
    desc: "Manage roles, access, and subscriptions",
    href: "/(app)/admin",
    badge: "Admin",
  },
];

const Stats = [
  { label: "Drafts", value: "—", sub: "Saved plans" },
  { label: "Library Files", value: "—", sub: "Controlled docs" },
  { label: "Downloads", value: "—", sub: "Last 30 days" },
  { label: "Active Users", value: "—", sub: "This workspace" },
];

const RecentPlans = [
  { name: "PESHEP – Project Alpha", type: "PESHEP", updated: "Just now", href: "/(app)/peshep" },
  { name: "CSEP – Contractor Setup", type: "CSEP", updated: "Today", href: "/(app)/csep" },
  { name: "PESHEP – Warehouse Expansion", type: "PESHEP", updated: "Yesterday", href: "/(app)/peshep" },
];

const RecentDocs = [
  { name: "Site Rules.pdf", tag: "Policy", updated: "Today", href: "/(app)/library" },
  { name: "Hot Work Permit.docx", tag: "Form", updated: "This week", href: "/(app)/library" },
  { name: "Orientation Checklist.pdf", tag: "Training", updated: "This week", href: "/(app)/library" },
];

function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-black/10 bg-white px-3 text-xs font-extrabold text-black/70">
      {text}
    </span>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-black tracking-tight">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function PortalDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-2xl font-black tracking-tight">Dashboard</div>
            <div className="mt-1 text-sm font-semibold text-black/60">
              Quick access to generators, controlled documents, and admin controls.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/(app)/peshep"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black bg-black px-4 text-sm font-extrabold text-white hover:bg-black/90 whitespace-nowrap"
            >
              New PESHEP
            </a>
            <a
              href="/(app)/csep"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5 whitespace-nowrap"
            >
              New CSEP
            </a>
            <a
              href="/(app)/library"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5 whitespace-nowrap"
            >
              Open Library
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {Stats.map((s) => (
          <div key={s.label} className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="text-xs font-black tracking-wider text-black/50">{s.label}</div>
            <div className="mt-2 text-3xl font-black">{s.value}</div>
            <div className="mt-1 text-sm font-semibold text-black/60">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <Card
        title="Quick Actions"
        right={
          <a
            href="/"
            className="text-sm font-extrabold text-black/60 hover:text-black"
          >
            View public home →
          </a>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {QuickActions.map((a) => (
            <a
              key={a.title}
              href={a.href}
              className="group rounded-2xl border border-black/10 bg-white p-5 hover:bg-black/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black">{a.title}</div>
                  <div className="mt-1 text-sm font-semibold text-black/60">{a.desc}</div>
                </div>
                <span className="text-black/40 group-hover:text-black">→</span>
              </div>
              <div className="mt-4">
                <Pill text={a.badge} />
              </div>
            </a>
          ))}
        </div>
      </Card>

      {/* Two-column: recent plans + recent docs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recent Plans"
          right={
            <a href="/(app)/peshep" className="text-sm font-extrabold text-black/60 hover:text-black">
              Go to PESHEP →
            </a>
          }
        >
          <div className="space-y-3">
            {RecentPlans.map((p) => (
              <a
                key={p.name}
                href={p.href}
                className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3 hover:bg-black/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{p.name}</div>
                  <div className="mt-1 text-xs font-semibold text-black/60">
                    {p.type} • Updated {p.updated}
                  </div>
                </div>
                <span className="text-black/40">›</span>
              </a>
            ))}

            <div className="pt-2">
              <a
                href="/(app)/peshep"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5 whitespace-nowrap"
              >
                Open Generator
              </a>
            </div>
          </div>
        </Card>

        <Card
          title="Recent Library Files"
          right={
            <a href="/(app)/library" className="text-sm font-extrabold text-black/60 hover:text-black">
              Browse Library →
            </a>
          }
        >
          <div className="space-y-3">
            {RecentDocs.map((d) => (
              <a
                key={d.name}
                href={d.href}
                className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3 hover:bg-black/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{d.name}</div>
                  <div className="mt-1 text-xs font-semibold text-black/60">
                    {d.tag} • Updated {d.updated}
                  </div>
                </div>
                <span className="text-black/40">›</span>
              </a>
            ))}

            <div className="pt-2 flex gap-2">
              <a
                href="/(app)/library"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5 whitespace-nowrap"
              >
                Upload / Manage
              </a>
              <a
                href="/(app)/library"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-black bg-black px-4 text-sm font-extrabold text-white hover:bg-black/90 whitespace-nowrap"
              >
                Search
              </a>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer note */}
      <div className="text-center text-sm font-semibold text-black/50">
        Controlled documents • Role-based access • Subscription gated
      </div>
    </div>
  );
}