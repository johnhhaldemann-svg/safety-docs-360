"use client";

import Image from "next/image";
import Link from "next/link";
import type { NavSection } from "@/lib/appNavigation";
import { isWorkspaceNavActive } from "@/lib/workspaceNavActive";
import { formatUserRoleLabel, getUserDisplayName } from "@/lib/userRoleDisplay";
import { getWorkspaceNavItemMeta } from "@/lib/workspaceNavigationModel";
import { ProfileAvatar, type ProfileSummary } from "./ProfileAvatar";
import { ChevronDownIcon } from "./shellIcons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type KeyedNavSection = NavSection & { key: string };

type AppShellSidebarProps = {
  pathname: string;
  mobileMenuOpen: boolean;
  onNavLinkActivate: () => void;
  keyedSideSections: KeyedNavSection[];
  expandedSectionKey: string | null;
  onToggleSection: (key: string) => void;
  profileSummary: ProfileSummary | null;
  userEmail: string;
  userRole: string;
  workspaceLabel: string;
  accountStatus: string;
  onLogout: () => void;
};

export function AppShellSidebar({
  pathname,
  mobileMenuOpen,
  onNavLinkActivate,
  keyedSideSections,
  expandedSectionKey,
  onToggleSection,
  profileSummary,
  userEmail,
  userRole,
  workspaceLabel,
  accountStatus,
  onLogout,
}: AppShellSidebarProps) {
  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-50 h-dvh w-[280px] max-w-[84vw] border-r border-[var(--app-border)] bg-[linear-gradient(180deg,_#f7fbff_0%,_#edf4ff_55%,_#e7f0fb_100%)] text-[var(--app-text-strong)] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-[248px] lg:max-w-none lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="p-4 pb-1">
          <div className="relative h-[5.8rem] w-full">
            <Image
              src="/brand/safety360docs-reference-neon-tight.png"
              alt="Safety360Docs by Reliance EHS"
              fill
              priority
              sizes="248px"
              className="object-contain object-left"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Menu</div>
          <div className="mt-4 space-y-0">
            {keyedSideSections.map((section, sectionIndex) => {
              const sectionDescription = (section as { description?: string }).description ?? "";
              const isExpanded = expandedSectionKey === section.key;
              const sectionContentId = `nav-section-panel-${section.key}`;
              return (
                <div
                  key={`nav-section-${sectionIndex}-${section.title}`}
                  className={sectionIndex > 0 ? "mt-5 border-t border-[var(--app-border)] pt-5" : ""}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={sectionContentId}
                    onClick={() => onToggleSection(section.key)}
                    className={cx(
                      "flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2 text-left transition",
                      isExpanded
                        ? "bg-white/75 text-[var(--app-text-strong)] shadow-sm"
                        : "text-slate-500 hover:bg-white/60 hover:text-[var(--app-text-strong)]"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em]">{section.title}</div>
                      {sectionDescription ? (
                        <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">{sectionDescription}</div>
                      ) : null}
                    </div>
                    <span
                      className={cx(
                        "mt-0.5 inline-flex shrink-0 rounded-full border border-[var(--app-border)] bg-white/90 p-1 text-[var(--app-muted)]",
                        isExpanded && "text-[var(--app-accent-primary)]"
                      )}
                    >
                      <ChevronDownIcon expanded={isExpanded} />
                    </span>
                  </button>
                  <div
                    id={sectionContentId}
                    className={cx(
                      "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
                      isExpanded ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-1.5 px-1 pb-1">
                        {section.items.map((item) => {
                          const active = isWorkspaceNavActive(pathname, item.href);
                          const navMeta = getWorkspaceNavItemMeta(item);
                          return (
                            <Link
                              key={`${section.title}-${item.href}`}
                              href={item.href}
                              className={cx(
                                "flex items-center rounded-2xl border px-4 py-3 transition",
                                active
                                  ? "border-[var(--app-accent-border-24)] bg-[linear-gradient(135deg,_var(--app-accent-surface-14)_0%,_var(--app-accent-surface-08)_100%)] text-[var(--app-text-strong)] shadow-[var(--app-shadow-primary-nav)]"
                                  : "border-transparent text-[var(--app-text)] hover:bg-white/70 hover:text-[var(--app-text-strong)]"
                              )}
                              onClick={onNavLinkActivate}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                                  {item.label}
                                </div>
                                {!active ? (
                                  <div className="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">
                                    {navMeta.description}
                                  </div>
                                ) : null}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 bg-[rgba(237,244,255,0.92)] p-3 backdrop-blur">
          <div className="rounded-[1.6rem] border border-[var(--app-border)] bg-white/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Signed In</div>
            <div className="mt-3 flex items-center gap-3">
              <ProfileAvatar profile={profileSummary} email={userEmail} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                  {getUserDisplayName(profileSummary, userEmail)}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--app-text)]">
                  {profileSummary?.jobTitle || formatUserRoleLabel(userRole)}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--app-accent-primary)]">
              {profileSummary?.tradeSpecialty || formatUserRoleLabel(userRole)}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]">
              <span>{workspaceLabel}</span>
              <span className="capitalize">{accountStatus}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="app-btn-primary app-radius-card mt-4 w-full px-4 py-3 text-sm font-bold app-shadow-action transition"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
