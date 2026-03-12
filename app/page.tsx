const PRIMARY_CARDS = [
  {
    title: "PESHEP",
    subtitle: "Project Environmental, Safety & Health Execution Plan",
    colorClass: "bg-blue-600",
    borderClass: "border-blue-600/25",
    links: [
      "Start New PESHEP",
      "Continue Saved Draft",
      "Export DOCX / PDF",
      "Template Library",
    ],
    hrefs: ["/peshep", "/peshep", "/peshep", "/library"],
  },

  {
    title: "CSEP",
    subtitle: "Contractor Safety Execution Plan",
    colorClass: "bg-orange-600",
    borderClass: "border-orange-600/25",
    links: [
      "Start New CSEP",
      "Continue Saved Draft",
      "Export DOCX / PDF",
      "Approved Wording",
    ],
    hrefs: ["/csep", "/csep", "/csep", "/admin"],
  },

  {
    title: "DOCUMENT LIBRARY",
    subtitle: "Upload, tag, search, and distribute controlled files",
    colorClass: "bg-red-600",
    borderClass: "border-red-600/25",
    links: [
      "Browse Library",
      "Upload Documents",
      "Search by Tags",
      "Download History",
    ],
    hrefs: ["/library", "/upload", "/search", "/library"],
  },

  {
    title: "ADMIN & USERS",
    subtitle: "Roles, access, templates, and subscriptions",
    colorClass: "bg-green-600",
    borderClass: "border-green-600/25",
    links: [
      "Admin Dashboard",
      "User Management",
      "Template Controls",
      "Subscription Status",
    ],
    hrefs: ["/admin", "/admin", "/admin", "/admin"],
  },
];
const SECONDARY_BANDS = [
  { title: "POLICIES", items: ["Safety Manual", "Site Rules", "PPE Requirements"], href: "/(app)/library" },
  { title: "FORMS", items: ["Permits", "Inspections", "Sign-in Sheets"], href: "/(app)/library" },
  // ✅ TRAINING REMOVED
  { title: "OTHER", items: ["Templates", "Company Docs", "Archived"], href: "/(app)/library" },
];

function PrimaryCard(props: (typeof PRIMARY_CARDS)[number]) {
  const { title, subtitle, colorClass, borderClass, links, hrefs } = props;

return (
  <div
    className={`flex h-full flex-col overflow-hidden rounded-2xl border ${borderClass} bg-white shadow-sm`}
  >
    <div className={`${colorClass} px-6 py-5`}>
      <div className="text-lg font-black tracking-tight text-white">
        {title}
      </div>
      <div className="mt-1 text-sm font-semibold text-white/90">
        {subtitle}
      </div>
    </div>

    <div className="flex flex-1 flex-col px-6 py-5">
      <div className="space-y-2">
        {links.map((t, i) => (
          <a
            key={t}
            href={hrefs[i] ?? "/"}
            className="block text-sm font-semibold text-black/80 hover:text-black"
          >
            {t} <span className="text-black/40">›</span>
          </a>
        ))}
      </div>
    </div>

    <div className="h-1 w-full bg-black/5" />
  </div>
);
}

function SecondaryCard({
  title,
  items,
  href,
}: (typeof SECONDARY_BANDS)[number]) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="rounded-t-2xl bg-purple-700 px-5 py-4">
        <div className="text-center text-sm font-black tracking-wide text-white">{title}</div>
      </div>

      <div className="flex flex-1 flex-col px-5 py-4">
        <div className="space-y-2">
          {items.map((it) => (
            <a
              key={it}
              href={href}
              className="block text-sm font-semibold text-black/80 hover:text-black"
            >
              {it} <span className="text-black/40">›</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-black">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/15 bg-white font-black">
              SD
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">SafetyDocs</div>
              <div className="text-xs font-semibold text-black/60">
                PESHEP • CSEP • Document Library
              </div>
            </div>
          </div>

<nav className="hidden items-center gap-6 md:flex">
  <a href="/library" className="text-sm font-bold text-black/70 hover:text-black">
    Library
  </a>

  <a href="/peshep" className="text-sm font-bold text-black/70 hover:text-black">
    PESHEP
  </a>

  <a href="/csep" className="text-sm font-bold text-black/70 hover:text-black">
    CSEP
  </a>
</nav>

        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-black/10">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl border border-black/10 bg-blue-600 px-7 py-10 shadow-sm md:px-10">
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              Safety Documentation Made Easy
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-white/90 md:text-base">
              Generate PESHEPs and CSEPs, manage a controlled document library, and gate access by user role
              + subscription.
            </p>

<div className="mt-6 flex flex-wrap gap-3">
  <a
    href="/library"
    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/30 bg-transparent px-5 text-sm font-extrabold leading-none text-white hover:bg-white/10 whitespace-nowrap"
  >
    Browse Library
  </a>
</div>
          </div>

          {/* PRIMARY GRID */}
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PRIMARY_CARDS.map((c) => (
              <PrimaryCard key={c.title} {...c} />
            ))}
          </div>
        </div>
      </section>

      {/* SECONDARY GRID (3 cards now) */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="text-center">
            <div className="text-sm font-extrabold tracking-wider text-purple-700">
              LOOKING FOR OTHER DOCUMENT TYPES?
            </div>
            <div className="mx-auto mt-3 h-1 w-40 rounded-full bg-purple-700/80" />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {SECONDARY_BANDS.map((b) => (
              <SecondaryCard key={b.title} {...b} />
            ))}
          </div>

          <footer className="mt-12 border-t border-black/10 pt-8 text-center text-sm font-semibold text-black/60">
            © {new Date().getFullYear()} SafetyDocs • Controlled Documents • Role-Based Access
          </footer>
        </div>
      </section>
    </main>
  );
}