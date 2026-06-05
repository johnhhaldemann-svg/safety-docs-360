"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import {
  commandCenterNav,
  findActiveCommandCenterItem,
  type CommandCenterNavItem,
} from "@/lib/superadmin/commandCenterNav";
import { useCommandCenterData } from "@/components/superadmin/CommandCenterDataProvider";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Defer the first tick (and subsequent ones) out of the effect body to avoid a
    // synchronous setState, and to keep SSR/hydration output stable until mount.
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  return now;
}

function NavBadge({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500/90 px-1.5 text-[10px] font-bold text-slate-950">
      {value}
    </span>
  );
}

function SidebarLink({
  item,
  active,
  badgeValue,
  onNavigate,
}: {
  item: CommandCenterNavItem;
  active: boolean;
  badgeValue: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition",
        active
          ? "bg-cyan-400/10 text-cyan-300 shadow-[inset_2px_0_0_0_var(--sa-accent)]"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
      )}
    >
      <Icon
        className={cx("h-[18px] w-[18px] shrink-0", active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300")}
        strokeWidth={2}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
      <NavBadge value={badgeValue} />
    </Link>
  );
}

export function SuperadminCommandShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useCommandCenterData();
  const now = useLiveClock();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = findActiveCommandCenterItem(pathname);
  const pageTitle = activeItem?.label ?? "Command Center";

  const badgeFor = (item: CommandCenterNavItem): number => {
    if (!item.badge || !data) return 0;
    return data[item.badge] ?? 0;
  };

  const orgCount = data?.totalOrganizations;
  const unseen = data?.unseenTickets ?? 0;

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      {commandCenterNav.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={activeItem?.href === item.href}
                badgeValue={badgeFor(item)}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-auto border-t border-white/5 pt-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
          Exit console
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="sa-cc min-h-screen text-slate-200">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-[var(--sa-rail)] lg:block">
          <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-black tracking-[0.14em] text-cyan-300">
                SAFEPREDICT
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Platform Console v2.4
              </span>
            </span>
          </div>
          <div className="px-5 pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fuchsia-300">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.5} aria-hidden /> Super Admin
            </span>
          </div>
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-950/70"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 border-r border-white/5 bg-[var(--sa-rail)]">
              <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
                <span className="text-[13px] font-black tracking-[0.14em] text-cyan-300">
                  SAFEPREDICT
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="text-slate-400 hover:text-slate-100"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        ) : null}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/5 bg-[var(--sa-rail)]/85 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="text-slate-400 hover:text-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-white">
                {pageTitle}
              </h1>
              <p className="truncate text-[11px] text-slate-500">
                {now
                  ? now.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }) +
                    " · " +
                    now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                  : "All Organizations"}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200 sm:inline-flex"
              >
                <span className="text-slate-500">ORG</span>
                All Tenants{orgCount != null ? ` (${orgCount})` : ""}
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              </button>
              <Link
                href="/superadmin/help-tickets"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
                aria-label={`Escalations${unseen ? ` (${unseen} unseen)` : ""}`}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {unseen > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {unseen}
                  </span>
                ) : null}
              </Link>
            </div>
          </header>

          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 sm:py-7">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
