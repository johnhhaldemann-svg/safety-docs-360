"use client";

import { Command, Search } from "lucide-react";
import type { NavItem } from "@/lib/appNavigation";
import { getWorkspaceNavItemMeta } from "@/lib/workspaceNavigationModel";
import { MobileMenuIcon } from "./shellIcons";
import type { KeyedNavSection } from "./AppShellSidebar";

type CurrentNav = {
  href: string;
  label: string;
  short: string;
};

type AppShellHeaderProps = {
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  showPlatformAdminShell: boolean;
  workspaceLabel: string;
  needsProfileSetup: boolean;
  needsCompanySetup: boolean;
  isCompanyScopedUser: boolean;
  currentNavSection: KeyedNavSection | undefined;
  currentNavItem: CurrentNav;
};

export function AppShellHeader({
  onOpenMobileMenu,
  onOpenCommandPalette,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  showPlatformAdminShell,
  workspaceLabel,
  needsProfileSetup,
  needsCompanySetup,
  isCompanyScopedUser,
  currentNavSection,
  currentNavItem,
}: AppShellHeaderProps) {
  const currentNavMeta = getWorkspaceNavItemMeta(currentNavItem as NavItem);
  return (
    <header className="border-b border-[var(--app-border)] bg-[rgba(248,251,255,0.88)] backdrop-blur">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 xl:px-8">
        <div className="flex flex-col gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="inline-flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white text-[var(--app-text)] shadow-sm lg:hidden"
            >
              <MobileMenuIcon />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex max-w-3xl flex-col gap-2 sm:flex-row">
                <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--app-border-strong)] bg-white/92 px-3 py-2.5 shadow-[0_10px_22px_rgba(76,108,161,0.06)]">
                    <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => onSearchQueryChange(event.target.value)}
                      placeholder="Search documents, records, projects, or pages"
                      aria-label="Search workspace"
                      className="w-full border-0 bg-transparent text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
                    />
                    <button type="submit" className="app-btn-primary inline-flex shrink-0 px-3 py-2 text-xs transition">
                      Search
                    </button>
                  </div>
                </form>
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-accent-primary)] shadow-[0_10px_20px_rgba(76,108,161,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-24)] hover:bg-white"
                >
                  <Command aria-hidden="true" className="h-4 w-4" />
                  Menu
                </button>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--app-muted)]">
                {showPlatformAdminShell ? workspaceLabel : currentNavSection?.title || workspaceLabel}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-3xl">
                    {currentNavItem.label}
                  </h1>
                  <p className="mt-1 text-sm text-[var(--app-text)]">
                    {showPlatformAdminShell
                      ? "Administrative tools and audit controls"
                      : needsProfileSetup
                        ? "Complete your construction profile before opening company setup or workspace tools"
                        : needsCompanySetup
                          ? "Create your company workspace before inviting employees or opening company tools"
                          : isCompanyScopedUser
                            ? currentNavMeta.description
                            : "Safety document workspace and active project tools"}
                  </p>
                </div>
              </div>
              <p className="mt-2 max-w-3xl text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--app-muted)] sm:text-sm">
                Enterprise Safety Management Platform
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
