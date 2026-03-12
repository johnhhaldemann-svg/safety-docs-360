export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-black">
      {/* Top Navigation */}
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/15 bg-white font-black">
              SD
            </div>

            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">
                SafetyDocs
              </div>
              <div className="text-xs font-semibold text-black/60">
                PESHEP • CSEP • Document Library
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="/"
              className="text-sm font-bold text-black/70 hover:text-black"
            >
              Home
            </a>

            <a
              href="/library"
              className="text-sm font-bold text-black/70 hover:text-black"
            >
              Library
            </a>

            <a
              href="/peshep"
              className="text-sm font-bold text-black/70 hover:text-black"
            >
              PESHEP
            </a>

            <a
              href="/csep"
              className="text-sm font-bold text-black/70 hover:text-black"
            >
              CSEP
            </a>
          </nav>

        </div>
      </header>

      {/* Page Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}