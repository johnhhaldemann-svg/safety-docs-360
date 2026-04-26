"use client";

import { ChevronRight, Command, Search } from "lucide-react";
import type { NavItem } from "@/lib/appNavigation";
import { getWorkspaceNavItemMeta } from "@/lib/workspaceNavigationModel";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";
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
  contextCompanyName?: string | null;
  workspaceProduct: WorkspaceProduct;
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
  contextCompanyName,
  workspaceProduct,
}: AppShellHeaderProps) {
  const currentNavMeta = getWorkspaceNavItemMeta(currentNavItem as NavItem);
  return (
    <header className="border-b border-[var(--app-border)] bg-[rgba(250,252,255,0.96)] backdrop-blur">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5 xl:px-8">
        <div className="flex flex-col gap-4 sm:gap-6">
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
              <div className="mb-3 flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-white/80 px-3 py-2 shadow-[0_6px_14px_rgba(44,58,86,0.04)] sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--app-muted)]">
                  <span className="truncate">{workspaceLabel}</span>
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentNavSection?.title || currentNavItem.short}</span>
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[var(--app-text-strong)]">{currentNavItem.short}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {showPlatformAdminShell ? (
                    <span className="inline-flex items-center rounded-md border border-[var(--app-accent-border-22)] bg-[var(--app-accent-primary-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-accent-primary)]">
                      Platform admin
                    </span>
                  ) : null}
                  {contextCompanyName ? (
                    <span className="inline-flex max-w-[min(100%,20rem)] items-center truncate rounded-md border border-[var(--app-border-strong)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-strong)]">
                      {contextCompanyName}
                    </span>
                  ) : null}
                  {!showPlatformAdminShell && isCompanyScopedUser ? (
                    <span className="inline-flex items-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      {workspaceProduct === "csep" ? "CSEP workspace" : "Company workspace"}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    Secure session
                  </span>
                </div>
              </div>
              <div className="mb-3 flex max-w-4xl flex-col gap-2 sm:mb-4 sm:flex-row">
                <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(44,58,86,0.06)] ring-1 ring-[rgba(26,39,68,0.03)]">
                    <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => onSearchQueryChange(event.target.value)}
                      placeholder="Search documents, records, projects, or pages"
                      aria-label="Search workspace"
                      className="w-full border-0 bg-transparent text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
                    />
                    <button
                      type="submit"
                      className="app-btn-primary inline-flex shrink-0 rounded-md border border-[var(--app-accent-border-22)] px-3.5 py-2 text-xs font-semibold tracking-[0.03em] transition"
                    >
                      Search
                    </button>
                  </div>
                </form>
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-accent-primary)] shadow-[0_8px_18px_rgba(44,58,86,0.04)] transition hover:border-[var(--app-accent-border-24)] hover:bg-white"
                >
                  <Command aria-hidden="true" className="h-4 w-4" />
                  Menu
                </button>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                {showPlatformAdminShell ? workspaceLabel : currentNavSection?.title || workspaceLabel}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 sm:mt-2">
                <div>
                  <h1 className="font-app-display text-2xl font-extrabold tracking-tight text-[var(--app-text-strong)] sm:text-3xl">
                    {currentNavItem.label}
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--app-text)]">
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
              <p className="mt-2 max-w-3xl text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] sm:text-sm">
                Enterprise Safety Management Platform
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
